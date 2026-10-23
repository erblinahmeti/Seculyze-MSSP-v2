import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, RotateCcw, ScrollText } from 'lucide-react';
import PlaybookPicker from './PlaybookPicker';
import MultiSelect from './MultiSelect';
import MatchToggle from './MatchToggle';
import FlowStatus, { SaveActions, CancelEdit } from './FlowStatus';
import FieldNote from './FieldNote';
import FlowStatusDrawer from './FlowStatusDrawer';
import { actionsLogged } from './flowRuns';
import FlowReview from './FlowReview';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, allConditions, allActions, actionChangesCustomerSystems, GROUP_LABEL, makeKey, sameFlow,
  type Flow, type Group, type TriggerId, type ConditionId, type ActionId,
} from './flowRegister';

// ─── Automation builder, version B — guided ──────────────────────────────────
//
// Same register as version A, one question at a time and nothing to assemble.
//
// The difference that matters: A starts empty and you press + to add a row,
// which means you have to already know what a condition is and that more exist.
// B never asks you to add anything. Everything the trigger allows is on screen
// from the moment you pick it — conditions as rows you switch on, actions as
// tiles you tick. Choosing is easier than building, so B only asks you to
// choose.
//
// The trigger is still the gate: pick one and the other fourteen disappear,
// because what you can narrow by and what you can do are both decided by it.

const SEL =
  'h-9 px-2.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] ' +
  'cursor-pointer transition-colors hover:border-[#2A96A8] focus:outline-none focus:border-[#2A96A8]';
const INP =
  'h-9 px-2.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] ' +
  'placeholder:text-[#b7c4c9] transition-colors focus:outline-none focus:border-[#2A96A8]';
const CARD = 'bg-white border border-[var(--stroke)] rounded-[8px] p-5';

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

