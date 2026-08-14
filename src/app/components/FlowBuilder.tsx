import { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner@2.0.3';
import {
  ArrowLeft, ArrowRight, ArrowDown, Play, Save, X, GripVertical, Plus,
  Zap, Bot, Crosshair, FlaskConical, ShieldCheck, Building2, Filter,
  Layers, FileText, AlertTriangle, Info, Lock,
} from 'lucide-react';
import {
  SoarFlow, FlowAction, FlowCondition, ActionId, ConditionId, GateId, TriggerId, Category,
  ACTIONS, ACTION_BY_ID, CONDITIONS, CONDITION_BY_ID,
  TRIGGERS, TRIGGER_BY_ID, TRIGGER_CLASS_LABEL, TriggerClass,
  PROVIDER_NAMES, ALERT_TYPES, TENANT_NAMES, LOG_SOURCES, REPORT_TYPES,
  SENTINEL_PLAYBOOKS, CATEGORIES,
  permissionFor, BLOCKED_REASON, gatesFor, validateFlow, orderActions,
  wasReordered, simulateFlow, makeKey, categoryFor,
} from './soarData';

const DND_ACTION = 'flow-action';

const CLASS_STYLE: Record<string, { rail: string; bg: string; border: string }> = {
  containment:  { rail: 'bg-[#c2453d]', bg: 'bg-[#f7e6e4]', border: 'border-[#c2453d]/40' },
  playbook:     { rail: 'bg-[#c07d1e]', bg: 'bg-[#f7efdf]', border: 'border-[#c07d1e]/40' },
  ticketing:    { rail: 'bg-[#5c707a]', bg: 'bg-white',     border: 'border-[#c4d2d6]' },
  notification: { rail: 'bg-[#2f7d52]', bg: 'bg-[#e3f0e8]', border: 'border-[#2f7d52]/40' },
  reporting:    { rail: 'bg-[#2A96A8]', bg: 'bg-[#e5f2f4]', border: 'border-[#2A96A8]/50' },
};

// Value options per condition — what the inline select on the canvas offers.
const CONDITION_OPTIONS: Partial<Record<ConditionId, string[]>> = {
  'CO-01': PROVIDER_NAMES,
  'CO-02': ALERT_TYPES,
  'CO-03': ['≥ 0.90', '0.70 – 0.90', '< 0.70'],
  'CO-04': ['TruePositive', 'Undetermined', 'FalsePositive'],
  'CO-05': ['High', 'Medium', 'Low'],
  'CO-06': ['User entity exists', 'Device entity exists', 'User or device entity exists'],
  'CO-07': ['Day 1', 'Day 5', 'Day 15', 'Last day'],
  'CO-08': ['≥ +25% or ≤ −50%', '> 110% of commitment', '> 130% of commitment'],
  'CO-10': LOG_SOURCES,
  'CO-11': REPORT_TYPES,
};

// ─── palette ──────────────────────────────────────────────────────────────────

function PaletteItem({ label, sub, rail, disabled, reason, hint, marker, onAdd }: {
  label: string; sub?: string; rail: string;
  disabled?: boolean; reason?: string; hint?: string; marker?: React.ReactNode; onAdd: () => void;
}) {
  if (disabled) {
    return (
      <div
        title={reason}
        className="relative flex items-start gap-2.5 pl-3.5 pr-3 py-2.5 bg-[#fafbfb] border border-dashed border-[#e5e9eb] rounded-[4px] cursor-not-allowed select-none overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e5e9eb]" />
        <Lock className="w-3.5 h-3.5 text-[#c4d2d6] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#b7c4c9] leading-tight">{label}</p>
          <p className="text-[10px] text-[#c4d2d6] mt-0.5">{hint ?? 'Not available here'}</p>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onAdd}
      title={sub}
      className="relative w-full text-left flex items-start gap-2.5 pl-3.5 pr-3 py-2.5 bg-white border border-[#e5e9eb] rounded-[4px] select-none overflow-hidden hover:border-[#2A96A8]/50 hover:shadow-[0_1px_3px_rgba(9,46,63,0.08)] transition-all group"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${rail}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-[#092E3F] leading-tight">{label}</p>
          {marker}
        </div>
        {sub && <p className="text-[10px] text-[#87999f] mt-0.5 truncate">{sub}</p>}
      </div>
      <Plus className="w-3.5 h-3.5 text-[#c4d2d6] group-hover:text-[#2A96A8] shrink-0 mt-0.5 transition-colors" />
    </button>
  );
}

function PaletteGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 pb-4">
      <p className="text-[10px] font-medium text-[#87999f] uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── canvas blocks ────────────────────────────────────────────────────────────

const TONES = {
  trigger: { rail: 'bg-[#092E3F]', bg: 'bg-white', border: 'border-[#092E3F]/50' },
  agent:   { rail: 'bg-[#2A96A8]', bg: 'bg-[#e5f2f4]', border: 'border-[#2A96A8]/50' },
  cond:    { rail: 'bg-[#5c707a]', bg: 'bg-white', border: 'border-[#c4d2d6]' },
  gate:    { rail: 'bg-[#c07d1e]', bg: 'bg-[#f7efdf]', border: 'border-[#c07d1e]/40' },
  util:    { rail: 'bg-[#87999f]', bg: 'bg-white', border: 'border-[#c4d2d6]' },
};

function Block({ tone, icon: Icon, title, subtitle, meta, selected, onClick, onRemove, children }: {
  tone: keyof typeof TONES; icon: any; title: string; subtitle?: string; meta?: string;
  selected?: boolean; onClick?: () => void; onRemove?: () => void; children?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className={`group relative w-[200px] shrink-0 pl-4 pr-2.5 py-2.5 rounded-[4px] border-2 ${t.bg} ${selected ? 'border-[#092E3F]' : t.border} ${onClick ? 'cursor-pointer' : ''} overflow-hidden transition-all hover:shadow-[0_2px_6px_rgba(9,46,63,0.12)] ${selected ? 'shadow-[0_2px_8px_rgba(9,46,63,0.18)]' : ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${t.rail}`} />
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-[#092E3F]/60 shrink-0" />
          <p className="text-sm font-semibold text-[#092E3F] truncate">{title}</p>
        </div>
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-0.5 text-[#b7c4c9] hover:text-[#c2453d] opacity-0 group-hover:opacity-100 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {subtitle && <p className="text-xs text-[#5c707a] mt-1 truncate">{subtitle}</p>}
      {meta && (
        <p className="flex items-center gap-1 text-[11px] text-[#87999f] mt-1 truncate">
          <Building2 className="w-3 h-3 shrink-0" />{meta}
        </p>
      )}
      {children}
    </div>
  );
}

// A condition is configured in place — no drawer for something this small.
function ConditionBlock({ item, onChange, onRemove }: {
  item: FlowCondition; onChange: (v: string) => void; onRemove: () => void;
}) {
  const def = CONDITION_BY_ID[item.id];
  const base = CONDITION_OPTIONS[item.id] ?? def.examples;
  // A stored value that predates the option list still has to render as itself.
  const opts = item.value && !base.includes(item.value) ? [item.value, ...base] : base;
  return (
    <Block tone="cond" icon={Filter} title={def.name} onRemove={onRemove}>
      <select
        value={item.value}
        onClick={e => e.stopPropagation()}
        onChange={e => onChange(e.target.value)}
        className="mt-1.5 w-full px-2 py-1 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
      >
        <option value="">Any</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {def.requiresTriage && <p className="text-[10px] text-[#87999f] mt-1">From the triage agent</p>}
    </Block>
  );
}

function ActionBlock({ item, index, blocked, selected, onSelect, onRemove, onMove }: {
  item: FlowAction; index: number; blocked: boolean; selected: boolean;
  onSelect: () => void; onRemove: () => void; onMove: (from: number, to: number) => void;
}) {
  const def = ACTION_BY_ID[item.action];
  const style = CLASS_STYLE[def.cls];
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DND_ACTION, item: { index }, collect: m => ({ isDragging: m.isDragging() }),
  }), [index]);
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: DND_ACTION,
    drop: (d: { index: number }) => { if (d.index !== index) onMove(d.index, index); },
    collect: m => ({ isOver: m.isOver() }),
  }), [index, onMove]);

  return (
    <div ref={dropRef}>
      <div
        ref={dragRef}
        onClick={e => { e.stopPropagation(); onSelect(); }}
        className={`group relative w-[200px] shrink-0 pl-4 pr-2.5 py-2.5 rounded-[4px] border-2 cursor-pointer overflow-hidden transition-all hover:shadow-[0_2px_6px_rgba(9,46,63,0.12)] ${
          blocked ? 'bg-[#fafbfb] border-dashed border-[#c2453d]/50' : `${style.bg} ${selected ? 'border-[#092E3F]' : style.border}`
        } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-[#2A96A8]' : ''}`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${blocked ? 'bg-[#c2453d]' : style.rail}`} />
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            {blocked ? <AlertTriangle className="w-4 h-4 text-[#c2453d] shrink-0" /> : <Zap className="w-4 h-4 text-[#092E3F]/60 shrink-0" />}
            <p className={`text-sm font-semibold truncate ${blocked ? 'text-[#c2453d]' : 'text-[#092E3F]'}`}>{def.name}</p>
          </div>
          <div className="flex items-center shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-[#b7c4c9] opacity-0 group-hover:opacity-100 cursor-grab" />
            <button onClick={e => { e.stopPropagation(); onRemove(); }}
              className="p-0.5 text-[#b7c4c9] hover:text-[#c2453d] opacity-0 group-hover:opacity-100 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-[#5c707a] mt-1 truncate">
          {item.params?.channel ?? item.params?.playbook ?? item.params?.system ?? def.platform}
        </p>
        {item.branch && <p className="text-[11px] text-[#c07d1e] mt-1 truncate">Only when {item.branch.toLowerCase()}</p>}
      </div>
    </div>
  );
}

// ─── drawer shell ─────────────────────────────────────────────────────────────

function Drawer({ eyebrow, title, onClose, children }: {
  eyebrow: string; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[480px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">{eyebrow}</p>
            <h2 className="text-white text-base font-semibold leading-snug">{title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">{children}</div>
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors">Done</button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">{children}</p>;
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`relative inline-block w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4caf50]' : 'bg-[#e5e9eb]'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

// ─── trigger drawer — tenants + owner + enrichment ────────────────────────────

function TriggerDrawer({ flow, patch, onClose }: {
  flow: SoarFlow; patch: (p: Partial<SoarFlow>) => void; onClose: () => void;
}) {
  const def = TRIGGER_BY_ID[flow.trigger!];
  const allTenants = flow.clientScope[0] === 'all';
  const on = (n: string) => allTenants || flow.clientScope.includes(n);
  const count = allTenants ? TENANT_NAMES.length : flow.clientScope.length;
  const toggle = (n: string) => {
    const cur = allTenants ? TENANT_NAMES : flow.clientScope;
    const next = cur.includes(n) ? cur.filter(t => t !== n) : [...cur, n];
    patch({ clientScope: next.length === TENANT_NAMES.length ? ['all'] : next });
  };

  return (
    <Drawer eyebrow="Trigger" title={def.block} onClose={onClose}>
      <div className="bg-[#e5f2f4] rounded-[4px] p-3">
        <p className="text-xs text-[#092E3F]/70">{def.source} · {def.cadence}</p>
        <p className="text-xs text-[#092E3F]/70 mt-1.5">{def.note}</p>
      </div>

      {def.triage && (
        <div className="flex items-start justify-between gap-3 border border-[#e5e9eb] rounded-[4px] p-3">
          <div>
            <p className="text-sm font-medium text-[#092E3F]">Enrich before triage</p>
            <p className="text-[11px] text-[#87999f] mt-1">Adds threat intel, asset criticality and recent history. Materially improves confidence quality.</p>
          </div>
          <Toggle on={flow.enrich} onClick={() => patch({ enrich: !flow.enrich })} />
        </div>
      )}

      {!def.triage && (
        <div className="flex items-start justify-between gap-3 border border-[#e5e9eb] rounded-[4px] p-3">
          <div>
            <p className="text-sm font-medium text-[#092E3F]">Group into a digest</p>
            <p className="text-[11px] text-[#87999f] mt-1">Batches related signals into one notification per tenant instead of firing per event.</p>
          </div>
          <Toggle on={flow.aggregate} onClick={() => patch({ aggregate: !flow.aggregate })} />
        </div>
      )}

      <div>
        <FieldLabel>Tenants</FieldLabel>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-[#87999f]">{count} of {TENANT_NAMES.length} included</p>
          {count < TENANT_NAMES.length && (
            <button onClick={() => patch({ clientScope: ['all'] })} className="text-[11px] text-[#2A96A8] hover:underline">Include all</button>
          )}
        </div>
        <div className="border border-[#e5e9eb] rounded-[4px] max-h-56 overflow-y-auto divide-y divide-[#f0f3f4]">
          {TENANT_NAMES.map(n => (
            <div key={n} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-[#092E3F]">{n}</span>
              <Toggle on={on(n)} onClick={() => toggle(n)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Category</FieldLabel>
        <select
          value={flow.category}
          onChange={e => patch({ category: e.target.value as Category })}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
        >
          {CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </Drawer>
  );
}

// ─── safety checks drawer ─────────────────────────────────────────────────────

function GatesDrawer({ flow, patch, onClose }: {
  flow: SoarFlow; patch: (p: Partial<SoarFlow>) => void; onClose: () => void;
}) {
  const applicable = gatesFor(flow.actions.map(a => a.action));
  const cfg = flow.gateConfig;
  const setCfg = (p: Partial<typeof cfg>) => patch({ gateConfig: { ...cfg, ...p } });
  const isOn = (id: GateId) => flow.gates[id] !== false;
  const sel = 'px-2 py-1 bg-white border border-gray-200 rounded-[4px] text-[11px] text-[#092E3F]';

  const thresholds: Partial<Record<GateId, React.ReactNode>> = {
    'GA-01': <select value={cfg.confidence} onChange={e => setCfg({ confidence: Number(e.target.value) })} className={sel}>
      {[0.7, 0.8, 0.9, 0.95].map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}</select>,
    'GA-02': <select value={cfg.approvalSla} onChange={e => setCfg({ approvalSla: Number(e.target.value) })} className={sel}>
      {[5, 15, 30, 60].map(v => <option key={v} value={v}>{v} min</option>)}</select>,
    'GA-03': <span className="flex items-center gap-1 text-[11px] text-[#092E3F]">
      <select value={cfg.maxUsers} onChange={e => setCfg({ maxUsers: Number(e.target.value) })} className={sel}>
        {[1, 3, 5, 10, 20].map(v => <option key={v} value={v}>{v}</option>)}</select> users /
      <select value={cfg.maxDevices} onChange={e => setCfg({ maxDevices: Number(e.target.value) })} className={sel}>
        {[1, 3, 5, 10].map(v => <option key={v} value={v}>{v}</option>)}</select> devices</span>,
    'GA-07': <select value={cfg.cooldownMin} onChange={e => setCfg({ cooldownMin: Number(e.target.value) })} className={sel}>
      <option value={60}>60 min</option><option value={240}>4 hours</option>
      <option value={1440}>1 day</option><option value={10080}>1 week</option></select>,
  };

  return (
    <Drawer eyebrow="Safety checks" title="Before this flow acts" onClose={onClose}>
      <div className="bg-[#e5f2f4] rounded-[4px] p-3">
        <p className="text-xs text-[#092E3F]/70">
          Conditions decide whether a flow is <span className="font-semibold">relevant</span>. These decide whether the platform is <span className="font-semibold">allowed to act</span>. Each says what happens if it fails.
        </p>
      </div>
      <div className="space-y-2">
        {applicable.map(g => {
          const on = isOn(g.id);
          return (
            <div key={g.id} className={`border rounded-[4px] p-3 ${on ? 'border-[#e5e9eb] bg-white' : 'border-[#f0f3f4] bg-[#fafbfb]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-medium ${on ? 'text-[#092E3F]' : 'text-[#87999f]'}`}>{g.name}</p>
                    {g.alwaysOn && <Lock className="w-3 h-3 text-[#87999f]" />}
                  </div>
                  <p className="text-[11px] text-[#87999f] mt-1">{g.note}</p>
                  {on && <p className="text-[11px] text-[#c07d1e] mt-1.5"><span className="font-medium">If it fails:</span> {g.onFail}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Toggle on={on} disabled={g.alwaysOn} onClick={() => patch({ gates: { ...flow.gates, [g.id]: !on } })} />
                  {on && thresholds[g.id]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-[#87999f]">Thresholds are placeholders here and are meant to be set per tenant.</p>
    </Drawer>
  );
}

// ─── action drawer ────────────────────────────────────────────────────────────

function ActionDrawer({ flow, item, patch, onClose }: {
  flow: SoarFlow; item: FlowAction; patch: (p: Partial<FlowAction>) => void; onClose: () => void;
}) {
  const def = ACTION_BY_ID[item.action];
  const gated = flow.trigger ? permissionFor(flow.trigger, item.action) === 'gated' : false;
  const branchOptions = flow.trigger === 'TR-05' ? ['Severity is High', 'Severity is Medium', 'Severity is Low']
    : flow.trigger === 'TR-03' ? ['Deviation sustained 3 days']
    : flow.trigger === 'TR-04' ? ['Overrun > 130%'] : [];

  return (
    <Drawer eyebrow="Action" title={def.name} onClose={onClose}>
      <div className={`rounded-[4px] p-3 ${CLASS_STYLE[def.cls].bg}`}>
        <p className="text-xs text-[#092E3F]/70">{def.note}</p>
        {gated && <p className="text-[11px] text-[#c07d1e] mt-2 font-medium">Runs only after the safety checks pass.</p>}
      </div>

      {def.requiresEntity && (
        <div className="bg-[#f6f6f6] rounded-[4px] p-3">
          <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-1">Target</p>
          <p className="text-xs text-[#092E3F]/70">
            The {def.requiresEntity} from the alert, via {def.platform}. Add the “Entity present on alert” condition or this fails mid-run and leaves partial containment.
          </p>
        </div>
      )}

      {branchOptions.length > 0 && (
        <div>
          <FieldLabel>Only when</FieldLabel>
          <select value={item.branch ?? ''} onChange={e => patch({ branch: e.target.value || undefined })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] focus:outline-none focus:border-[#2A96A8]">
            <option value="">Always</option>
            {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <p className="text-[10px] text-[#87999f] mt-1.5">Lets one flow route by severity instead of splitting into several.</p>
        </div>
      )}

      {item.action === 'AC-08' && (
        <>
          <div>
            <FieldLabel>Channel</FieldLabel>
            <div className="space-y-1">
              {['Email', 'SMS + email', 'ITSM', 'Weekly digest'].map(ch => {
                const smsBlocked = ch === 'SMS + email' && flow.trigger !== 'TR-01' && !(item.branch ?? '').includes('High');
                return (
                  <button key={ch} disabled={smsBlocked}
                    onClick={() => patch({ params: { ...item.params, channel: ch } })}
                    title={smsBlocked ? 'SMS is reserved for High severity or a confirmed true positive' : undefined}
                    className={`w-full text-left px-3 py-2 rounded-[4px] text-xs border transition-colors ${
                      item.params?.channel === ch ? 'bg-[#e5f2f4] border-[#2A96A8]/50 text-[#092E3F] font-medium'
                      : smsBlocked ? 'bg-[#fafbfb] border-[#f0f3f4] text-[#c4d2d6] cursor-not-allowed'
                      : 'bg-white border-[#e5e9eb] text-[#6b828c] hover:border-[#c9d6dc]'}`}>
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel>Recipients</FieldLabel>
            <input value={item.params?.to ?? ''} onChange={e => patch({ params: { ...item.params, to: e.target.value } })}
              placeholder="SOC queue, tenant contact, account owner…"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]" />
          </div>
        </>
      )}

      {item.action === 'AC-06' && (
        <div>
          <FieldLabel>ITSM system</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {['ServiceNow', 'Jira', 'PagerDuty'].map(sys => (
              <button key={sys} onClick={() => patch({ params: { ...item.params, system: sys } })}
                className={`px-4 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                  item.params?.system === sys ? 'bg-[#092E3F] text-white border-[#092E3F]' : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'}`}>
                {sys}
              </button>
            ))}
          </div>
        </div>
      )}

      {item.action === 'AC-07' && (
        <div>
          <FieldLabel>Playbook</FieldLabel>
          <div className="space-y-1.5">
            {SENTINEL_PLAYBOOKS.map(pb => (
              <button key={pb} onClick={() => patch({ params: { ...item.params, playbook: pb } })}
                className={`w-full text-left px-3 py-2 rounded-[4px] text-xs border transition-colors ${
                  item.params?.playbook === pb ? 'bg-[#e5f2f4] border-[#2A96A8]/50 text-[#092E3F] font-medium' : 'bg-white border-[#e5e9eb] text-[#6b828c] hover:border-[#c9d6dc]'}`}>
                {pb}
              </button>
            ))}
          </div>
        </div>
      )}

      {item.action === 'AC-03' && (
        <div>
          <FieldLabel>Isolation mode</FieldLabel>
          <div className="flex gap-2">
            {['Selective', 'Full'].map(m => (
              <button key={m} onClick={() => patch({ params: { ...item.params, mode: m } })}
                className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                  (item.params?.mode ?? 'Selective') === m ? 'bg-[#092E3F] text-white border-[#092E3F]' : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ─── simulate ─────────────────────────────────────────────────────────────────

function SimulateModal({ flow, onClose }: { flow: SoarFlow; onClose: () => void }) {
  const r = simulateFlow(flow);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-[#092E3F] px-6 py-5 flex items-start justify-between">
          <div>
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Dry run · last 30 days</p>
            <h3 className="text-white text-base font-semibold">{flow.name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className={`grid ${r.downgraded > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <div className="bg-[#f6f6f6] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#092E3F]">{r.matched}</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Matched</p>
            </div>
            {r.downgraded > 0 && (
              <div className="bg-[#f7efdf] rounded-[4px] p-3 text-center">
                <p className="text-2xl font-bold text-[#c07d1e]">{r.downgraded}</p>
                <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Downgraded</p>
              </div>
            )}
            <div className="bg-[#e3f0e8] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#2f7d52]">{Math.round(r.minutesSaved / 60)}h</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Analyst time saved</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">What would have run</p>
            <div className="border border-[#e5e9eb] rounded-[4px] divide-y divide-[#f0f3f4]">
              {r.actionsFired.length === 0 && <p className="px-3 py-2.5 text-xs text-[#87999f] italic">No actions on this flow yet.</p>}
              {r.actionsFired.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-[#092E3F]">{a.label}</span>
                  <span className="text-xs font-semibold text-[#092E3F]">×{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-[#e5f2f4] px-6 py-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── builder ──────────────────────────────────────────────────────────────────

type Selection = { kind: 'trigger' } | { kind: 'gates' } | { kind: 'action'; key: string } | null;

export default function FlowBuilder({ flow: initial, onSave, onBack }: {
  flow: SoarFlow; onSave: (f: SoarFlow) => void; onBack: () => void;
}) {
  const [draft, setDraft] = useState<SoarFlow>(() => JSON.parse(JSON.stringify(initial)));
  const [sel, setSel] = useState<Selection>(null);
  const [showSimulate, setShowSimulate] = useState(false);

  const def = draft.trigger ? TRIGGER_BY_ID[draft.trigger] : null;
  const patch = (p: Partial<SoarFlow>) => setDraft(prev => ({ ...prev, ...p }));
  const violations = validateFlow(draft);
  const blocked = violations.filter(v => v.severity === 'blocked');
  const warnings = violations.filter(v => v.severity === 'warning');
  const blockedKeys = new Set(blocked.map(v => v.actionKey).filter(Boolean) as string[]);

  const setTrigger = (t: TriggerId) => {
    const d = TRIGGER_BY_ID[t];
    // A new trigger changes what the flow may read and reach, so anything it
    // can't support is dropped rather than left silently broken.
    const conditions = draft.conditions.filter(c => d.conditions.includes(c.id));
    const actions = draft.actions.filter(a => permissionFor(t, a.action) !== 'blocked');
    const dropped = (draft.conditions.length - conditions.length) + (draft.actions.length - actions.length);
    patch({ trigger: t, category: categoryFor(t), aggregate: d.cls === 'platform' || t === 'TR-05', conditions, actions });
    if (dropped > 0) {
      toast.success(`Switched to ${d.block} — removed ${dropped} block${dropped !== 1 ? 's' : ''} it can't use`);
    }
  };

  const addCondition = (id: ConditionId) =>
    patch({ conditions: [...draft.conditions, { key: makeKey(), id, value: '' }] });
  const setCondition = (key: string, value: string) =>
    patch({ conditions: draft.conditions.map(c => c.key === key ? { ...c, value } : c) });
  const removeCondition = (key: string) =>
    patch({ conditions: draft.conditions.filter(c => c.key !== key) });

  const addAction = (action: ActionId) => {
    const next = orderActions([...draft.actions, { key: makeKey(), action }]);
    patch({ actions: next });
    if (wasReordered(next)) toast.success('Ordered so the password reset runs before the session revoke');
  };
  const removeAction = (key: string) => {
    patch({ actions: draft.actions.filter(a => a.key !== key) });
    if (sel?.kind === 'action' && sel.key === key) setSel(null);
  };
  const patchAction = (key: string, p: Partial<FlowAction>) =>
    patch({ actions: draft.actions.map(a => a.key === key ? { ...a, ...p } : a) });
  const moveAction = (from: number, to: number) => {
    const next = [...draft.actions];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    patch({ actions: orderActions(next) });
  };

  const save = (enable?: boolean) => {
    if (enable && (blocked.length > 0 || !draft.trigger)) {
      toast.error(!draft.trigger ? 'Add a trigger first' : `Can't enable — ${blocked.length} step${blocked.length !== 1 ? 's' : ''} can't run`);
      return;
    }
    const next = enable === undefined ? draft : { ...draft, isActive: enable };
    setDraft(next);
    onSave(next);
    toast.success(enable ? `Flow enabled: ${next.name}` : `Flow saved: ${next.name}`);
  };

  const tenantSummary = draft.clientScope[0] === 'all' ? 'All tenants' : `${draft.clientScope.length} tenants`;
  const activeGates = gatesFor(draft.actions.map(a => a.action)).filter(g => draft.gates[g.id] !== false);
  const showGates = !!def && def.cls !== 'schedule' && draft.actions.length > 0;
  const selectedAction = sel?.kind === 'action' ? draft.actions.find(a => a.key === sel.key) : undefined;
  const usedConditions = new Set(draft.conditions.map(c => c.id));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-[#e5e9eb] px-5 py-3 flex items-center gap-4 shrink-0 flex-wrap">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" /> Flows
          </button>
          <div className="w-px h-6 bg-[#e5e9eb] shrink-0" />
          <input value={draft.name} onChange={e => patch({ name: e.target.value })}
            className="text-sm font-semibold text-[#092E3F] bg-transparent border border-transparent hover:border-[#e5e9eb] focus:border-[#2A96A8] rounded-[4px] px-2 py-1 focus:outline-none min-w-[240px]" />
          {def && <span className="px-2 py-1 rounded-[4px] text-[11px] font-medium bg-[#eef1f3] text-[#5c707a]">{draft.category}</span>}

          <div className="flex-1" />

          {blocked.length > 0 ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium bg-[#f7e6e4] text-[#c2453d]">
              <AlertTriangle className="w-3.5 h-3.5" /> {blocked.length} step{blocked.length !== 1 ? 's' : ''} can’t run
            </span>
          ) : def ? (
            <span className="text-xs text-[#87999f]">Blocked steps: 0</span>
          ) : null}

          <button onClick={() => setShowSimulate(true)} disabled={!def}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <FlaskConical className="w-3.5 h-3.5" /> Test / simulate
          </button>
          <button onClick={() => save()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white transition-colors">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => save(true)} disabled={blocked.length > 0 || !def}
            title={!def ? 'Add a trigger first' : blocked.length > 0 ? 'Fix the blocked steps first' : undefined}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-[#092e3f] text-white hover:bg-[#092e3f]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Play className="w-3.5 h-3.5" /> {draft.isActive ? 'Update & keep enabled' : 'Enable flow'}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">

          {/* Palette — every part of the vocabulary, addable */}
          <div className="w-60 bg-white border-r border-[#e5e9eb] overflow-y-auto shrink-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-[#6b828c] uppercase tracking-widest">Blocks</p>
              <p className="text-[10px] text-[#87999f] mt-1">Click to add to the flow.</p>
            </div>

            {(['alert', 'platform', 'schedule'] as TriggerClass[]).map(cls => (
              <PaletteGroup key={cls} title={`Triggers · ${TRIGGER_CLASS_LABEL[cls].toLowerCase()}`}>
                {TRIGGERS.filter(t => t.cls === cls).map(t => (
                  <PaletteItem
                    key={t.id} label={t.block} sub={t.reach} rail="bg-[#092E3F]"
                    disabled={def?.id === t.id}
                    reason="Already the trigger for this flow"
                    hint="Current trigger"
                    onAdd={() => setTrigger(t.id)}
                  />
                ))}
              </PaletteGroup>
            ))}

            <PaletteGroup title="Conditions">
              {CONDITIONS.filter(c => c.id !== 'CO-09').map(c => {
                const ok = !!def && def.conditions.includes(c.id);
                return (
                  <PaletteItem
                    key={c.id} label={c.name} sub={c.evaluatedOn} rail="bg-[#5c707a]"
                    disabled={!ok || usedConditions.has(c.id)}
                    reason={!def ? 'Add a trigger first' : usedConditions.has(c.id) ? 'Already on this flow' : `${def.name} flows have no ${c.name.toLowerCase()} to read`}
                    hint={!def ? 'Add a trigger first' : usedConditions.has(c.id) ? 'Already added' : 'Not available here'}
                    onAdd={() => addCondition(c.id)}
                  />
                );
              })}
            </PaletteGroup>

            <PaletteGroup title="Actions">
              {ACTIONS.map(a => {
                const perm = def ? permissionFor(def.id, a.id) : 'blocked';
                return (
                  <PaletteItem
                    key={a.id} label={a.name} sub={a.platform} rail={CLASS_STYLE[a.cls].rail}
                    disabled={perm === 'blocked'}
                    reason={!def ? 'Add a trigger first' : `Not available — ${BLOCKED_REASON[def.id]}`}
                    hint={!def ? 'Add a trigger first' : 'Not available here'}
                    marker={perm === 'gated' ? <ShieldCheck className="w-3 h-3 text-[#c07d1e] shrink-0" /> : undefined}
                    onAdd={() => addAction(a.id)}
                  />
                );
              })}
            </PaletteGroup>

            <div className="px-4 pb-5">
              <p className="flex items-start gap-1.5 text-[10px] text-[#87999f]">
                <ShieldCheck className="w-3 h-3 text-[#c07d1e] shrink-0 mt-0.5" />
                Runs only after the safety checks pass.
              </p>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 overflow-auto p-8"
            style={{ backgroundImage: 'radial-gradient(circle, #d3dde0 1px, transparent 1px)', backgroundSize: '22px 22px' }}
            onClick={() => setSel(null)}
          >
            {!def ? (
              <div className="flex items-center gap-3">
                <div className="w-[200px] h-[76px] rounded-[4px] border-2 border-dashed border-[#c4d2d6] bg-white/50 flex flex-col items-center justify-center">
                  <Crosshair className="w-4 h-4 text-[#b7c4c9] mb-1" />
                  <p className="text-[11px] text-[#87999f]">Add a trigger</p>
                </div>
                <p className="text-xs text-[#87999f] max-w-[240px]">
                  Pick what starts this flow from the left. It decides which conditions and actions become available.
                </p>
              </div>
            ) : (
              <div className="flex items-start flex-wrap gap-y-6">
                <Block
                  tone="trigger" icon={Crosshair} title={def.block} subtitle={def.reach} meta={tenantSummary}
                  selected={sel?.kind === 'trigger'} onClick={() => setSel({ kind: 'trigger' })}
                  onRemove={() => patch({ trigger: null, conditions: [], actions: [] })}
                />

                {def.triage && (
                  <>
                    <Connector />
                    <Block
                      tone="agent" icon={Bot}
                      title={def.respond ? 'AI triage & response' : 'AI triage'}
                      subtitle={def.respond ? 'Classifies, then plans' : 'Classifies the alert'}
                      meta={draft.enrich ? 'Enriched first' : undefined}
                      onClick={() => setSel({ kind: 'trigger' })}
                    />
                  </>
                )}

                {draft.aggregate && !def.triage && (
                  <>
                    <Connector />
                    <Block tone="util" icon={Layers} title="Group into a digest" subtitle="One per tenant" onClick={() => setSel({ kind: 'trigger' })} />
                  </>
                )}

                {def.cls === 'schedule' && (
                  <>
                    <Connector />
                    <Block tone="util" icon={FileText} title="Build the report" subtitle="Per-tenant dataset" />
                  </>
                )}

                {draft.conditions.length > 0 && (
                  <>
                    <Connector />
                    <div className="flex flex-col gap-2">
                      {draft.conditions.map((c, i) => (
                        <div key={c.key} className="flex flex-col items-center">
                          {i > 0 && <ArrowDown className="w-4 h-4 my-1 text-[#b7c4c9]" />}
                          <ConditionBlock item={c} onChange={v => setCondition(c.key, v)} onRemove={() => removeCondition(c.key)} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {showGates && (
                  <>
                    <Connector />
                    <Block
                      tone="gate" icon={ShieldCheck} title="Safety checks"
                      subtitle={activeGates.length === 1 ? 'Cooldown only' : `${activeGates.length} checks before acting`}
                      selected={sel?.kind === 'gates'} onClick={() => setSel({ kind: 'gates' })}
                    />
                  </>
                )}

                {draft.actions.length > 0 ? (
                  <>
                    <Connector />
                    <div className="flex flex-col gap-2">
                      {draft.actions.map((a, i) => (
                        <div key={a.key} className="flex flex-col items-center">
                          {i > 0 && <ArrowDown className="w-4 h-4 my-1 text-[#b7c4c9]" />}
                          <ActionBlock
                            item={a} index={i} blocked={blockedKeys.has(a.key)}
                            selected={sel?.kind === 'action' && sel.key === a.key}
                            onSelect={() => setSel({ kind: 'action', key: a.key })}
                            onRemove={() => removeAction(a.key)} onMove={moveAction}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Connector />
                    <div className="w-[200px] h-16 rounded-[4px] border-2 border-dashed border-[#c4d2d6] bg-white/40 flex items-center justify-center">
                      <p className="text-[11px] text-[#87999f]">Add an action</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {(blocked.length > 0 || warnings.length > 0) && (
              <div className="mt-8 max-w-2xl space-y-2">
                {blocked.map((v, i) => (
                  <div key={`b${i}`} className="flex items-start gap-2.5 px-3 py-2.5 bg-[#f7e6e4] border-l-2 border-[#c2453d] rounded-[4px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#c2453d] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#092E3F]/80">{v.message}</p>
                  </div>
                ))}
                {warnings.map((v, i) => (
                  <div key={`w${i}`} className="flex items-start gap-2.5 px-3 py-2.5 bg-[#f7efdf] border-l-2 border-[#c07d1e] rounded-[4px]">
                    <Info className="w-3.5 h-3.5 text-[#c07d1e] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#092E3F]/80">{v.message}</p>
                  </div>
                ))}
              </div>
            )}

            {def && (
              <p className="text-[11px] text-[#87999f] mt-8">
                Click a block to configure it · conditions and actions stack top to bottom · drag an action to reorder.
              </p>
            )}
          </div>
        </div>

        {sel?.kind === 'trigger' && def && <TriggerDrawer flow={draft} patch={patch} onClose={() => setSel(null)} />}
        {sel?.kind === 'gates' && <GatesDrawer flow={draft} patch={patch} onClose={() => setSel(null)} />}
        {selectedAction && (
          <ActionDrawer flow={draft} item={selectedAction} patch={p => patchAction(selectedAction.key, p)} onClose={() => setSel(null)} />
        )}
        {showSimulate && <SimulateModal flow={draft} onClose={() => setShowSimulate(false)} />}
      </div>
    </DndProvider>
  );
}

function Connector() {
  return (
    <div className="flex items-center self-stretch px-0.5">
      <div className="w-8 flex items-center justify-center">
        <ArrowRight className="w-4 h-4 text-[#b7c4c9]" />
      </div>
    </div>
  );
}
