import { useMemo, useState } from 'react';
import { X, Plus, Play, ChevronLeft, ShieldAlert } from 'lucide-react';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITIONS, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, GROUP_LABEL, GROUP_LIMIT_REASON, describe, makeKey,
  type Flow, type Group, type TriggerId, type ConditionId, type ActionId,
  type FlowCondition, type FlowAction,
} from './flowRegister';

// ─── Flow builder, as a form ─────────────────────────────────────────────────
//
// Replaces the drag-and-drop canvas. A flow is one trigger, a list of
// conditions and a list of actions — read straight off the SOAR flow sheet.
//
// The rule that shapes the whole screen: the trigger decides what else is even
// offered. A condition that cannot be evaluated for the chosen trigger is not
// disabled or greyed — it is absent. Same for actions the trigger's group has
// no business reaching. Nothing in a dropdown is ever un-pickable, so there is
// nothing to wonder about.
//
// One trigger per flow, and changing it is deliberate: you clear the current
// one first, because changing it underneath a built rule silently invalidates
// the conditions and actions that were chosen for it.

const SEL =
  'h-9 px-2.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] ' +
  'cursor-pointer transition-colors hover:border-[#2A96A8] focus:outline-none focus:border-[#2A96A8]';
const INP =
  'h-9 px-2.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] ' +
  'placeholder:text-[#b7c4c9] transition-colors focus:outline-none focus:border-[#2A96A8]';
const CARD = 'bg-white border border-[var(--stroke)] rounded-[8px] p-5';

/** The pill label that sits on the connector between two cards. */
function Step({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <span className="w-px h-4 bg-[var(--stroke)]" />
      <span className="px-3 py-1 rounded-[8px] bg-[#eef1f3] text-xs font-medium text-[#495565]">
        {children}
      </span>
      <span className="w-px h-4 bg-[var(--stroke)]" />
    </div>
  );
}

