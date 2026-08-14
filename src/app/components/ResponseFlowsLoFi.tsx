import { useState } from 'react';
import {
  SoarFlow, FlowAction, FlowCondition, ActionId, ConditionId, GateId, TriggerId, Category,
  ACTIONS, ACTION_BY_ID, CONDITIONS, CONDITION_BY_ID,
  TRIGGERS, TRIGGER_BY_ID, TRIGGER_CLASS_LABEL, TriggerClass,
  MOCK_FLOWS, PROVIDER_NAMES, ALERT_TYPES, TENANT_NAMES, LOG_SOURCES, REPORT_TYPES,
  SENTINEL_PLAYBOOKS, CATEGORIES,
  permissionFor, BLOCKED_REASON, gatesFor, validateFlow, orderActions,
  blockedCount, emptyFlow, cloneFlow, makeKey, categoryFor,
} from './soarData';

// ─── Low-fidelity prototype ───────────────────────────────────────────────────
// Same data model, same rules, same interactions as the real Response Flows
// page — deliberately stripped to greyscale boxes so usability testers react to
// the structure rather than the styling. Nothing here uses brand colour, icons,
// shadows or rounded corners, and block types are spelled out in words because
// colour coding is not available to carry that meaning.

const LINE = '#c9c9c9';
const INK = '#222';
const MUTE = '#6b6b6b';
const FAINT = '#9b9b9b';

const box: React.CSSProperties = { border: `1px solid ${LINE}`, borderRadius: 2, background: '#fff' };

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: MUTE, border: `1px solid ${LINE}`, borderRadius: 2, padding: '1px 4px', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick, kind = 'default', disabled, title }: {
  children: React.ReactNode; onClick?: () => void;
  kind?: 'default' | 'primary'; disabled?: boolean; title?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        border: `1px solid ${disabled ? LINE : '#8c8c8c'}`,
        borderRadius: 2,
        background: kind === 'primary' && !disabled ? '#333' : '#fff',
        color: disabled ? FAINT : kind === 'primary' ? '#fff' : INK,
        padding: '6px 12px', fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ─── list ─────────────────────────────────────────────────────────────────────

export default function ResponseFlowsLoFi() {
  const [flows, setFlows] = useState<SoarFlow[]>(MOCK_FLOWS);
  const [editing, setEditing] = useState<SoarFlow | null>(null);
  const [picking, setPicking] = useState(false);

  const save = (f: SoarFlow) => {
    setFlows(prev => prev.some(x => x.id === f.id) ? prev.map(x => x.id === f.id ? f : x) : [...prev, f]);
    setEditing(null);
  };

  if (editing) return <LoFiBuilder flow={editing} onSave={save} onBack={() => setEditing(null)} />;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#f4f4f4', color: INK, fontSize: 13 }}>
      <Banner />
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Response Flows</h1>
            <p style={{ color: MUTE, margin: '4px 0 0', fontSize: 12 }}>
              What starts a flow decides what it may ever do.
            </p>
          </div>
          <Btn kind="primary" onClick={() => setPicking(true)}>+ New flow</Btn>
        </div>

        <div style={{ ...box, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}`, background: '#fafafa' }}>
                {['Flow', 'Starts on', 'Only for', 'Tenants', 'Category', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTE, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flows.map(f => {
                const t = f.trigger ? TRIGGER_BY_ID[f.trigger] : null;
                const bad = blockedCount(f);
                return (
                  <tr
                    key={f.id}
                    onClick={() => setEditing(f)}
                    style={{ borderBottom: `1px solid #ededed`, cursor: 'pointer', verticalAlign: 'top' }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                        {f.isPrebuilt && <Tag>template</Tag>}
                        {bad > 0 && <Tag>{bad} blocked</Tag>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {f.actions.map(a => (
                          <span key={a.key} style={{ fontSize: 11, color: MUTE, border: `1px solid ${LINE}`, borderRadius: 2, padding: '1px 5px' }}>
                            {ACTION_BY_ID[a.action].name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>
                      {t ? <>{t.block}<div style={{ color: FAINT, fontSize: 11 }}>{t.reach}</div></> : <span style={{ color: FAINT }}>Not set</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: MUTE }}>
                      {f.conditions.length === 0 ? 'Any' : `${f.conditions.length} condition${f.conditions.length !== 1 ? 's' : ''}`}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: MUTE }}>
                      {f.clientScope[0] === 'all' ? 'All' : `${f.clientScope.length}`}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: MUTE }}>{f.category}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: MUTE }}>{f.isActive ? 'Active' : 'Draft'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: FAINT }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {picking && (
        <NewFlowPicker
          onClose={() => setPicking(false)}
          onBlank={() => { setPicking(false); setEditing(emptyFlow()); }}
          onTemplate={t => { setPicking(false); setEditing(cloneFlow(t, t.name)); }}
        />
      )}
    </div>
  );
}

