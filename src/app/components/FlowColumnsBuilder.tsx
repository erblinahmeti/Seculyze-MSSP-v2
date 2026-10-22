import { useMemo, useState } from 'react';
import { ChevronLeft, ShieldAlert, Check, ScrollText } from 'lucide-react';
import PlaybookPicker from './PlaybookPicker';
import MultiSelect from './MultiSelect';
import MatchToggle from './MatchToggle';
import { SaveActions, ViewActions, CancelEdit } from './FlowStatus';
import FlowStages from './FlowStages';
import FlowMode, { LOCKED_FIELDS } from './FlowMode';
import FlowStatusDrawer from './FlowStatusDrawer';
import { actionsLogged } from './flowRuns';
import FlowReview from './FlowReview';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, allConditions, allActions, actionChangesCustomerSystems, GROUP_LABEL, makeKey, sameFlow,
  type Flow, type Group, type TriggerId, type ConditionId, type ActionId,
} from './flowRegister';

// ─── Automation builder, version C — three columns ───────────────────────────
//
// Same register again, laid out sideways: trigger, conditions, actions, read
// left to right in the order they happen.
//
// What this buys over B: nothing collapses. The trigger list stays on screen
// after you pick one, so changing your mind is one click in place rather than
// a Change button that resets the page — and the two columns to its right
// visibly reshape when you do, which is the rule of the whole feature made
// literal. The cost is that it needs the width, so below 1100px it stacks.
//
// Each column scrolls on its own, so 20 actions never push the trigger list
// off the top.

const SEL =
  'h-8 px-2 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] ' +
  'cursor-pointer transition-colors hover:border-[#2A96A8] focus:outline-none focus:border-[#2A96A8]';
const INP =
  'h-8 px-2 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] ' +
  'placeholder:text-[#b7c4c9] transition-colors focus:outline-none focus:border-[#2A96A8]';

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

/** One of the three columns: a fixed head, a body that scrolls by itself. */
/**
 * A column head names the thing, then says what it does.
 *
 * The headings used to be only the plain-English half — "When this happens",
 * "Only when", "Do this" — which reads nicely and leaves someone with no word
 * for the part they are looking at. Trigger, Conditions and Action are the
 * terms the rest of the product, the sheet and every other SOAR tool use, so
 * they lead; the sentence stays underneath as the explanation.
 */
