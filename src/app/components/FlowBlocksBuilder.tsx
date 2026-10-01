import { useMemo, useState } from 'react';
import { X, Play, ChevronLeft, ShieldAlert, GripVertical, Zap, Filter, Bolt } from 'lucide-react';
import {
  TRIGGERS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  conditionsFor, actionsFor, GROUP_LABEL, describe, makeKey,
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
function PaletteItem({ label, note, flag, onAdd, onDragStart }: {
  label: string; note?: string; flag?: string;
  onAdd: () => void; onDragStart: () => void;
}) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onAdd}
      title="Drag into the flow, or click to add"
      className="w-full text-left px-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px]
                 cursor-grab active:cursor-grabbing hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
    >
      <span className="flex items-center gap-1.5 flex-wrap">
        <GripVertical className="w-3 h-3 text-[#c9d6dc] shrink-0" />
        <span className="text-sm text-[#092E3F]">{label}</span>
        {flag && (
          <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]">
            {flag}
          </span>
        )}
      </span>
      {note && <span className="block text-[11px] text-[#87999f] mt-0.5 ml-[18px]">{note}</span>}
    </button>
  );
}

/** A section of the stack. Highlights while a block it accepts is over it. */
function Slot({ icon: Icon, title, right, active, empty, onDrop, onDragOver, onDragLeave, children }: {
  icon: any; title: string; right?: React.ReactNode; active: boolean; empty?: string;
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <Icon className="w-3.5 h-3.5 text-[#6b828c]" />
        <span className="text-xs font-medium uppercase tracking-wide text-[#6b828c]">{title}</span>
        <span className="ml-auto">{right}</span>
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
}

export default function FlowBlocksBuilder({ flow, onSave, onBack }: Props) {
  const [name, setName] = useState(flow.name);
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

  const freeConditions = availableConditions.filter(id => !conditions.some(c => c.id === id));
  const freeActions = availableActions.filter(id => !actions.some(a => a.action === id));

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
  const hasDestructive = actions.some(a => ACTION_BY_ID[a.action].destructive);
  const hasApproval = conditions.some(c => c.id === 'approval' && c.value);
  const needsApproval = hasDestructive && !hasApproval && availableConditions.includes('approval');

  const save = () => onSave({ ...draft, name: name.trim() || 'Untitled automation' });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-gray-50 to-gray-100" onDragEnd={end}>

      {/* Top bar — name and verbs, so the two panes keep the height */}
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
            disabled={!trigger || actions.length === 0}
            className="h-9 px-4 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                       hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Save automation
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 grid gap-4 grid-cols-1 overflow-y-auto
                      min-[1000px]:grid-cols-[300px_1fr] min-[1000px]:overflow-hidden">

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
                <p className="text-[11px] text-[#87999f]">Add a trigger first — it decides which of these exist.</p>
              ) : freeConditions.length === 0 ? (
                <p className="text-[11px] text-[#87999f]">All {availableConditions.length} are in the flow.</p>
              ) : (
                <div className="space-y-1.5">
                  {freeConditions.map(id => (
                    <PaletteItem
                      key={id}
                      label={CONDITION_BY_ID[id].name}
                      note={CONDITION_BY_ID[id].hint}
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
                <p className="text-[11px] text-[#87999f]">Add a trigger first — it decides what this can do.</p>
              ) : freeActions.length === 0 ? (
                <p className="text-[11px] text-[#87999f]">All {availableActions.length} are in the flow.</p>
              ) : (
                <div className="space-y-1.5">
                  {freeActions.map(id => (
                    <PaletteItem
                      key={id}
                      label={ACTION_BY_ID[id].name}
                      note={ACTION_BY_ID[id].system}
                      flag={ACTION_BY_ID[id].destructive ? 'changes the estate' : undefined}
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
              title="When this happens"
              active={over === 'trigger' && accepts('trigger')}
              empty={trigger ? undefined : 'Drop a trigger here'}
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
              title="Only when"
              active={over === 'condition' && accepts('condition')}
              empty={
                !trigger ? 'Add a trigger first'
                : conditions.length === 0 ? 'Drop a condition here — or leave it empty to run every time'
                : undefined
              }
              right={conditions.length > 1 ? (
                <span className="inline-flex rounded-[8px] bg-[#eef1f3] p-0.5">
                  {(['all', 'any'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMatchAll(m === 'all')}
                      className={`px-2 py-0.5 rounded-[8px] text-[11px] transition-colors ${
                        (m === 'all') === matchAll ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#6b828c]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </span>
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
                      {cfg.kind === 'enum' || cfg.kind === 'multi' ? (
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
              title="Then do this"
              right={actions.length > 1 ? (
                <span className="text-[11px] text-[#87999f]">drag to reorder</span>
              ) : undefined}
              active={over === 'action' && accepts('action')}
              empty={
                !trigger ? 'Add a trigger first'
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
                            {d.destructive && (
                              <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]">
                                changes the estate
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
                          {d.param.kind === 'enum' ? (
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
                  This automation changes the customer's estate and nothing is holding it back.
                  Drag in the <strong>Approval</strong> block if a human should see it first.
                </p>
              </div>
            )}

            <div className="mt-4 px-4 py-2.5 bg-white border border-[var(--stroke)] rounded-[8px]">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-0.5">In plain english</p>
              <p className="text-sm text-[#092E3F]">{describe(draft)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
