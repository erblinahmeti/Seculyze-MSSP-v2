import { useMemo, useState } from 'react';
import { X, ChevronLeft, ShieldAlert, GripVertical, Zap, Filter, Bolt, ScrollText } from 'lucide-react';
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
  type FlowCondition, type FlowAction,
} from './flowRegister';

// ─── Automation builder, version E — blocks ──────────────────────────────────
//
// Drag and drop again, but not the canvas that got called cluttered and
// overwhelming. What went wrong there was the canvas itself: free 2D placement
// makes the user responsible for layout, so they spend their effort arranging
// boxes and drawing arrows instead of deciding what the automation does, and
// every board ends up looking different from the rest of the platform.
//
// Here the drop target is a single vertical stack. The stack *is* the flow, top
// to bottom, so:
//
//   · there are no coordinates — a block is in the flow or it is not;
//   · there are no connectors to draw, because order is the connection;
//   · nothing can overlap, cross or be dragged off-screen;
//   · it reads like the rest of the platform, because it is a list.
//
// Dragging is for the two things dragging is actually good at: putting a block
// in, and moving an action up or down. Everything is clickable too — a palette
// item adds itself on click — because nobody should be forced to drag.
//
// The trigger still governs: the palette only ever offers what the chosen
// trigger allows.

const SEL =
  'h-8 px-2 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] ' +
  'cursor-pointer transition-colors hover:border-[#2A96A8] focus:outline-none focus:border-[#2A96A8]';
const INP =
  'h-8 px-2 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] ' +
  'placeholder:text-[#b7c4c9] transition-colors focus:outline-none focus:border-[#2A96A8]';

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

type Payload =
  | { kind: 'trigger'; id: TriggerId }
  | { kind: 'condition'; id: ConditionId }
  | { kind: 'action'; id: ActionId }
  | { kind: 'move'; index: number };

/** A draggable chip in the palette. Click adds it too — dragging is optional. */
function PaletteItem({ label, note, flag, disabled, onAdd, onDragStart }: {
  label: string; note?: string; flag?: string; disabled?: boolean;
  onAdd: () => void; onDragStart: () => void;
}) {
  return (
    <button
      draggable={!disabled}
      onDragStart={disabled ? undefined : onDragStart}
      onClick={disabled ? undefined : onAdd}
      disabled={disabled}
      title={disabled ? note : 'Drag into the flow, or click to add'}
      className={`w-full text-left px-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px] transition-colors ${
        disabled
          ? 'opacity-45 cursor-not-allowed'
          : 'cursor-grab active:cursor-grabbing hover:border-[#2A96A8] hover:bg-[#f8fdfe]'
      }`}
    >
      <span className="flex items-center gap-1.5 flex-wrap">
        <GripVertical className="w-3 h-3 text-[#c9d6dc] shrink-0" />
        <span className="text-sm text-[#092E3F]">{label}</span>
        {flag && (
          <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
            {flag}
          </span>
        )}
      </span>
      {note && <span className="block text-[11px] text-[#87999f] mt-0.5 ml-[18px]">{note}</span>}
    </button>
  );
}