function Column({ n, title, sub, count, children }: {
  n: number; title: string; sub: string; count?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-white border border-[var(--stroke)] rounded-[8px] overflow-hidden
                    min-[1100px]:min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#f6f6f6] border-b border-[var(--stroke)]">
        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-[8px] bg-[#092E3F] text-white text-[10px] font-semibold">
          {n}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-[#6b828c]">{title}</span>
          <span className="block text-[11px] text-[#b7c4c9] leading-tight">{sub}</span>
        </span>
        {count && <span className="ml-auto text-xs text-[#87999f] shrink-0">{count}</span>}
      </div>
      {/* Stacked, the page scrolls as one. Side by side, each column scrolls
          on its own so 20 actions never push the trigger list off the top. */}
      <div className="flex-1 min-[1100px]:min-h-0 min-[1100px]:overflow-y-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-xs text-[#87999f]">{children}</p>;
}

interface CondState { on: boolean; operator: string; value: string }
interface ActState { on: boolean; param: string }

interface Props {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
  /**
   * Opens this automation's own audit log. Only passed for a flow that has
   * run — a brand new one has no history to show, so the button isn't there
   * rather than opening on an empty list.
   */
  onAuditLog?: () => void;
}

export default function FlowColumnsBuilder({ flow, onSave, onBack, onAuditLog }: Props) {
  const [name, setName] = useState(flow.name);
  // On the toolbar rather than inside the status drawer: what a flow has
  // done is asked for far too often to be two clicks deep, and the count
  // is what tells you there is anything in there at all.
  const logged = actionsLogged(flow.name);

  // A saved flow opens as a record of itself. A new one is already a blank
  // form, so there is nothing to unlock.
  const [editing, setEditing] = useState(!flow.name);

  // Switching mode plays a short refresh over the body. The counter is what
  // restarts the animation — a class that is already on the element does not
  // replay, so the number is the trigger rather than a boolean.
  const [swapKey, setSwapKey] = useState(0);
  const setMode = (next: boolean) => { setEditing(next); setSwapKey(k => k + 1); };

  const [review, setReview] = useState(false);
  const [status, setStatus] = useState(false);
  const [trigger, setTrigger] = useState<TriggerId | null>(flow.trigger);
  const [matchAll, setMatchAll] = useState(flow.matchAll);

  const [conds, setConds] = useState<Partial<Record<ConditionId, CondState>>>(() =>
    Object.fromEntries(flow.conditions.map(c => [c.id, { on: true, operator: c.operator, value: c.value }])));
  const [acts, setActs] = useState<Partial<Record<ActionId, ActState>>>(() =>
    Object.fromEntries(flow.actions.map(a => [a.action, { on: true, param: a.param ?? '' }])));

  const def = trigger ? TRIGGER_BY_ID[trigger] : null;
  const availableConditions = useMemo(() => conditionsFor(trigger), [trigger]);
  const availableActions = useMemo(() => actionsFor(trigger), [trigger]);

  const condOf = (id: ConditionId): CondState =>
    conds[id] ?? { on: false, operator: CONDITION_BY_ID[id].operators[0], value: '' };
  const actOf = (id: ActionId): ActState => acts[id] ?? { on: false, param: '' };

  const setCond = (id: ConditionId, patch: Partial<CondState>) =>
    setConds(c => ({ ...c, [id]: { ...condOf(id), ...patch } }));
  const setAct = (id: ActionId, patch: Partial<ActState>) =>
    setActs(a => ({ ...a, [id]: { ...actOf(id), ...patch } }));

  /**
   * Picking a different trigger in place. Anything the new trigger still
   * allows is kept — across groups that is usually only Customers, but within
   * the alert group all twelve triggers share a column, so switching between
   * them costs nothing. That is the point of leaving the list on screen.
   */
  const pickTrigger = (id: TriggerId) => {
    if (id === trigger) return;
    const keepC = conditionsFor(id), keepA = actionsFor(id);
    setConds(c => Object.fromEntries(Object.entries(c).filter(([k]) => keepC.includes(k as ConditionId))));
    setActs(a => Object.fromEntries(Object.entries(a).filter(([k]) => keepA.includes(k as ActionId))));
    setTrigger(id);
  };

  const draft: Flow = useMemo(() => ({
    ...flow,
    name,
    trigger,
    matchAll,
    conditions: availableConditions
      .filter(id => condOf(id).on)
      .map(id => ({ key: makeKey(), id, operator: condOf(id).operator, value: condOf(id).value })),
    actions: availableActions
      .filter(id => actOf(id).on)
      .map(id => ({ key: makeKey(), action: id, param: actOf(id).param || undefined })),
  }), [flow, name, trigger, matchAll, conds, acts, availableConditions, availableActions]);

  const dirty = !sameFlow(draft, flow);

  const onCount = draft.conditions.length;
  const hasDestructive = draft.actions.some(a => actionChangesCustomerSystems(a));
  const hasApproval = draft.conditions.some(c => c.id === 'approval' && c.value);
  const needsApproval = hasDestructive && !hasApproval && availableConditions.includes('approval');

  const save = (live: boolean) => onSave({ ...draft, name: name.trim() || 'Untitled', isActive: live });

  // Backing out of an edit puts the flow back the way it was found and locks
  // it again — it does not leave the page. Leaving has its own door at the top.
  // A flow that was never saved has nothing to go back to, so there Cancel
  // really does mean "drop it".
  const cancelEdit = () => {
    if (!flow.name) { onBack(); return; }
    setName(flow.name);
    setTrigger(flow.trigger);
    setMatchAll(flow.matchAll);
    setConds(Object.fromEntries(flow.conditions.map(c => [c.id, { on: true, operator: c.operator, value: c.value }])));
    setActs(Object.fromEntries(flow.actions.map(a => [a.action, { on: true, param: a.param ?? '' }])));
    setMode(false);
  };

  // Going live is the one step that cannot be taken back by closing the tab,
  // so it goes through the review. Saving a draft, or editing something that
  // is already running, does not — the review is reachable from its own button
  // whenever anyone wants it.
  const requestSave = (live: boolean) => {
    if (live && !flow.isActive) setReview(true);
    else save(live);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-50 to-gray-100">

      {/* Top bar — the name and the verbs, so the columns keep the full height */}
      <div className="shrink-0 px-6 pt-5 pb-4">
        {/* Create → Review → Active, next to the way out. Where the flow has
            got to is the first thing you need to know and the last thing you
            should have to hunt for. */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />Back to flows
          </button>
          <FlowStages
            isNew={!flow.name}
            isActive={!!flow.isActive}
            canReview={!!trigger && draft.actions.length > 0}
            onReview={() => setReview(true)}
            onStatus={() => setStatus(true)}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!editing}
            placeholder="Untitled"
            className="w-[300px] max-w-full mr-auto h-9 px-3 bg-white border border-[var(--stroke)] rounded-[8px]
                       text-sm text-[#092E3F] placeholder:text-[#b7c4c9]
                       transition-colors focus:outline-none focus:border-[#2A96A8]
                       disabled:bg-[#fafbfb] disabled:text-[#495565] disabled:border-transparent"
          />
          {onAuditLog && (
            <button
              onClick={onAuditLog}
              title="Every action this automation has taken"
              className="flex items-center gap-2 h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px]
                         text-sm text-[#092E3F] hover:border-[#2A96A8] transition-colors"
            >
              <ScrollText className="w-4 h-4" />Audit log
              {logged > 0 && (
                <span className="px-1.5 py-0.5 rounded-[8px] bg-[#eef1f3] text-[11px] text-[#5c707a] tabular-nums">
                  {logged}
                </span>
              )}
            </button>
          )}
          {!editing ? (
            <ViewActions
              isLive={!!flow.isActive}
              onEdit={() => setMode(true)}
              onSetLive={() => setReview(true)}
              onTurnOff={() => save(false)}
            />
          ) : (
            <>
              <CancelEdit dirty={dirty} onCancel={cancelEdit} />
              <SaveActions
                isLive={!!flow.isActive}
                disabled={!trigger || draft.actions.length === 0 || !dirty}
                onSave={requestSave}
              />
            </>
          )}
        </div>
        <FlowMode editing={editing} dirty={dirty} isLive={!!flow.isActive} swapKey={swapKey} className="mt-3" />
      </div>

      {/* The three columns. Below 1100px there isn't room, so they stack. */}
      {/* A real fieldset rather than a pointer-events trick: it disables every
          input, select and button inside it the way the platform already knows
          how to, keyboard and assistive tech included. */}
      <fieldset disabled={!editing} className={`contents ${editing ? '' : LOCKED_FIELDS}`}>
      <div className={`flex-1 min-h-0 px-6 grid gap-4 grid-cols-1 auto-rows-min overflow-y-auto
                      min-[1100px]:grid-cols-3 min-[1100px]:auto-rows-auto min-[1100px]:overflow-hidden ${swapKey ? 'flow-mode-swap' : ''}`}>

        {/* 1 — trigger. Stays on screen; picking another reshapes 2 and 3. */}
        <Column n={1} title="Trigger" sub="when this happens" count={`${TRIGGERS.length}`}>
          {GROUPS.map(g => (
            <div key={g}>
              <p className="sticky top-0 px-4 py-1.5 bg-white text-[10px] font-medium uppercase tracking-wide text-[#87999f] border-b border-gray-100">
                {GROUP_LABEL[g]}
              </p>
              {TRIGGERS.filter(t => t.group === g).map(t => {
                const on = t.id === trigger;
                return (
                  <button
                    key={t.id}
                    onClick={() => pickTrigger(t.id)}
                    className={`w-full text-left px-4 py-2.5 border-b border-gray-100 transition-colors ${
                      on ? 'bg-[#2A96A8]/10' : 'hover:bg-[#fafbfb]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
                          on ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-[#c9d6dc]'
                        }`}
                      >
                        {on && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className={`text-sm ${on ? 'font-medium text-[#092E3F]' : 'text-[#092E3F]'}`}>
                        {t.name}
                      </span>
                    </span>
                    <span className="block text-[11px] text-[#87999f] mt-0.5 ml-6">{t.source}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </Column>

        {/* 2 — conditions, generated from column 1 */}
        <Column
          n={2}
          title="Conditions"
          sub="only run when"
          count={trigger ? `${onCount} of ${availableConditions.length}` : undefined}
        >
          {!trigger ? (
            <Empty>Choose a trigger first — it decides which conditions are available.</Empty>
          ) : (
            <>
              {onCount > 1 && (
                <MatchToggle
                  triggerName={def!.name}
                  count={onCount}
                  matchAll={matchAll}
                  onChange={setMatchAll}
                  className="px-4 py-2 border-b border-gray-100 bg-[#fbfcfd]"
                />
              )}
              {/* Everything, with what this trigger cannot use dimmed and
                  pushed to the bottom. */}
              {allConditions(trigger).map(({ id, available, reason }) => {
                const cfg = CONDITION_BY_ID[id];
                const st = condOf(id);
                return (
                  <label
                    key={id}
                    title={reason}
                    className={`block px-4 py-2.5 border-b border-gray-100 transition-colors ${
                      !available
                        ? 'opacity-45 cursor-not-allowed'
                        : st.on ? 'bg-[#f8fdfe] cursor-pointer' : 'hover:bg-[#fafbfb] cursor-pointer'
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={st.on}
                        disabled={!available}
                        onChange={e => setCond(id, { on: e.target.checked })}
                        className="mt-0.5 shrink-0 accent-[#2A96A8] disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[#092E3F]">{cfg.name}</span>
                        {reason ? (
                          <span className="block text-[11px] mt-0.5 text-[#87999f]">{reason}</span>
                        ) : cfg.hint ? (
                          <span className={`block text-[11px] mt-0.5 ${cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#87999f]'}`}>
                            {cfg.hint}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {st.on && available && (
                      <span className="flex flex-col gap-1.5 mt-2 ml-6" onClick={e => e.preventDefault()}>
                        <select
                          value={st.operator}
                          onChange={e => setCond(id, { operator: e.target.value })}
                          className={SEL}
                        >
                          {cfg.operators.map(op => <option key={op}>{op}</option>)}
                        </select>
                        {cfg.kind === 'multi' ? (
                            <MultiSelect
                              value={st.value}
                              onChange={v => setCond(id, { value: v })}
                              options={cfg.options!}
                              className={SEL}
                              dense
                            />
                          ) : cfg.kind === 'enum' ? (
                          <select
                            value={st.value}
                            onChange={e => setCond(id, { value: e.target.value })}
                            className={SEL}
                          >
                            <option value="">Choose…</option>
                            {cfg.options!.map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            value={st.value}
                            onChange={e => setCond(id, { value: e.target.value })}
                            placeholder={cfg.placeholder}
                            className={INP}
                          />
                        )}
                      </span>
                    )}
                  </label>
                );
              })}
            </>
          )}
        </Column>

        {/* 3 — actions, generated from column 1 */}
        <Column
          n={3}
          title="Actions"
          sub="then do this"
          count={trigger ? `${draft.actions.length} of ${availableActions.length}` : undefined}
        >
          {!trigger ? (
            <Empty>Choose a trigger first — it decides which actions are available.</Empty>
          ) : (
            <>
              {allActions(trigger).map(({ id, available, reason }) => {
                const d = ACTION_BY_ID[id];
                const st = actOf(id);
                return (
                  <label
                    key={id}
                    title={reason}
                    className={`block px-4 py-2.5 border-b border-gray-100 transition-colors ${
                      !available
                        ? 'opacity-45 cursor-not-allowed'
                        : st.on ? 'bg-[#f8fdfe] cursor-pointer' : 'hover:bg-[#fafbfb] cursor-pointer'
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={st.on}
                        disabled={!available}
                        onChange={e => setAct(id, { on: e.target.checked })}
                        className="mt-0.5 shrink-0 accent-[#2A96A8] disabled:cursor-not-allowed"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm text-[#092E3F]">{d.name}</span>
                          {actionChangesCustomerSystems({ key: id, action: id, param: st.param }) && (
                            <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
                              changes customer systems
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-[#87999f] mt-0.5 truncate">
                          {reason ?? d.system}
                        </span>
                      </span>
                    </span>
                    {st.on && available && d.param && (
                      <span className="block mt-2 ml-6" onClick={e => e.preventDefault()}>
                        {d.param.kind === 'playbook' ? (
                            <PlaybookPicker
                              value={st.param}
                              onChange={v => setAct(id, { param: v })}
                              selectClass={SEL}
                              dense
                            />
                          ) : d.param.kind === 'enum' ? (
                          <select
                            value={st.param}
                            onChange={e => setAct(id, { param: e.target.value })}
                            className={`${SEL} w-full`}
                          >
                            <option value="">Choose…</option>
                            {d.param.options!.map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            value={st.param}
                            onChange={e => setAct(id, { param: e.target.value })}
                            placeholder={d.param.placeholder}
                            className={`${INP} w-full`}
                          />
                        )}
                      </span>
                    )}
                  </label>
                );
              })}
            </>
          )}
        </Column>
      </div>

      {/* Readback, spanning all three — the columns read as one sentence */}
      <div className="shrink-0 px-6 py-3 mt-4">
        {needsApproval && (
          <div className="flex items-start gap-2 px-3 py-2 mb-2 rounded-[8px] bg-[#fdf6e9] border border-[#f0dfbe]">
            <ShieldAlert className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
            <p className="text-xs text-[#8a5a12]">
              This automation changes systems in the customer's environment and nothing is holding it back.
              Switch on <strong>Approval</strong> in column 2 if a human should see it first.
            </p>
          </div>
        )}
      </div>
      </fieldset>

      {/* The third stage — what it has been doing, beside what it does. */}
      <FlowStatusDrawer
        flow={{ ...flow, name: name.trim() || flow.name }}
        open={status}
        onClose={() => setStatus(false)}
        onTurnOff={() => { setStatus(false); save(false); }}
        onAuditLog={onAuditLog ? () => { setStatus(false); onAuditLog(); } : undefined}
      />

      {/* The gate between a finished draft and a live automation. */}
      {review && (
        <FlowReview
          flow={{ ...draft, name: name.trim() || 'Untitled' }}
          alreadyLive={!!flow.isActive}
          confirmLabel={flow.isActive ? 'Save changes' : 'Save and set live'}
          onConfirm={() => { setReview(false); save(true); }}
          onClose={() => setReview(false)}
        />
      )}
    </div>
  );
}