function IconX({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] text-[#87999f]
                 hover:bg-[#f1f4f5] hover:text-[#092E3F] transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  );
}

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

interface Props {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
}

export default function FlowRuleBuilder({ flow, onSave, onBack }: Props) {
  const [name, setName] = useState(flow.name);
  const [trigger, setTrigger] = useState<TriggerId | null>(flow.trigger);
  const [triggerParam, setTriggerParam] = useState(flow.triggerParam ?? '');
  const [matchAll, setMatchAll] = useState(flow.matchAll);
  const [conditions, setConditions] = useState<FlowCondition[]>(flow.conditions);
  const [actions, setActions] = useState<FlowAction[]>(flow.actions);
  const [dropped, setDropped] = useState<string[]>([]);

  const def = trigger ? TRIGGER_BY_ID[trigger] : null;

  // The two lists the trigger governs. Everything downstream reads these.
  const availableConditions = useMemo(() => conditionsFor(trigger), [trigger]);
  const availableActions = useMemo(() => actionsFor(trigger), [trigger]);

  /**
   * Clearing the trigger clears the automation with it. Conditions and actions were
   * chosen against a trigger that no longer applies, and silently keeping the
   * ones that happen to still validate is worse than starting clean — the user
   * would have no idea which survived.
   */
  const clearTrigger = () => {
    setTrigger(null);
    setTriggerParam('');
    setConditions([]);
    setActions([]);
    setDropped([]);
  };

  const pickTrigger = (id: TriggerId) => {
    setTrigger(id);
    setTriggerParam('');
    // Within a group nothing is lost; across groups almost everything is.
    const keepC = conditionsFor(id);
    const keepA = actionsFor(id);
    setDropped([
      ...conditions.filter(c => !keepC.includes(c.id)).map(c => CONDITION_BY_ID[c.id].name),
      ...actions.filter(a => !keepA.includes(a.action)).map(a => ACTION_BY_ID[a.action].name),
    ]);
    setConditions(conditions.filter(c => keepC.includes(c.id)));
    setActions(actions.filter(a => keepA.includes(a.action)));
  };

  const addCondition = () => {
    const next =
      availableConditions.find(id => !conditions.some(c => c.id === id)) ?? availableConditions[0];
    if (!next) return;
    setConditions(cs => [
      ...cs,
      { key: makeKey(), id: next, operator: CONDITION_BY_ID[next].operators[0], value: '' },
    ]);
  };
  const setCondition = (key: string, patch: Partial<FlowCondition>) =>
    setConditions(cs => cs.map(c => (c.key === key ? { ...c, ...patch } : c)));

  const addAction = () => {
    const next = availableActions.find(id => !actions.some(a => a.action === id)) ?? availableActions[0];
    if (!next) return;
    setActions(as => [...as, { key: makeKey(), action: next }]);
  };
  const setAction = (key: string, patch: Partial<FlowAction>) =>
    setActions(as => as.map(a => (a.key === key ? { ...a, ...patch } : a)));

  const draft: Flow = { ...flow, name, trigger, triggerParam, matchAll, conditions, actions };

  // Every trigger in the alert group can reach every action, including the
  // destructive ones — so authority has to come from the Approval condition
  // instead. Say so where the choice is being made, not in a save-time error.
  const hasDestructive = actions.some(a => ACTION_BY_ID[a.action].destructive);
  const hasApproval = conditions.some(c => c.id === 'approval' && c.value);
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
          <h1 className="text-xl font-semibold text-[#092E3F] text-center mb-6">
            {flow.name ? 'Edit automation' : 'Create automation'}
          </h1>

          {/* Name */}
          <div className={CARD}>
            <label className="block text-sm font-medium text-[#092E3F] mb-1.5">Automation name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Auto-close Defender malware"
              className={`${INP} w-full`}
            />
          </div>

          <Step>Trigger automation when</Step>

          {/* Trigger — exactly one. Swap it by clearing it. */}
          <div className={CARD}>
            {!trigger ? (
              <select
                value=""
                onChange={e => pickTrigger(e.target.value as TriggerId)}
                className={`${SEL} w-full`}
              >
                <option value="" disabled>Choose a trigger…</option>
                {GROUPS.map(g => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {TRIGGERS.filter(t => t.group === g).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-9 px-3 flex items-center bg-[#f6f6f6] border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]">
                    {def!.name}
                  </span>
                  <IconX onClick={clearTrigger} title="Remove the trigger to choose a different one" />
                </div>
                <p className="text-xs text-[#6b828c] mt-2">{def!.source}</p>
                {dropped.length > 0 && (
                  <p className="text-xs text-[#c07d1e] mt-2">
                    Removed, because this trigger can't use them: {dropped.join(', ')}
                  </p>
                )}
              </>
            )}
          </div>

          <Step>
            {trigger ? (
              <span className="flex items-center gap-2">
                Only when
                <span className="inline-flex rounded-[8px] bg-white border border-[var(--stroke)] overflow-hidden">
                  {(['all', 'any'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMatchAll(m === 'all')}
                      className={`px-2 py-0.5 text-xs transition-colors ${
                        (m === 'all') === matchAll ? 'bg-[#2A96A8] text-white' : 'text-[#6b828c]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </span>
                of these match
              </span>
            ) : 'Only when these match'}
          </Step>

          {/* Conditions — only those the trigger can evaluate */}
          <div className={CARD}>
            {!trigger ? (
              <p className="text-sm text-[#6b828c]">
                Pick a trigger first. Which conditions are available depends on it.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {conditions.map(c => {
                    const cfg = CONDITION_BY_ID[c.id];
                    return (
                      <div key={c.key}>
                        <div className="flex items-center gap-2">
                          <select
                            value={c.id}
                            onChange={e => {
                              const id = e.target.value as ConditionId;
                              setCondition(c.key, { id, operator: CONDITION_BY_ID[id].operators[0], value: '' });
                            }}
                            className={`${SEL} w-[190px] shrink-0`}
                          >
                            {availableConditions.map(id => (
                              <option key={id} value={id}>{CONDITION_BY_ID[id].name}</option>
                            ))}
                          </select>

                          <select
                            value={c.operator}
                            onChange={e => setCondition(c.key, { operator: e.target.value })}
                            className={`${SEL} w-[170px] shrink-0`}
                          >
                            {cfg.operators.map(op => <option key={op}>{op}</option>)}
                          </select>

                          {cfg.kind === 'enum' || cfg.kind === 'multi' ? (
                            <select
                              value={c.value}
                              onChange={e => setCondition(c.key, { value: e.target.value })}
                              className={`${SEL} flex-1`}
                            >
                              <option value="">Choose…</option>
                              {cfg.options!.map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              value={c.value}
                              onChange={e => setCondition(c.key, { value: e.target.value })}
                              placeholder={cfg.placeholder}
                              className={`${INP} flex-1`}
                            />
                          )}

                          <IconX
                            onClick={() => setConditions(cs => cs.filter(x => x.key !== c.key))}
                            title="Remove condition"
                          />
                        </div>
                        {cfg.hint && (
                          <p className={`text-xs mt-1 ml-[2px] ${cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#6b828c]'}`}>
                            {cfg.hint}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addCondition}
                  className="mt-3 w-9 h-9 flex items-center justify-center rounded-[8px] border border-[var(--stroke)]
                             text-[#2A96A8] hover:border-[#2A96A8] transition-colors"
                  title="Add a condition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <p className="text-xs text-[#6b828c] mt-2">
                  {availableConditions.length} of {CONDITIONS.length} conditions apply to this trigger.
                </p>
              </>
            )}
          </div>

          <Step>Then do this</Step>

          {/* Actions — only those this trigger's group can reach */}
          <div className={CARD}>
            {!trigger ? (
              <p className="text-sm text-[#6b828c]">Pick a trigger first.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {actions.map(a => {
                    const d = ACTION_BY_ID[a.action];
                    return (
                      <div key={a.key} className="flex items-center gap-2">
                        <select
                          value={a.action}
                          onChange={e => setAction(a.key, { action: e.target.value as ActionId, param: '' })}
                          className={`${SEL} w-[230px] shrink-0`}
                        >
                          {availableActions.map(id => (
                            <option key={id} value={id}>{ACTION_BY_ID[id].name}</option>
                          ))}
                        </select>

                        {d.param ? (
                          d.param.kind === 'enum' ? (
                            <select
                              value={a.param ?? ''}
                              onChange={e => setAction(a.key, { param: e.target.value })}
                              className={`${SEL} flex-1`}
                            >
                              <option value="">Choose…</option>
                              {d.param.options!.map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              value={a.param ?? ''}
                              onChange={e => setAction(a.key, { param: e.target.value })}
                              placeholder={d.param.placeholder}
                              className={`${INP} flex-1`}
                            />
                          )
                        ) : (
                          // No parameter to set, so the row shows where the
                          // action actually runs — the sheet's "from which
                          // action system" column, which is FYI, not a phase.
                          <span className="flex-1 text-sm text-[#6b828c] truncate">{d.system}</span>
                        )}

                        {d.destructive && (
                          <span className="px-2 py-0.5 rounded-[8px] text-xs bg-[#f7efdf] text-[#c07d1e] shrink-0">
                            changes the estate
                          </span>
                        )}
                        <IconX
                          onClick={() => setActions(as => as.filter(x => x.key !== a.key))}
                          title="Remove action"
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={addAction}
                  className="mt-3 w-9 h-9 flex items-center justify-center rounded-[8px] border border-[var(--stroke)]
                             text-[#2A96A8] hover:border-[#2A96A8] transition-colors"
                  title="Add an action"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {/* The unavailable actions are absent from the dropdown, so the
                    reason goes here rather than on an un-pickable option. */}
                <p className="text-xs text-[#6b828c] mt-2">
                  {availableActions.length} actions available for this trigger. {GROUP_LIMIT_REASON[def!.group]}
                </p>

                {needsApproval && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#fdf6e9] border border-[#f0dfbe]">
                    <ShieldAlert className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#8a5a12]">
                      This automation changes the customer's estate and nothing is holding it back.
                      Every alert trigger can reach every action, so add an <strong>Approval</strong> condition
                      if a human should see it first.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Readback */}
          <div className="mt-4 px-4 py-3 bg-white border border-[var(--stroke)] rounded-[8px]">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1">In plain english</p>
            <p className="text-sm text-[#092E3F]">{describe(draft)}</p>
          </div>

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
                disabled={!trigger || actions.length === 0}
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