function Banner() {
  return (
    <div style={{ background: '#e8e8e8', borderBottom: `1px solid ${LINE}`, padding: '6px 24px', fontSize: 11, color: MUTE, letterSpacing: '0.04em' }}>
      LOW-FIDELITY PROTOTYPE — structure and wording only, not visual design
    </div>
  );
}

// ─── new flow picker ──────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ ...box, width: '100%', maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: MUTE }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function NewFlowPicker({ onClose, onBlank, onTemplate }: {
  onClose: () => void; onBlank: () => void; onTemplate: (t: SoarFlow) => void;
}) {
  return (
    <Modal title="New flow" onClose={onClose}>
      <button
        onClick={onBlank}
        style={{ ...box, borderStyle: 'dashed', width: '100%', textAlign: 'left', padding: 14, cursor: 'pointer', marginBottom: 18 }}
      >
        <div style={{ fontWeight: 600, fontSize: 13 }}>Start from scratch</div>
        <div style={{ color: MUTE, fontSize: 11, marginTop: 2 }}>Empty canvas — add a trigger, then conditions and actions.</div>
      </button>

      <div style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: FAINT, marginBottom: 8 }}>
        Or start from a template
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MOCK_FLOWS.map(t => (
          <button
            key={t.id}
            onClick={() => onTemplate(t)}
            style={{ ...box, width: '100%', textAlign: 'left', padding: 10, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
              <Tag>{t.category}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {t.trigger && <Tag>{TRIGGER_BY_ID[t.trigger].block}</Tag>}
              {t.actions.map(a => (
                <span key={a.key} style={{ fontSize: 11, color: MUTE }}>· {ACTION_BY_ID[a.action].name}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ─── builder ──────────────────────────────────────────────────────────────────

const CONDITION_OPTIONS: Partial<Record<ConditionId, string[]>> = {
  'CO-01': PROVIDER_NAMES, 'CO-02': ALERT_TYPES,
  'CO-03': ['≥ 0.90', '0.70 – 0.90', '< 0.70'],
  'CO-04': ['TruePositive', 'Undetermined', 'FalsePositive'],
  'CO-05': ['High', 'Medium', 'Low'],
  'CO-06': ['User entity exists', 'Device entity exists', 'User or device entity exists'],
  'CO-07': ['Day 1', 'Day 5', 'Day 15', 'Last day'],
  'CO-08': ['≥ +25% or ≤ −50%', '> 110% of commitment', '> 130% of commitment'],
  'CO-10': LOG_SOURCES, 'CO-11': REPORT_TYPES,
};

type Sel = { kind: 'trigger' } | { kind: 'gates' } | { kind: 'action'; key: string } | null;

function LoFiBuilder({ flow: initial, onSave, onBack }: {
  flow: SoarFlow; onSave: (f: SoarFlow) => void; onBack: () => void;
}) {
  const [draft, setDraft] = useState<SoarFlow>(() => JSON.parse(JSON.stringify(initial)));
  const [sel, setSel] = useState<Sel>(null);

  const def = draft.trigger ? TRIGGER_BY_ID[draft.trigger] : null;
  const patch = (p: Partial<SoarFlow>) => setDraft(prev => ({ ...prev, ...p }));
  const violations = validateFlow(draft);
  const blocked = violations.filter(v => v.severity === 'blocked');
  const blockedKeys = new Set(blocked.map(v => v.actionKey).filter(Boolean) as string[]);

  const setTrigger = (t: TriggerId) => {
    const d = TRIGGER_BY_ID[t];
    patch({
      trigger: t, category: categoryFor(t),
      aggregate: d.cls === 'platform' || t === 'TR-05',
      conditions: draft.conditions.filter(c => d.conditions.includes(c.id)),
      actions: draft.actions.filter(a => permissionFor(t, a.action) !== 'blocked'),
    });
  };

  const usedConditions = new Set(draft.conditions.map(c => c.id));
  const activeGates = gatesFor(draft.actions.map(a => a.action)).filter(g => draft.gates[g.id] !== false);
  const showGates = !!def && def.cls !== 'schedule' && draft.actions.length > 0;
  const selectedAction = sel?.kind === 'action' ? draft.actions.find(a => a.key === sel.key) : undefined;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f4f4f4', color: INK, fontSize: 13 }}>
      <Banner />

      {/* top bar */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${LINE}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTE, fontSize: 12 }}>‹ Flows</button>
        <input
          value={draft.name}
          onChange={e => patch({ name: e.target.value })}
          style={{ ...box, padding: '5px 8px', fontSize: 13, fontWeight: 600, minWidth: 260 }}
        />
        {def && <Tag>{draft.category}</Tag>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: blocked.length > 0 ? INK : MUTE, fontWeight: blocked.length > 0 ? 600 : 400 }}>
          {blocked.length > 0 ? `⚠ ${blocked.length} step${blocked.length !== 1 ? 's' : ''} can’t run` : 'Blocked steps: 0'}
        </span>
        <Btn onClick={() => onSave(draft)}>Save</Btn>
        <Btn kind="primary" disabled={!def || blocked.length > 0}
          title={!def ? 'Add a trigger first' : blocked.length > 0 ? 'Fix the blocked steps first' : undefined}
          onClick={() => onSave({ ...draft, isActive: true })}>
          Enable flow
        </Btn>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* palette */}
        <div style={{ width: 220, background: '#fff', borderRight: `1px solid ${LINE}`, overflowY: 'auto', padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: FAINT, marginBottom: 2 }}>Blocks</div>
          <div style={{ fontSize: 11, color: FAINT, marginBottom: 12 }}>Click to add.</div>

          {(['alert', 'platform', 'schedule'] as TriggerClass[]).map(cls => (
            <PalGroup key={cls} title={`Triggers · ${TRIGGER_CLASS_LABEL[cls].toLowerCase()}`}>
              {TRIGGERS.filter(t => t.cls === cls).map(t => (
                <PalItem key={t.id} label={t.block} sub={t.reach}
                  disabled={def?.id === t.id} hint="Current trigger"
                  onAdd={() => setTrigger(t.id)} />
              ))}
            </PalGroup>
          ))}

          <PalGroup title="Conditions">
            {CONDITIONS.filter(c => c.id !== 'CO-09').map(c => {
              const ok = !!def && def.conditions.includes(c.id);
              const used = usedConditions.has(c.id);
              return (
                <PalItem key={c.id} label={c.name} sub={c.evaluatedOn}
                  disabled={!ok || used}
                  hint={!def ? 'Add a trigger first' : used ? 'Already added' : 'Not available here'}
                  reason={def && !ok ? `${def.name} flows have no ${c.name.toLowerCase()} to read` : undefined}
                  onAdd={() => patch({ conditions: [...draft.conditions, { key: makeKey(), id: c.id, value: '' }] })} />
              );
            })}
          </PalGroup>

          <PalGroup title="Actions">
            {ACTIONS.map(a => {
              const perm = def ? permissionFor(def.id, a.id) : 'blocked';
              return (
                <PalItem key={a.id} label={a.name} sub={a.platform}
                  disabled={perm === 'blocked'}
                  hint={!def ? 'Add a trigger first' : 'Not available here'}
                  reason={def ? BLOCKED_REASON[def.id] : undefined}
                  tag={perm === 'gated' ? 'checks' : undefined}
                  onAdd={() => patch({ actions: orderActions([...draft.actions, { key: makeKey(), action: a.id }]) })} />
              );
            })}
          </PalGroup>
        </div>

        {/* canvas */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }} onClick={() => setSel(null)}>
          {!def ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ ...box, borderStyle: 'dashed', width: 190, height: 74, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FAINT, fontSize: 12 }}>
                Add a trigger
              </div>
              <p style={{ fontSize: 12, color: MUTE, maxWidth: 240, margin: 0 }}>
                Pick what starts this flow from the left. It decides which conditions and actions become available.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', width: 'max-content' }}>
              <CanvasBlock type="Trigger" title={def.block} sub={def.reach}
                meta={draft.clientScope[0] === 'all' ? 'All tenants' : `${draft.clientScope.length} tenants`}
                selected={sel?.kind === 'trigger'} onClick={() => setSel({ kind: 'trigger' })}
                onRemove={() => patch({ trigger: null, conditions: [], actions: [] })} />

              {def.triage && (
                <>
                  <Arrow />
                  <CanvasBlock type="AI" title={def.respond ? 'AI triage & response' : 'AI triage'}
                    sub={def.respond ? 'Classifies, then plans' : 'Classifies the alert'}
                    meta={draft.enrich ? 'Enriched first' : undefined}
                    onClick={() => setSel({ kind: 'trigger' })} />
                </>
              )}

              {draft.aggregate && !def.triage && (
                <><Arrow /><CanvasBlock type="Group" title="Group into a digest" sub="One per tenant" onClick={() => setSel({ kind: 'trigger' })} /></>
              )}

              {def.cls === 'schedule' && (
                <><Arrow /><CanvasBlock type="Report" title="Build the report" sub="Per-tenant dataset" /></>
              )}

              {draft.conditions.length > 0 && (
                <>
                  <Arrow />
                  <Stack>
                    {draft.conditions.map((c, i) => (
                      <StackItem key={c.key} first={i === 0}>
                        <CondBlock item={c}
                          onChange={v => patch({ conditions: draft.conditions.map(x => x.key === c.key ? { ...x, value: v } : x) })}
                          onRemove={() => patch({ conditions: draft.conditions.filter(x => x.key !== c.key) })} />
                      </StackItem>
                    ))}
                  </Stack>
                </>
              )}

              {showGates && (
                <>
                  <Arrow />
                  <CanvasBlock type="Safety" title="Safety checks"
                    sub={activeGates.length === 1 ? 'Cooldown only' : `${activeGates.length} checks before acting`}
                    selected={sel?.kind === 'gates'} onClick={() => setSel({ kind: 'gates' })} />
                </>
              )}

              <Arrow />
              {draft.actions.length > 0 ? (
                <Stack>
                  {draft.actions.map((a, i) => (
                    <StackItem key={a.key} first={i === 0}>
                      <CanvasBlock
                        type="Action" title={ACTION_BY_ID[a.action].name}
                        sub={a.params?.channel ?? a.params?.system ?? a.params?.playbook ?? ACTION_BY_ID[a.action].platform}
                        note={a.branch ? `Only when ${a.branch.toLowerCase()}` : undefined}
                        warn={blockedKeys.has(a.key)}
                        selected={sel?.kind === 'action' && sel.key === a.key}
                        onClick={() => setSel({ kind: 'action', key: a.key })}
                        onRemove={() => { patch({ actions: draft.actions.filter(x => x.key !== a.key) }); setSel(null); }} />
                    </StackItem>
                  ))}
                </Stack>
              ) : (
                <div style={{ ...box, borderStyle: 'dashed', width: 190, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FAINT, fontSize: 12 }}>
                  Add an action
                </div>
              )}
            </div>
          )}

          {violations.length > 0 && (
            <div style={{ marginTop: 28, maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {violations.map((v, i) => (
                <div key={i} style={{ ...box, borderLeft: `3px solid ${v.severity === 'blocked' ? '#555' : LINE}`, padding: '8px 10px', fontSize: 12, color: MUTE }}>
                  <strong style={{ color: INK }}>{v.severity === 'blocked' ? '⚠ ' : 'ⓘ '}</strong>{v.message}
                </div>
              ))}
            </div>
          )}

          {def && (
            <p style={{ fontSize: 11, color: FAINT, marginTop: 28 }}>
              Click a block to configure it · conditions and actions stack top to bottom.
            </p>
          )}
        </div>
      </div>

      {sel?.kind === 'trigger' && def && <TriggerPanel flow={draft} patch={patch} onClose={() => setSel(null)} />}
      {sel?.kind === 'gates' && <GatesPanel flow={draft} patch={patch} onClose={() => setSel(null)} />}
      {selectedAction && (
        <ActionPanel flow={draft} item={selectedAction}
          patch={p => patch({ actions: draft.actions.map(x => x.key === selectedAction.key ? { ...x, ...p } : x) })}
          onClose={() => setSel(null)} />
      )}
    </div>
  );
}

// ─── canvas pieces ────────────────────────────────────────────────────────────

// Drawn line rather than a glyph, so the canvas reads as one connected flow.
function Arrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', height: 66, flexShrink: 0 }}>
      <div style={{ width: 30, height: 1, background: '#b0b0b0' }} />
      <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid #b0b0b0` }} />
    </div>
  );
}
function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>;
}
function StackItem({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {!first && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 1, height: 12, background: '#b0b0b0' }} />
          <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `6px solid #b0b0b0` }} />
        </div>
      )}
      {children}
    </div>
  );
}

