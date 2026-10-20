import { useEffect, useMemo, useState } from 'react';
import {
  Search, ScrollText, ExternalLink, Bot, UserCheck, Zap, ChevronDown, Check,
  CheckCircle2, XCircle, MinusCircle, Clock, Ban, ShieldCheck,
  User, Monitor, Globe, Mail, FileWarning, Network, Building2,
} from 'lucide-react';
import SidePanel from './SidePanel';
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

const ANY = '__any__';

/** The distinct values in a log, with how many entries each accounts for. */
function tally(entries: AuditEntry[], of: (e: AuditEntry) => string): { value: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const v = of(e);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
}

/**
 * One filter control, built like the Incidents dropdown and sized for a
 * 560px drawer: the trigger says what is selected rather than what it
 * filters, because "Nike" is the useful word once chosen.
 */
function Picker({ icon: Icon, label, value, options, searchable, onPick }: {
  icon: any;
  label: string;
  value: string;
  options: { value: string; n: number }[];
  searchable: boolean;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { if (open) setQ(''); }, [open]);

  const matches = options.filter(o => o.value.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = value !== ANY;

  return (
    <div className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(v => !v)}
        title={chosen ? `Filtering by ${label}: ${value}` : `Filter by ${label}`}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] transition-colors ${
          chosen
            ? 'bg-[#e5f2f4] border-[#2A96A8]/30 text-[#1e7d8f]'
            : 'bg-white border-[var(--stroke)] text-[#6b828c] hover:border-[#2A96A8] hover:text-[#092E3F]'
        }`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{chosen ? value : `Any ${label}`}</span>
        <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-[8px] shadow-xl border border-[var(--stroke)] py-1 min-w-[220px]">
            {searchable && (
              <div className="relative border-b border-gray-100">
                <Search className="w-3.5 h-3.5 text-[#b7c4c9] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={`Find a ${label}`}
                  className="w-full pl-8 pr-3 py-2 text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none"
                />
              </div>
            )}

            <div className="max-h-[240px] overflow-y-auto">
              <button
                onClick={() => { onPick(ANY); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                  !chosen ? 'bg-[#2A96A8]/10 text-[#2A96A8]' : 'text-[#092E3F] hover:bg-gray-50'
                }`}
              >
                <span>Any {label}</span>
                {!chosen && <Check className="w-3.5 h-3.5" />}
              </button>

              {matches.length === 0 && (
                <p className="px-3 py-3 text-xs text-[#87999f]">Nothing matches</p>
              )}

              {matches.map(o => (
                <button
                  key={o.value}
                  onClick={() => { onPick(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                    o.value === value ? 'bg-[#2A96A8]/10 text-[#2A96A8]' : 'text-[#092E3F] hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate text-left">{o.value}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="tabular-nums text-[10px] text-[#87999f]">{o.n}</span>
                    {o.value === value && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
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
  const [tenant, setTenant] = useState<string>(ANY);
  const [action, setAction] = useState<string>(ANY);
  const [limit, setLimit] = useState(40);

  // A scoped drawer that kept the last search would answer the wrong question.
  useEffect(() => {
    if (open) { setSearch(''); setFilter('all'); setTenant(ANY); setAction(ANY); setLimit(40); }
  }, [open, flowName]);

  // Escape belongs to SidePanel, which only honours it while the panel is a
  // modal. Keeping a copy here closed a pinned panel that was meant to stay.

  const scoped = useMemo(
    () => (flowName ? AUDIT_LOG.filter(e => e.flowName === flowName) : AUDIT_LOG),
    [flowName]);

  /**
   * Only what this log actually contains. Offering all sixty tenants and all
   * twenty actions when a flow has touched four of each is a menu of dead
   * ends — every option here returns at least one entry.
   */
  const tenantOptions = useMemo(() => tally(scoped, e => e.tenant), [scoped]);
  const actionOptions = useMemo(() => tally(scoped, e => stepName(e as any)), [scoped]);

  const entries = useMemo(() => scoped.filter(e => {
    if (filter === 'succeeded' && e.outcome !== 'succeeded') return false;
    if (filter === 'failed' && e.outcome !== 'failed') return false;
    if (filter === 'changed' && !e.changedCustomerSystems) return false;
    if (tenant !== ANY && e.tenant !== tenant) return false;
    if (action !== ANY && stepName(e as any) !== action) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return e.flowName.toLowerCase().includes(q)
      || stepName(e as any).toLowerCase().includes(q)
      || e.entity?.value.toLowerCase().includes(q)
      || e.author.toLowerCase().includes(q)
      || e.tenant.toLowerCase().includes(q)
      || e.runId.toLowerCase().includes(q)
      || e.sourceRef.toLowerCase().includes(q);
  }), [scoped, search, filter, tenant, action]);

  const shown = entries.slice(0, limit);

  if (!open) return null;

  return (
    <SidePanel
      id="audit-log"
      open={open}
      onClose={onClose}
      header={
        <>
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
        </>
      }
      footer={
        <div className="px-5 py-3 border-t border-[var(--stroke)] flex items-center justify-between gap-3">
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
      }
    >

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

          {/* Which customer, and which action. The two questions asked of a
              log that is already scoped to one automation: what did this do
              to Tenant A, and show me only the emails. */}
          <div className="flex items-center gap-2">
            <Picker
              icon={Building2}
              label="tenant"
              value={tenant}
              options={tenantOptions}
              searchable={tenantOptions.length > 8}
              onPick={v => { setTenant(v); setLimit(40); }}
            />
            <Picker
              icon={Zap}
              label="action"
              value={action}
              options={actionOptions}
              searchable={actionOptions.length > 8}
              onPick={v => { setAction(v); setLimit(40); }}
            />
            {(tenant !== ANY || action !== ANY || filter !== 'all' || search) && (
              <button
                onClick={() => { setTenant(ANY); setAction(ANY); setFilter('all'); setSearch(''); setLimit(40); }}
                title="Clear every filter"
                className="shrink-0 px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-[#6b828c] hover:text-[#092E3F] hover:bg-[#f1f4f5] transition-colors"
              >
                Clear
              </button>
            )}
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

    </SidePanel>
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
