import { useMemo, useState } from 'react';
import { ChevronLeft, Play, ShieldAlert, Check } from 'lucide-react';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, GROUP_LABEL, describe, makeKey,
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
function Column({ n, title, count, children }: {
  n: number; title: string; count?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-white border border-[var(--stroke)] rounded-[8px] overflow-hidden
                    min-[1100px]:min-h-0">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#f6f6f6] border-b border-[var(--stroke)]">
        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-[8px] bg-[#092E3F] text-white text-[10px] font-semibold">
          {n}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-[#6b828c]">{title}</span>
        {count && <span className="ml-auto text-xs text-[#87999f]">{count}</span>}
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
}

export default function FlowColumnsBuilder({ flow, onSave, onBack }: Props) {
  const [name, setName] = useState(flow.name);
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

  const onCount = draft.conditions.length;
  const hasDestructive = draft.actions.some(a => ACTION_BY_ID[a.action].destructive);
  const hasApproval = draft.conditions.some(c => c.id === 'approval' && c.value);
  const needsApproval = hasDestructive && !hasApproval && availableConditions.includes('approval');

  const save = () => onSave({ ...draft, name: name.trim() || 'Untitled automation' });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-50 to-gray-100">

      {/* Top bar — the name and the verbs, so the columns keep the full height */}
      <div className="shrink-0 px-6 pt-5 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />Back to flows
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name this automation"
            className="flex-1 min-w-[240px] h-9 px-3 bg-white border border-[var(--stroke)] rounded-[8px]
                       text-sm text-[#092E3F] placeholder:text-[#b7c4c9]
                       transition-colors focus:outline-none focus:border-[#2A96A8]"
          />
          <button
            disabled={!trigger}
            className="flex items-center gap-2 h-9 px-3 bg-white border border-[var(--stroke)] rounded-[8px]
                       text-sm text-[#092E3F] hover:border-[#2A96A8] transition-colors
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            <Play className="w-4 h-4" />Test on last 30 days
          </button>
          <button
            onClick={onBack}
            className="h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                       hover:border-[#2A96A8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!trigger || draft.actions.length === 0}
            className="h-9 px-4 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                       hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Save automation
          </button>
        </div>
      </div>

      {/* The three columns. Below 1100px there isn't room, so they stack. */}
      <div className="flex-1 min-h-0 px-6 grid gap-4 grid-cols-1 auto-rows-min overflow-y-auto
                      min-[1100px]:grid-cols-3 min-[1100px]:auto-rows-auto min-[1100px]:overflow-hidden">

        {/* 1 — trigger. Stays on screen; picking another reshapes 2 and 3. */}
        <Column n={1} title="When this happens" count={`${TRIGGERS.length}`}>
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
          title="Only when"
          count={trigger ? `${onCount} of ${availableConditions.length}` : undefined}
        >
          {!trigger ? (
            <Empty>Pick a trigger. What you can narrow by depends on it.</Empty>
          ) : (
            <>
              {onCount > 1 && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                  <span className="text-xs text-[#6b828c]">Match</span>
                  <span className="inline-flex rounded-[8px] bg-[#eef1f3] p-0.5">
                    {(['all', 'any'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMatchAll(m === 'all')}
                        className={`px-2 py-0.5 rounded-[8px] text-xs transition-colors ${
                          (m === 'all') === matchAll ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#6b828c]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </span>
                </div>
              )}
              {availableConditions.map(id => {
                const cfg = CONDITION_BY_ID[id];
                const st = condOf(id);
                return (
                  <label
                    key={id}
                    className={`block px-4 py-2.5 border-b border-gray-100 cursor-pointer transition-colors ${
                      st.on ? 'bg-[#f8fdfe]' : 'hover:bg-[#fafbfb]'
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={st.on}
                        onChange={e => setCond(id, { on: e.target.checked })}
                        className="mt-0.5 shrink-0 accent-[#2A96A8]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[#092E3F]">{cfg.name}</span>
                        {cfg.hint && (
                          <span className={`block text-[11px] mt-0.5 ${cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#87999f]'}`}>
                            {cfg.hint}
                          </span>
                        )}
                      </span>
                    </span>
                    {st.on && (
                      <span className="flex flex-col gap-1.5 mt-2 ml-6" onClick={e => e.preventDefault()}>
                        <select
                          value={st.operator}
                          onChange={e => setCond(id, { operator: e.target.value })}
                          className={SEL}
                        >
                          {cfg.operators.map(op => <option key={op}>{op}</option>)}
                        </select>
                        {cfg.kind === 'enum' || cfg.kind === 'multi' ? (
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
          title="Do this"
          count={trigger ? `${draft.actions.length} of ${availableActions.length}` : undefined}
        >
          {!trigger ? (
            <Empty>Pick a trigger. What it's allowed to do depends on it.</Empty>
          ) : (
            <>
              {availableActions.map(id => {
                const d = ACTION_BY_ID[id];
                const st = actOf(id);
                return (
                  <label
                    key={id}
                    className={`block px-4 py-2.5 border-b border-gray-100 cursor-pointer transition-colors ${
                      st.on ? 'bg-[#f8fdfe]' : 'hover:bg-[#fafbfb]'
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={st.on}
                        onChange={e => setAct(id, { on: e.target.checked })}
                        className="mt-0.5 shrink-0 accent-[#2A96A8]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm text-[#092E3F]">{d.name}</span>
                          {d.destructive && (
                            <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]">
                              changes the estate
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-[#87999f] mt-0.5 truncate">{d.system}</span>
                      </span>
                    </span>
                    {st.on && d.param && (
                      <span className="block mt-2 ml-6" onClick={e => e.preventDefault()}>
                        {d.param.kind === 'enum' ? (
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
              This automation changes the customer's estate and nothing is holding it back.
              Switch on <strong>Approval</strong> in column 2 if a human should see it first.
            </p>
          </div>
        )}
        <div className="px-4 py-2.5 bg-white border border-[var(--stroke)] rounded-[8px]">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-0.5">In plain english</p>
          <p className="text-sm text-[#092E3F]">{describe(draft)}</p>
        </div>
      </div>
    </div>
  );
}