/** A numbered question. The number is the whole navigation — there are only three. */
function Question({ n, title, sub, children }: {
  n: number; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="flex items-baseline gap-2.5 mb-2.5">
        <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[8px] bg-[#092E3F] text-white text-xs font-semibold">
          {n}
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#092E3F]">{title}</h2>
          {sub && <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

interface CondState { on: boolean; operator: string; value: string }
interface ActState { on: boolean; param: string }

interface Props {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
  /** Opens this flow's own log. Absent for a flow that was never saved. */
  onAuditLog?: () => void;
}

export default function FlowGuidedBuilder({ flow, onSave, onBack, onAuditLog }: Props) {
  const [name, setName] = useState(flow.name);
  // On the toolbar rather than inside the status drawer: what a flow has
  // done is asked for far too often to be two clicks deep, and the count
  // is what tells you there is anything in there at all.
  const logged = actionsLogged(flow.name);


  const [review, setReview] = useState(false);
  const [status, setStatus] = useState(false);
  const [trigger, setTrigger] = useState<TriggerId | null>(flow.trigger);
  const [matchAll, setMatchAll] = useState(flow.matchAll);

  // Conditions and actions are keyed maps rather than lists, because in B they
  // all exist from the start — the only thing that changes is which are on.
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
   * Changing the trigger starts over. In B the whole screen below question 1 is
   * generated from the trigger, so keeping the parts that happen to survive
   * would leave the user staring at a form they didn't build.
   */
  const changeTrigger = () => { setTrigger(null); setConds({}); setActs({}); };

  // The draft, assembled from the maps in register order so the readback and
  // the saved flow always list things the same way.
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

  const chosenActions = draft.actions.length;
  const dirty = !sameFlow(draft, flow);

  const hasDestructive = draft.actions.some(a => actionChangesCustomerSystems(a));
  const hasApproval = draft.conditions.some(c => c.id === 'approval' && c.value);
  const needsApproval = hasDestructive && !hasApproval && availableConditions.includes('approval');

  // Saved, and back to reading it. The page stays where it is; what it
  // shows changes, because the thing is now a saved automation.
  //
  // Locking up is not done here, though. A save can still be stopped by a
  // confirmation the page puts in front of it, and dropping out of edit mode
  // the moment the button is pressed would leave someone who answered "keep it
  // running" looking at a locked form. The effect below does it when the save
  // actually lands.
  const save = (live: boolean) => {
    onSave({ ...draft, name: name.trim() || 'Untitled', isActive: live });
  };


  // Backing out of an edit puts the flow back the way it was found and locks
  // it again — it does not leave the page. Leaving has its own door at the top.
  // A flow that was never saved has nothing to go back to, so there Cancel
  // really does mean "drop it".
  const cancelEdit = () => {
    // Nothing to put back — a flow that was never saved, or a saved one
    // nobody has touched — so Cancel means leave. With work on screen it
    // means put it back, and the page stays where it is.
    if (!flow.name || !dirty) { onBack(); return; }
    setName(flow.name);
    setTrigger(flow.trigger);
    setMatchAll(flow.matchAll);
    setConds(Object.fromEntries(flow.conditions.map(c => [c.id, { on: true, operator: c.operator, value: c.value }])));
    setActs(Object.fromEntries(flow.actions.map(a => [a.action, { on: true, param: a.param ?? '' }])));
  };


  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">
        {/* Create → Review → Active, next to the way out. Where the flow has
            got to is the first thing you need to know and the last thing you
            should have to hunt for. */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />Back to flows
          </button>
          <FlowStatus
            isNew={!flow.name}
            isActive={!!flow.isActive}
          dirty={dirty}
            onOpenStatus={flow.name ? () => setStatus(true) : undefined}
          />
        </div>

        <div className="max-w-[860px] mx-auto">

          {/* 1 — the trigger. Everything below is generated from it. */}
          <Question
            n={1}
            title="What do you want to automate?"
            sub={trigger ? undefined : 'Pick the one thing that starts this automation.'}
          >
            {!trigger ? (
              <div className="space-y-4">
                {GROUPS.map(g => (
                  <div key={g}>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
                      {GROUP_LABEL[g]}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TRIGGERS.filter(t => t.group === g).map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTrigger(t.id)}
                          className="text-left px-3 py-2.5 bg-white border border-[var(--stroke)] rounded-[8px]
                                     hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
                        >
                          <p className="text-sm font-medium text-[#092E3F]">{t.name}</p>
                          <p className="text-[11px] text-[#87999f] mt-0.5">{t.source}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${CARD} flex items-center justify-between gap-3 py-3.5`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-[8px] bg-[#2A96A8]">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#092E3F]">{def!.name}</p>
                    <p className="text-[11px] text-[#87999f]">{def!.source}</p>
                  </div>
                </div>
                <button
                  onClick={changeTrigger}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] border border-[var(--stroke)]
                             text-xs text-[#6b828c] hover:border-[#2A96A8] hover:text-[#092E3F] transition-colors shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />Change
                </button>
              </div>
            )}
          </Question>

          {trigger && (
            <>
              {/* 2 — every condition this trigger allows, already on screen. */}
              <Question
                n={2}
                title="Should it only run sometimes?"
                sub={`Switch on what you want to narrow by. Leave them all off and it runs every time ${def!.name.toLowerCase()} happens.`}
              >
                <div className={`${CARD} p-0 overflow-hidden`}>
                  <div className="divide-y divide-gray-100">
                    {allConditions(trigger).map(({ id, available, reason }) => {
                      const cfg = CONDITION_BY_ID[id];
                      const st = condOf(id);
                      return (
                        <label
                          key={id}
                          title={reason}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                            !available
                              ? 'opacity-45 cursor-not-allowed'
                              : st.on ? 'bg-[#f8fdfe] cursor-pointer' : 'hover:bg-[#fafbfb] cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={st.on}
                            disabled={!available}
                            onChange={e => setCond(id, { on: e.target.checked })}
                            className="mt-0.5 shrink-0 accent-[#2A96A8] disabled:cursor-not-allowed"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#092E3F]">{cfg.name}</p>
                            {(reason ?? cfg.hint) && (
                              <p className={`text-xs mt-0.5 ${!reason && cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#87999f]'}`}>
                                {reason ?? cfg.hint}
                              </p>
                            )}

                            {/* The warning lives on the thing that would fix it. */}
                            {id === 'approval' && needsApproval && available && !st.on && (
                              <FieldNote className="mt-1.5">
                                This automation changes systems in the customer's environment and
                                nothing is holding it back. Switch this on if a human should see it first.
                              </FieldNote>
                            )}
                            {st.on && available && !st.value.trim() && (
                              <FieldNote className="mt-1.5">
                                {id === 'approval'
                                  ? 'Choose who approves — nothing is held back until you do.'
                                  : 'Needs a value — it does nothing while this is empty.'}
                              </FieldNote>
                            )}

                            {st.on && available && (
                              <div
                                className="flex items-center gap-2 mt-2"
                                onClick={e => e.preventDefault()}
                              >
                                <select
                                  value={st.operator}
                                  onChange={e => setCond(id, { operator: e.target.value })}
                                  className={`${SEL} w-[170px] shrink-0`}
                                >
                                  {cfg.operators.map(op => <option key={op}>{op}</option>)}
                                </select>
                                {cfg.kind === 'multi' ? (
                            <MultiSelect
                              value={st.value}
                              onChange={v => setCond(id, { value: v })}
                              options={cfg.options!}
                              className={`${SEL} flex-1`}
                            />
                          ) : cfg.kind === 'enum' ? (
                                  <select
                                    value={st.value}
                                    onChange={e => setCond(id, { value: e.target.value })}
                                    className={`${SEL} flex-1`}
                                  >
                                    <option value="">Choose…</option>
                                    {cfg.options!.map(o => <option key={o}>{o}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    value={st.value}
                                    onChange={e => setCond(id, { value: e.target.value })}
                                    placeholder={cfg.placeholder}
                                    className={`${INP} flex-1`}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {draft.conditions.length > 1 && (
                  <div className="mt-2.5">
                    <MatchToggle
                      triggerName={def!.name}
                      count={draft.conditions.length}
                      matchAll={matchAll}
                      onChange={setMatchAll}
                    />
                  </div>
                )}
              </Question>

              {/* 3 — every action this trigger reaches, already on screen. */}
              <Question
                n={3}
                title="What should happen?"
                sub="Tick everything this automation should do. They run in the order shown."
              >
                <div className="grid grid-cols-2 gap-2">
                  {allActions(trigger).map(({ id, available, reason }) => {
                    const d = ACTION_BY_ID[id];
                    const st = actOf(id);
                    return (
                      <label
                        key={id}
                        title={reason}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-[8px] border transition-colors ${
                          !available
                            ? 'bg-white border-[var(--stroke)] opacity-45 cursor-not-allowed'
                            : st.on
                              ? 'bg-[#f8fdfe] border-[#2A96A8] cursor-pointer'
                              : 'bg-white border-[var(--stroke)] hover:border-[#b7c4c9] cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={st.on}
                          disabled={!available}
                          onChange={e => setAct(id, { on: e.target.checked })}
                          className="mt-0.5 shrink-0 accent-[#2A96A8] disabled:cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-[#092E3F]">{d.name}</span>
                            {/* Only once it is chosen: in the list it is a property of an
                                action nobody has picked, on a chosen one it is what the
                                flow will actually do. */}
                            {st.on && actionChangesCustomerSystems({ key: id, action: id, param: st.param }) && (
                              <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
                                changes customer systems
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#87999f] mt-0.5 truncate">{reason ?? d.system}</p>

                          {st.on && available && d.param && (
                            <div className="mt-2" onClick={e => e.preventDefault()}>
                              {d.param.kind === 'playbook' ? (
                            <PlaybookPicker
                              value={st.param}
                              onChange={v => setAct(id, { param: v })}
                              selectClass={SEL}
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
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

              </Question>

              {/* 4 — the name, asked last, once there is something to name. */}
              <Question n={4} title="Name it" sub="So it's recognisable in the list.">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Untitled"
                  className={`${INP} w-[300px] max-w-full`}
                />              </Question>
            </>
          )}


          {/* Footer */}
          <div className="flex items-center justify-between mt-5 mb-10">
                        <div className="flex items-center gap-2">
              {onAuditLog && (
                <button
                  onClick={onAuditLog}
                  title="Every action this automation has taken"
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--stroke)] rounded-[8px]
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
              <CancelEdit isNew={!flow.name} dirty={dirty} onCancel={cancelEdit} />
              <SaveActions
                isLive={!!flow.isActive}
                disabled={!trigger || chosenActions === 0}
                dirty={dirty}
              onSave={save}
              onReview={() => setReview(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* The third stage — what it has been doing, beside what it does. */}
      <FlowStatusDrawer
        flow={{ ...flow, name: name.trim() || flow.name }}
        open={status}
        onClose={() => setStatus(false)}
        onAuditLog={onAuditLog ? () => { setStatus(false); onAuditLog(); } : undefined}
        onTurnOff={() => { setStatus(false); save(false); }}
      />

      {/* The gate between a finished draft and a live automation. */}
      {review && (
        <FlowReview
          flow={{ ...draft, name: name.trim() || 'Untitled' }}
          alreadyLive={!!flow.isActive}
          confirmLabel={flow.isActive ? 'Save changes' : 'Run automation'}
          onConfirm={() => { setReview(false); save(true); }}
          onClose={() => setReview(false)}
        />
      )}
    </div>
  );
}