/** A section of the stack. Highlights while a block it accepts is over it. */
function Slot({ icon: Icon, title, sub, right, active, empty, onDrop, onDragOver, onDragLeave, children }: {
  icon: any; title: string; sub: string; right?: React.ReactNode; active: boolean; empty?: string;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`bg-white border rounded-[8px] transition-colors ${
        active ? 'border-[#2A96A8] bg-[#f8fdfe]' : 'border-[var(--stroke)]'
      }`}
    >
      {/* The term leads, the sentence explains — same as the columns. */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <Icon className="w-3.5 h-3.5 text-[#6b828c] shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-[#6b828c]">{title}</span>
          <span className="block text-[11px] text-[#b7c4c9] leading-tight">{sub}</span>
        </span>
        <span className="ml-auto shrink-0">{right}</span>
      </div>
      <div className="p-3 space-y-2">
        {children}
        {empty && (
          <p className={`text-xs text-center py-4 border border-dashed rounded-[8px] transition-colors ${
            active ? 'border-[#2A96A8] text-[#2A96A8]' : 'border-[#dce3e6] text-[#87999f]'
          }`}>
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

/** The thin line the connector used to be. Order is the connection now. */
function Link() {
  return <div className="w-px h-4 bg-[var(--stroke)] mx-auto" />;
}

interface Props {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
  /** Opens this flow's own log. Absent for a flow that was never saved. */
  onAuditLog?: () => void;
}

export default function FlowBlocksBuilder({ flow, onSave, onBack, onAuditLog }: Props) {
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
  const [conditions, setConditions] = useState<FlowCondition[]>(flow.conditions);
  const [actions, setActions] = useState<FlowAction[]>(flow.actions);

  // Kept in state as well as in dataTransfer, because dragover can't read the
  // payload — and without it no zone could know whether to highlight.
  const [drag, setDrag] = useState<Payload | null>(null);
  const [over, setOver] = useState<'trigger' | 'condition' | 'action' | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const def = trigger ? TRIGGER_BY_ID[trigger] : null;
  const availableConditions = useMemo(() => conditionsFor(trigger), [trigger]);
  const availableActions = useMemo(() => actionsFor(trigger), [trigger]);

  // Everything the register knows, minus the ones already in the flow. What
  // this trigger cannot use stays on the list, greyed, at the bottom — seeing
  // that a condition exists and why it is out of reach beats it being absent.
  const freeConditions = allConditions(trigger).filter(c => !c.available || !conditions.some(x => x.id === c.id));
  const freeActions = allActions(trigger).filter(a => !a.available || !actions.some(x => x.action === a.id));

  const start = (p: Payload) => setDrag(p);
  const end = () => { setDrag(null); setOver(null); setDropAt(null); };

  const pickTrigger = (id: TriggerId) => {
    const keepC = conditionsFor(id), keepA = actionsFor(id);
    setConditions(cs => cs.filter(c => keepC.includes(c.id)));
    setActions(as => as.filter(a => keepA.includes(a.action)));
    setTrigger(id);
  };

  const addCondition = (id: ConditionId) =>
    setConditions(cs => [...cs, { key: makeKey(), id, operator: CONDITION_BY_ID[id].operators[0], value: '' }]);
  const addAction = (id: ActionId, at?: number) =>
    setActions(as => {
      const next = [...as];
      next.splice(at ?? next.length, 0, { key: makeKey(), action: id });
      return next;
    });

  const moveAction = (from: number, to: number) =>
    setActions(as => {
      const next = [...as];
      const [moved] = next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, moved);
      return next;
    });

  const accepts = (zone: 'trigger' | 'condition' | 'action') =>
    drag !== null && (drag.kind === zone || (zone === 'action' && drag.kind === 'move'));

  const allow = (zone: 'trigger' | 'condition' | 'action') => (e: React.DragEvent) => {
    if (!accepts(zone)) return;
    e.preventDefault();
    setOver(zone);
  };

  const draft: Flow = { ...flow, name, trigger, matchAll, conditions, actions };
  const dirty = !sameFlow(draft, flow);

  const hasDestructive = actions.some(a => actionChangesCustomerSystems(a));
  const hasApproval = conditions.some(c => c.id === 'approval' && c.value);
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
    setConditions(flow.conditions);
    setActions(flow.actions);
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
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-50 to-gray-100" onDragEnd={end}>

      {/* Top bar — name and verbs, so the two panes keep the height */}
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
            canReview={!!trigger && actions.length > 0}
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
              disabled={!trigger || actions.length === 0 || !dirty}
              onSave={requestSave}
            />
            </>
          )}
        </div>
        <FlowMode editing={editing} dirty={dirty} isLive={!!flow.isActive} swapKey={swapKey} className="mt-3" />
      </div>

      {/* A real fieldset rather than a pointer-events trick: it disables every
          input, select and button inside it the way the platform already knows
          how to, keyboard and assistive tech included. */}
      <fieldset disabled={!editing} className={`contents ${editing ? '' : LOCKED_FIELDS}`}>
      <div className={`flex-1 min-h-0 px-6 grid gap-4 grid-cols-1 overflow-y-auto
                      min-[1000px]:grid-cols-[300px_1fr] min-[1000px]:overflow-hidden ${swapKey ? 'flow-mode-swap' : ''}`}>

        {/* ── Palette ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col bg-white border border-[var(--stroke)] rounded-[8px] overflow-hidden
                        min-[1000px]:min-h-0">
          <div className="shrink-0 px-4 py-2.5 bg-[#f6f6f6] border-b border-[var(--stroke)]">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6b828c]">Blocks</p>
            <p className="text-[11px] text-[#87999f] mt-0.5">Drag one into the flow, or click it.</p>
          </div>
          <div className="flex-1 p-3 space-y-4 min-[1000px]:min-h-0 min-[1000px]:overflow-y-auto">

            {/* Triggers — always offered, so swapping is one drag */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
                Trigger {trigger && <span className="text-[#c07d1e]">· replaces the current one</span>}
              </p>
              <div className="space-y-3">
                {GROUPS.map(g => (
                  <div key={g}>
                    <p className="text-[10px] text-[#b7c4c9] mb-1">{GROUP_LABEL[g]}</p>
                    <div className="space-y-1.5">
                      {TRIGGERS.filter(t => t.group === g).map(t => (
                        <PaletteItem
                          key={t.id}
                          label={t.name}
                          note={t.source}
                          onAdd={() => pickTrigger(t.id)}
                          onDragStart={() => start({ kind: 'trigger', id: t.id })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">Conditions</p>
              {!trigger ? (
                <p className="text-[11px] text-[#87999f]">Choose a trigger first — it decides which conditions are available.</p>
              ) : (
                <div className="space-y-1.5">
                  {freeConditions.map(({ id, available, reason }) => (
                    <PaletteItem
                      key={id}
                      label={CONDITION_BY_ID[id].name}
                      note={reason ?? CONDITION_BY_ID[id].hint}
                      disabled={!available}
                      onAdd={() => addCondition(id)}
                      onDragStart={() => start({ kind: 'condition', id })}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">Actions</p>
              {!trigger ? (
                <p className="text-[11px] text-[#87999f]">Choose a trigger first — it decides which actions are available.</p>
              ) : (
                <div className="space-y-1.5">
                  {freeActions.map(({ id, available, reason }) => (
                    <PaletteItem
                      key={id}
                      label={ACTION_BY_ID[id].name}
                      note={reason ?? ACTION_BY_ID[id].system}
                      flag={ACTION_BY_ID[id].destructive ? 'changes customer systems' : undefined}
                      disabled={!available}
                      onAdd={() => addAction(id)}
                      onDragStart={() => start({ kind: 'action', id })}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── The flow: one stack, top to bottom ───────────────────────────── */}
        <div className="min-[1000px]:min-h-0 min-[1000px]:overflow-y-auto pb-6">
          <div className="max-w-[640px] mx-auto">

            <Slot
              icon={Zap}
              title="Trigger"
              sub="when this happens"
              active={over === 'trigger' && accepts('trigger')}
              empty={trigger ? undefined : 'Drop a trigger here, or click one on the left'}
              onDragOver={allow('trigger')}
              onDragLeave={() => setOver(null)}
              onDrop={e => {
                e.preventDefault();
                if (drag?.kind === 'trigger') pickTrigger(drag.id);
                end();
              }}
            >
              {trigger && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#092E3F] rounded-[8px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{def!.name}</p>
                    <p className="text-[11px] text-white/60">{def!.source}</p>
                  </div>
                  <button
                    onClick={() => { setTrigger(null); setConditions([]); setActions([]); }}
                    title="Remove the trigger"
                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px]
                               text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Slot>

            <Link />

            <Slot
              icon={Filter}
              title="Conditions"
              sub="only run when"
              active={over === 'condition' && accepts('condition')}
              empty={
                !trigger ? 'Choose a trigger first — it decides what belongs here'
                : conditions.length === 0 ? 'Drop a condition here — or leave it empty to run every time'
                : undefined
              }
              right={conditions.length > 1 ? (
                <MatchToggle
                  triggerName={def!.name}
                  count={conditions.length}
                  matchAll={matchAll}
                  onChange={setMatchAll}
                  className="!leading-5"
                />
              ) : undefined}
              onDragOver={allow('condition')}
              onDragLeave={() => setOver(null)}
              onDrop={e => {
                e.preventDefault();
                if (drag?.kind === 'condition') addCondition(drag.id);
                end();
              }}
            >
              {conditions.map(c => {
                const cfg = CONDITION_BY_ID[c.id];
                return (
                  <div key={c.key} className="px-3 py-2 bg-[#f8fdfe] border border-[var(--stroke)] rounded-[8px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-[#092E3F]">{cfg.name}</span>
                      <button
                        onClick={() => setConditions(cs => cs.filter(x => x.key !== c.key))}
                        title="Remove"
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[8px] text-[#87999f]
                                   hover:bg-[#eef1f3] hover:text-[#092E3F] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={c.operator}
                        onChange={e => setConditions(cs => cs.map(x => x.key === c.key ? { ...x, operator: e.target.value } : x))}
                        className={`${SEL} w-[150px] shrink-0`}
                      >
                        {cfg.operators.map(op => <option key={op}>{op}</option>)}
                      </select>
                      {cfg.kind === 'multi' ? (
                            <MultiSelect
                              value={c.value}
                              onChange={v => setConditions(cs => cs.map(x => x.key === c.key ? { ...x, value: v } : x))}
                              options={cfg.options!}
                              className={`${SEL} flex-1`}
                              dense
                            />
                          ) : cfg.kind === 'enum' ? (
                        <select
                          value={c.value}
                          onChange={e => setConditions(cs => cs.map(x => x.key === c.key ? { ...x, value: e.target.value } : x))}
                          className={`${SEL} flex-1`}
                        >
                          <option value="">Choose…</option>
                          {cfg.options!.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          value={c.value}
                          onChange={e => setConditions(cs => cs.map(x => x.key === c.key ? { ...x, value: e.target.value } : x))}
                          placeholder={cfg.placeholder}
                          className={`${INP} flex-1`}
                        />
                      )}
                    </div>
                    {cfg.hint && (
                      <p className={`text-[11px] mt-1.5 ${cfg.unresolved ? 'text-[#c07d1e]' : 'text-[#87999f]'}`}>
                        {cfg.hint}
                      </p>
                    )}
                  </div>
                );
              })}
            </Slot>

            <Link />

            <Slot
              icon={Bolt}
              title="Actions"
              sub="then do this"
              right={actions.length > 1 ? (
                <span className="text-[11px] text-[#87999f]">drag to reorder</span>
              ) : undefined}
              active={over === 'action' && accepts('action')}
              empty={
                !trigger ? 'Choose a trigger first — it decides what belongs here'
                : actions.length === 0 ? 'Drop an action here'
                : undefined
              }
              onDragOver={allow('action')}
              onDragLeave={() => setOver(null)}
              onDrop={e => {
                e.preventDefault();
                if (drag?.kind === 'action') addAction(drag.id, dropAt ?? undefined);
                else if (drag?.kind === 'move') moveAction(drag.index, dropAt ?? actions.length);
                end();
              }}
            >
              {actions.map((a, i) => {
                const d = ACTION_BY_ID[a.action];
                return (
                  <div key={a.key}>
                    {dropAt === i && drag && (drag.kind === 'action' || drag.kind === 'move') && (
                      <div className="h-0.5 bg-[#2A96A8] rounded-full mb-2" />
                    )}
                    <div
                      draggable
                      onDragStart={() => start({ kind: 'move', index: i })}
                      onDragOver={e => {
                        if (!accepts('action')) return;
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
                        setOver('action');
                      }}
                      className="px-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px]
                                 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-[#c9d6dc] shrink-0" />
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-[8px]
                                         bg-[#eef1f3] text-[10px] font-semibold text-[#5c707a]">
                          {i + 1}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-[#092E3F]">{d.name}</span>
                            {actionChangesCustomerSystems(a) && (
                              <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
                                changes customer systems
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-[#87999f] truncate">{d.system}</span>
                        </span>
                        <button
                          onClick={() => setActions(as => as.filter(x => x.key !== a.key))}
                          title="Remove"
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-[8px] text-[#87999f]
                                     hover:bg-[#eef1f3] hover:text-[#092E3F] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {d.param && (
                        <div className="mt-2 ml-[42px]">
                          {d.param.kind === 'playbook' ? (
                            <PlaybookPicker
                              value={a.param ?? ''}
                              onChange={v => setActions(as => as.map(x => x.key === a.key ? { ...x, param: v } : x))}
                              selectClass={SEL}
                              dense
                            />
                          ) : d.param.kind === 'enum' ? (
                            <select
                              value={a.param ?? ''}
                              onChange={e => setActions(as => as.map(x => x.key === a.key ? { ...x, param: e.target.value } : x))}
                              className={`${SEL} w-full`}
                            >
                              <option value="">Choose…</option>
                              {d.param.options!.map(o => <option key={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              value={a.param ?? ''}
                              onChange={e => setActions(as => as.map(x => x.key === a.key ? { ...x, param: e.target.value } : x))}
                              placeholder={d.param.placeholder}
                              className={`${INP} w-full`}
                            />
                          )}
                        </div>
                      )}
                    </div>
                    {dropAt === i + 1 && i === actions.length - 1 && drag && (drag.kind === 'action' || drag.kind === 'move') && (
                      <div className="h-0.5 bg-[#2A96A8] rounded-full mt-2" />
                    )}
                  </div>
                );
              })}
            </Slot>

            {needsApproval && (
              <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#fdf6e9] border border-[#f0dfbe]">
                <ShieldAlert className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
                <p className="text-xs text-[#8a5a12]">
                  This automation changes systems in the customer's environment and nothing is holding it back.
                  Drag in the <strong>Approval</strong> block if a human should see it first.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      </fieldset>

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
          confirmLabel={flow.isActive ? 'Save changes' : 'Save and set live'}
          onConfirm={() => { setReview(false); save(true); }}
          onClose={() => setReview(false)}
        />
      )}
    </div>
  );
}
