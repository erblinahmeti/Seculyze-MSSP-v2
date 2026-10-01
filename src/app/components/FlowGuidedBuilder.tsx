import { useMemo, useState } from 'react';
import { Check, ChevronLeft, Play, ShieldAlert, RotateCcw } from 'lucide-react';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, GROUP_LABEL, describe, makeKey,
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
}

export default function FlowGuidedBuilder({ flow, onSave, onBack }: Props) {
  const [name, setName] = useState(flow.name);
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
  const hasDestructive = draft.actions.some(a => ACTION_BY_ID[a.action].destructive);
  const hasApproval = draft.conditions.some(c => c.id === 'approval' && c.value);
  const needsApproval = hasDestructive && !hasApproval && availableConditions.includes('approval');

  const save = () => onSave({ ...draft, name: name.trim() || 'Untitled automation' });

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />Back to flows
        </button>

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
                    {availableConditions.map(id => {
                      const cfg = CONDITION_BY_ID[id];
                      const st = condOf(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            st.on ? 'bg-[#f8fdfe]' : 'hover:bg-[#fafbfb]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={st.on}
                            onChange={e => setCond(id, { on: e.target.checked })}
                            className="mt-0.5 shrink-0 accent-[#2A96A8]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#092E3F]">{cfg.name}</p>
                            {cfg.hint && (
                              <p className={`text-xs mt-0.5 ${cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#87999f]'}`}>
                                {cfg.hint}
                              </p>
                            )}

                            {st.on && (
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
                                {cfg.kind === 'enum' || cfg.kind === 'multi' ? (
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
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-xs text-[#6b828c]">Run when</span>
                    <span className="inline-flex rounded-[8px] bg-white border border-[var(--stroke)] overflow-hidden">
                      {(['all', 'any'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setMatchAll(m === 'all')}
                          className={`px-2.5 py-1 text-xs transition-colors ${
                            (m === 'all') === matchAll ? 'bg-[#2A96A8] text-white' : 'text-[#6b828c] hover:text-[#092E3F]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </span>
                    <span className="text-xs text-[#6b828c]">of these are true</span>
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
                  {availableActions.map(id => {
                    const d = ACTION_BY_ID[id];
                    const st = actOf(id);
                    return (
                      <label
                        key={id}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-[8px] border cursor-pointer transition-colors ${
                          st.on
                            ? 'bg-[#f8fdfe] border-[#2A96A8]'
                            : 'bg-white border-[var(--stroke)] hover:border-[#b7c4c9]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={st.on}
                          onChange={e => setAct(id, { on: e.target.checked })}
                          className="mt-0.5 shrink-0 accent-[#2A96A8]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-[#092E3F]">{d.name}</span>
                            {d.destructive && (
                              <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]">
                                changes the estate
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#87999f] mt-0.5 truncate">{d.system}</p>

                          {st.on && d.param && (
                            <div className="mt-2" onClick={e => e.preventDefault()}>
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
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {needsApproval && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#fdf6e9] border border-[#f0dfbe]">
                    <ShieldAlert className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#8a5a12]">
                      This automation changes the customer's estate and nothing is holding it back.
                      Switch on <strong>Approval</strong> in step 2 if a human should see it first.
                    </p>
                  </div>
                )}
              </Question>

              {/* 4 — the name, asked last, once there is something to name. */}
              <Question n={4} title="Name it" sub="So it's recognisable in the list.">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Auto-close Defender malware"
                  className={`${INP} w-full`}
                />
                <div className="mt-3 px-4 py-3 bg-white border border-[var(--stroke)] rounded-[8px]">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1">
                    In plain english
                  </p>
                  <p className="text-sm text-[#092E3F]">{describe(draft)}</p>
                </div>
              </Question>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-5 mb-10">
            <button
              disabled={!trigger}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--stroke)] rounded-[8px]
                         text-sm text-[#092E3F] hover:border-[#2A96A8] transition-colors
                         disabled:opacity-40 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4" />Test on last 30 days
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                           hover:border-[#2A96A8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!trigger || chosenActions === 0}
                className="px-4 py-2 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                           hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Save automation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