function CanvasBlock({ type, title, sub, meta, note, warn, selected, onClick, onRemove }: {
  type: string; title: string; sub?: string; meta?: string; note?: string;
  warn?: boolean; selected?: boolean; onClick?: () => void; onRemove?: () => void;
}) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      style={{
        ...box, width: 190, padding: '8px 10px', position: 'relative',
        borderWidth: selected || warn ? 2 : 1,
        borderColor: selected ? '#333' : warn ? '#555' : LINE,
        borderStyle: warn ? 'dashed' : 'solid',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: FAINT }}>{type}</span>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: FAINT, fontSize: 13, lineHeight: 1 }}>×</button>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{warn ? '⚠ ' : ''}{title}</div>
      {sub && <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{sub}</div>}
      {meta && <div style={{ fontSize: 11, color: FAINT, marginTop: 2 }}>{meta}</div>}
      {note && <div style={{ fontSize: 11, color: MUTE, marginTop: 3, fontStyle: 'italic' }}>{note}</div>}
    </div>
  );
}

function CondBlock({ item, onChange, onRemove }: {
  item: FlowCondition; onChange: (v: string) => void; onRemove: () => void;
}) {
  const def = CONDITION_BY_ID[item.id];
  const base = CONDITION_OPTIONS[item.id] ?? def.examples;
  const opts = item.value && !base.includes(item.value) ? [item.value, ...base] : base;
  return (
    <div style={{ ...box, width: 190, padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.09em', textTransform: 'uppercase', color: FAINT }}>Condition</span>
        <button onClick={onRemove} style={{ border: 'none', background: 'none', cursor: 'pointer', color: FAINT, fontSize: 13, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>{def.name}</div>
      <select value={item.value} onChange={e => onChange(e.target.value)}
        style={{ ...box, width: '100%', padding: '3px 5px', fontSize: 11 }}>
        <option value="">Any</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── palette pieces ───────────────────────────────────────────────────────────

function PalGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 5 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
}

function PalItem({ label, sub, disabled, hint, reason, tag, onAdd }: {
  label: string; sub?: string; disabled?: boolean; hint?: string; reason?: string;
  tag?: string; onAdd: () => void;
}) {
  if (disabled) {
    return (
      <div title={reason} style={{ ...box, borderStyle: 'dashed', padding: '6px 8px', background: '#fafafa', cursor: 'not-allowed' }}>
        <div style={{ fontSize: 12, color: FAINT, textDecoration: 'line-through' }}>{label}</div>
        <div style={{ fontSize: 10, color: FAINT }}>{hint ?? 'Not available here'}</div>
      </div>
    );
  }
  return (
    <button onClick={onAdd} title={sub} style={{ ...box, padding: '6px 8px', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12 }}>{label}</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {tag && <Tag>{tag}</Tag>}
          <span style={{ color: FAINT, fontSize: 13 }}>+</span>
        </span>
      </div>
      {sub && <div style={{ fontSize: 10, color: FAINT, marginTop: 1 }}>{sub}</div>}
    </button>
  );
}

// ─── side panels ──────────────────────────────────────────────────────────────

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <div style={{ position: 'relative', width: 420, height: '100%', background: '#fff', borderLeft: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: MUTE }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
        <div style={{ padding: 12, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn kind="primary" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTE, marginBottom: 6 }}>{children}</div>;
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ ...box, padding: '2px 8px', fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer', color: on ? INK : FAINT, background: on ? '#ececec' : '#fff', minWidth: 46 }}>
      {on ? 'ON' : 'OFF'}
    </button>
  );
}

function TriggerPanel({ flow, patch, onClose }: {
  flow: SoarFlow; patch: (p: Partial<SoarFlow>) => void; onClose: () => void;
}) {
  const def = TRIGGER_BY_ID[flow.trigger!];
  const all = flow.clientScope[0] === 'all';
  const on = (n: string) => all || flow.clientScope.includes(n);
  const toggle = (n: string) => {
    const cur = all ? TENANT_NAMES : flow.clientScope;
    const next = cur.includes(n) ? cur.filter(t => t !== n) : [...cur, n];
    patch({ clientScope: next.length === TENANT_NAMES.length ? ['all'] : next });
  };
  return (
    <Panel title={`Trigger — ${def.block}`} onClose={onClose}>
      <div style={{ ...box, background: '#fafafa', padding: 10, fontSize: 12, color: MUTE }}>
        {def.source} · {def.cadence}
        <div style={{ marginTop: 6 }}>{def.note}</div>
      </div>

      <div style={{ ...box, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{def.triage ? 'Enrich before triage' : 'Group into a digest'}</div>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>
            {def.triage ? 'Adds threat intel, asset criticality and recent history.' : 'One notification per tenant instead of per event.'}
          </div>
        </div>
        {def.triage
          ? <Switch on={flow.enrich} onClick={() => patch({ enrich: !flow.enrich })} />
          : <Switch on={flow.aggregate} onClick={() => patch({ aggregate: !flow.aggregate })} />}
      </div>

      <div>
        <Label>Tenants — {all ? TENANT_NAMES.length : flow.clientScope.length} of {TENANT_NAMES.length}</Label>
        <div style={{ ...box, maxHeight: 220, overflowY: 'auto' }}>
          {TENANT_NAMES.map(n => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', borderBottom: `1px solid #f0f0f0` }}>
              <span style={{ fontSize: 12 }}>{n}</span>
              <Switch on={on(n)} onClick={() => toggle(n)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Category</Label>
        <select value={flow.category} onChange={e => patch({ category: e.target.value as Category })}
          style={{ ...box, width: '100%', padding: '5px 8px', fontSize: 12 }}>
          {CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </Panel>
  );
}

function GatesPanel({ flow, patch, onClose }: {
  flow: SoarFlow; patch: (p: Partial<SoarFlow>) => void; onClose: () => void;
}) {
  const applicable = gatesFor(flow.actions.map(a => a.action));
  const cfg = flow.gateConfig;
  const setCfg = (p: Partial<typeof cfg>) => patch({ gateConfig: { ...cfg, ...p } });
  const isOn = (id: GateId) => flow.gates[id] !== false;
  const s: React.CSSProperties = { ...box, padding: '2px 5px', fontSize: 11 };

  const thresholds: Partial<Record<GateId, React.ReactNode>> = {
    'GA-01': <select value={cfg.confidence} onChange={e => setCfg({ confidence: Number(e.target.value) })} style={s}>
      {[0.7, 0.8, 0.9, 0.95].map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}</select>,
    'GA-02': <select value={cfg.approvalSla} onChange={e => setCfg({ approvalSla: Number(e.target.value) })} style={s}>
      {[5, 15, 30, 60].map(v => <option key={v} value={v}>{v} min</option>)}</select>,
    'GA-03': <select value={cfg.maxUsers} onChange={e => setCfg({ maxUsers: Number(e.target.value) })} style={s}>
      {[1, 3, 5, 10, 20].map(v => <option key={v} value={v}>{v} users</option>)}</select>,
    'GA-07': <select value={cfg.cooldownMin} onChange={e => setCfg({ cooldownMin: Number(e.target.value) })} style={s}>
      <option value={60}>60 min</option><option value={240}>4 hours</option>
      <option value={1440}>1 day</option><option value={10080}>1 week</option></select>,
  };

  return (
    <Panel title="Safety checks" onClose={onClose}>
      <div style={{ ...box, background: '#fafafa', padding: 10, fontSize: 12, color: MUTE }}>
        Conditions decide whether a flow is relevant. These decide whether the platform is allowed to act.
      </div>
      {applicable.map(g => {
        const on = isOn(g.id);
        return (
          <div key={g.id} style={{ ...box, padding: 10, background: on ? '#fff' : '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: on ? INK : FAINT }}>
                  {g.name}{g.alwaysOn ? ' (always on)' : ''}
                </div>
                <div style={{ fontSize: 11, color: MUTE, marginTop: 3 }}>{g.note}</div>
                {on && <div style={{ fontSize: 11, color: INK, marginTop: 5 }}><strong>If it fails:</strong> {g.onFail}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <Switch on={on} disabled={g.alwaysOn} onClick={() => patch({ gates: { ...flow.gates, [g.id]: !on } })} />
                {on && thresholds[g.id]}
              </div>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

function ActionPanel({ flow, item, patch, onClose }: {
  flow: SoarFlow; item: FlowAction; patch: (p: Partial<FlowAction>) => void; onClose: () => void;
}) {
  const def = ACTION_BY_ID[item.action];
  const gated = flow.trigger ? permissionFor(flow.trigger, item.action) === 'gated' : false;
  const branches = flow.trigger === 'TR-05' ? ['Severity is High', 'Severity is Medium', 'Severity is Low']
    : flow.trigger === 'TR-03' ? ['Deviation sustained 3 days']
    : flow.trigger === 'TR-04' ? ['Overrun > 130%'] : [];
  const s: React.CSSProperties = { ...box, width: '100%', padding: '5px 8px', fontSize: 12 };

  return (
    <Panel title={`Action — ${def.name}`} onClose={onClose}>
      <div style={{ ...box, background: '#fafafa', padding: 10, fontSize: 12, color: MUTE }}>
        {def.note}
        {gated && <div style={{ marginTop: 6, color: INK }}>Runs only after the safety checks pass.</div>}
      </div>

      {def.requiresEntity && (
        <div style={{ ...box, padding: 10, fontSize: 12, color: MUTE }}>
          <Label>Target</Label>
          The {def.requiresEntity} from the alert. The flow must check that entity is present, or this fails mid-run.
        </div>
      )}

      {branches.length > 0 && (
        <div>
          <Label>Only when</Label>
          <select value={item.branch ?? ''} onChange={e => patch({ branch: e.target.value || undefined })} style={s}>
            <option value="">Always</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {item.action === 'AC-08' && (
        <>
          <div>
            <Label>Channel</Label>
            <select value={item.params?.channel ?? ''} onChange={e => patch({ params: { ...item.params, channel: e.target.value } })} style={s}>
              <option value="">Choose…</option>
              {['Email', 'SMS + email', 'ITSM', 'Weekly digest'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Recipients</Label>
            <input value={item.params?.to ?? ''} onChange={e => patch({ params: { ...item.params, to: e.target.value } })}
              placeholder="SOC queue, tenant contact…" style={s} />
          </div>
        </>
      )}

      {item.action === 'AC-06' && (
        <div>
          <Label>ITSM system</Label>
          <select value={item.params?.system ?? ''} onChange={e => patch({ params: { ...item.params, system: e.target.value } })} style={s}>
            <option value="">Choose…</option>
            {['ServiceNow', 'Jira', 'PagerDuty'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      )}

      {item.action === 'AC-07' && (
        <div>
          <Label>Playbook</Label>
          <select value={item.params?.playbook ?? ''} onChange={e => patch({ params: { ...item.params, playbook: e.target.value } })} style={s}>
            <option value="">Choose…</option>
            {SENTINEL_PLAYBOOKS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {item.action === 'AC-03' && (
        <div>
          <Label>Isolation mode</Label>
          <select value={item.params?.mode ?? 'Selective'} onChange={e => patch({ params: { ...item.params, mode: e.target.value } })} style={s}>
            {['Selective', 'Full'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}
    </Panel>
  );
}
