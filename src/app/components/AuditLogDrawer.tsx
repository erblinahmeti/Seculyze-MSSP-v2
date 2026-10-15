import { useEffect, useMemo, useState } from 'react';
import {
  X, Search, Download, ScrollText, ExternalLink, Bot, UserCheck,
  CheckCircle2, XCircle, MinusCircle, Clock, Ban, ShieldCheck,
  User, Monitor, Globe, Mail, FileWarning, Network, Building2,
} from 'lucide-react';
import {
  AUDIT_LOG, ENTITY_LABEL, STEP_LABEL, stepName, fmtDuration, triggerName,
  type AuditEntry, type StepStatus, type Entity, type EntityKind,
} from './flowRuns';

// ─── Audit log drawer ────────────────────────────────────────────────────────
//
// The log, where the flows are. Opening a separate page to answer "what has
// this flow actually been doing" loses your place in the list, so this slides
// over instead and closes again.
//
// One entry per automated action, carrying the seven things an audit entry has
// to have: flow, trigger, entity, action, outcome, timestamp and author. None
// of them is optional here — an action with no named entity still says which
// incident it ran on, and an action nobody approved is attributed to the
// automation rather than left blank.
//
// It opens scoped when you ask it from a flow's row menu, because that is the
// question you were asking when you clicked.

const ENTITY_ICON: Record<EntityKind, any> = {
  user: User, device: Monitor, ip: Network, mailbox: Mail,
  file: FileWarning, domain: Globe, tenant: Building2,
};

const STATUS_ICON: Record<StepStatus, { icon: any; tint: string }> = {
  succeeded: { icon: CheckCircle2, tint: 'text-[#2f7d52]' },
  failed: { icon: XCircle, tint: 'text-[#c2453d]' },
  skipped: { icon: MinusCircle, tint: 'text-[#b7c4c9]' },
  'awaiting-approval': { icon: Clock, tint: 'text-[#c07d1e]' },
  cancelled: { icon: Ban, tint: 'text-[#87999f]' },
};

const STATUS_CHIP: Record<StepStatus, string> = {
  succeeded: 'bg-[#e3f0e8] text-[#2f7d52]',
  failed: 'bg-[#f7e6e4] text-[#c2453d]',
  skipped: 'bg-[#eef1f3] text-[#5c707a]',
  'awaiting-approval': 'bg-[#f7efdf] text-[#c07d1e]',
  cancelled: 'bg-[#eef1f3] text-[#5c707a]',
};

const FILTERS = ['all', 'succeeded', 'failed', 'changed'] as const;
type Filter = typeof FILTERS[number];

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  succeeded: 'Succeeded',
  failed: 'Failed',
  changed: 'Touched customer systems',
};

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

function EntityChip({ e }: { e: Entity }) {
  const Icon = ENTITY_ICON[e.kind];
  return (
    <span
      title={ENTITY_LABEL[e.kind]}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a] max-w-[200px]"
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{e.value}</span>
    </span>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Set when opened from a row, to scope the log to that flow. */
  flowName?: string;
  /** Takes the reader to the full audit page, when the drawer isn't enough. */
  onOpenFullAudit?: () => void;
}

export default function AuditLogDrawer({ open, onClose, flowName, onOpenFullAudit }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(40);

  // A scoped drawer that kept the last search would answer the wrong question.
  useEffect(() => {
    if (open) { setSearch(''); setFilter('all'); setLimit(40); }
  }, [open, flowName]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  const scoped = useMemo(
    () => (flowName ? AUDIT_LOG.filter(e => e.flowName === flowName) : AUDIT_LOG),
    [flowName]);

  const entries = useMemo(() => scoped.filter(e => {
    if (filter === 'succeeded' && e.outcome !== 'succeeded') return false;
    if (filter === 'failed' && e.outcome !== 'failed') return false;
    if (filter === 'changed' && !e.changedCustomerSystems) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.flowName.toLowerCase().includes(q)
      || stepName(e as any).toLowerCase().includes(q)
      || e.entity?.value.toLowerCase().includes(q)
      || e.author.toLowerCase().includes(q)
      || e.tenant.toLowerCase().includes(q)
      || e.runId.toLowerCase().includes(q)
      || e.sourceRef.toLowerCase().includes(q);
  }), [scoped, search, filter]);

  const shown = entries.slice(0, limit);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="relative w-full max-w-[560px] h-full bg-white border-l border-[var(--stroke)] shadow-2xl flex flex-col">

        {/* Head */}
        <div className="shrink-0 bg-[#092E3F] px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[#2A96A8] text-xs uppercase tracking-widest mb-1">
              <ScrollText className="w-3.5 h-3.5" /> Audit log
            </p>
            <h2 className="text-white text-base font-semibold truncate">
              {flowName ?? 'Every automated action'}
            </h2>
            <p className="text-white/60 text-xs mt-0.5">
              {scoped.length} action{scoped.length === 1 ? '' : 's'} recorded
              {flowName ? ' by this flow' : ' across all flows'} · last 30 days
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Controls */}
        <div className="shrink-0 px-5 py-3 border-b border-[var(--stroke)] space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setLimit(40); }}
              placeholder="Search an entity, action, author or run…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setLimit(40); }}
                className={`flex-1 px-2 py-1 rounded-[8px] text-[11px] font-medium transition-colors ${
                  filter === f ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'
                }`}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-center py-16 px-5">
              <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nothing recorded that matches</p>
            </div>
          ) : (
            <ol className="divide-y divide-gray-100">
              {shown.map(e => <Entry key={e.id} e={e} showFlow={!flowName} />)}
            </ol>
          )}

          {entries.length > shown.length && (
            <div className="p-4">
              <button
                onClick={() => setLimit(n => n + 40)}
                className="w-full py-2 rounded-[8px] border border-[var(--stroke)] text-xs font-medium text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
              >
                Show 40 more — {entries.length - shown.length} older still recorded
              </button>
            </div>
          )}
        </div>

        {/* Foot */}
        <div className="shrink-0 px-5 py-3 border-t border-[var(--stroke)] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#87999f]">
            Showing {shown.length} of {entries.length}
          </span>
          {onOpenFullAudit && (
            <button
              onClick={() => { onClose(); onOpenFullAudit(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--stroke)] text-xs font-medium text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full audit &amp; export
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/** One automated action: the seven fields, in the order you read them. */
function Entry({ e, showFlow }: { e: AuditEntry; showFlow: boolean }) {
  const { icon: Icon, tint } = STATUS_ICON[e.outcome];
  const AuthorIcon = e.authorKind === 'analyst' ? UserCheck : Bot;
  return (
    <li className="px-5 py-3 hover:bg-[#fafbfb] transition-colors">
      <div className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tint}`} />

        <div className="flex-1 min-w-0">
          {/* action + outcome */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm text-[#092E3F]">{stepName(e as any)}</span>
            <span className={`px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide ${STATUS_CHIP[e.outcome]}`}>
              {STEP_LABEL[e.outcome]}
            </span>
            {e.changedCustomerSystems && (
              <span
                title="This action reached into the customer's environment"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]"
              >
                <ShieldCheck className="w-2.5 h-2.5" />customer systems
              </span>
            )}
          </div>

          {/* entity */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {e.entity
              ? <EntityChip e={e.entity} />
              : <span className="text-[10px] text-[#b7c4c9]">No entity — acted on {e.sourceRef === '—' ? e.tenant : e.sourceRef}</span>}
          </div>

          <p className={`text-[11px] mt-1 ${e.outcome === 'failed' ? 'text-[#c2453d]' : 'text-[#87999f]'}`}>
            {e.detail}
          </p>

          {/* flow + trigger + author */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-[#87999f]">
            {showFlow && <><span className="text-[#5c707a]">{e.flowName}</span><span>·</span></>}
            <span>{triggerName(e.trigger)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <AuthorIcon className="w-3 h-3" />{e.author}
            </span>
          </div>
        </div>

        {/* timestamp */}
        <div className="text-right shrink-0">
          <p className="text-[11px] text-[#6b828c] whitespace-nowrap">{stamp(e.at)}</p>
          <p className="text-[10px] text-[#b7c4c9] whitespace-nowrap">
            {e.runId}{e.durationMs > 0 ? ` · ${fmtDuration(e.durationMs)}` : ''}
          </p>
          <p className="text-[10px] text-[#b7c4c9]">{e.tenant}</p>
        </div>
      </div>
    </li>
  );
}
