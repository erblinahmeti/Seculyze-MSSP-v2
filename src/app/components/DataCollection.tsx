import { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Database, Search, DollarSign, TrendingDown, Filter, Code2, Play,
  Check, X, ChevronDown, ChevronUp, ShieldCheck, Info, Sparkles, Loader2,
} from 'lucide-react';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only: all figures are mocked. Mirrors what Seculyze's real Data
// Collection Rules feature reports per Log Source (Microsoft Sentinel tables).

interface SavingsOpportunity {
  id: string;
  description: string;
  matchPct: number;       // % of this source's monthly events this would exclude
  monthlySavings: number; // $
  eventsExcluded: number; // per month
}

interface TransformationFilter {
  id: string;
  name: string;
  kql: string;
  isActive: boolean;
  monthlySavings: number;
  eventsExcluded: number;
  source: 'recommended' | 'custom';
}

interface LogSource {
  id: string;
  name: string;
  provider: string;
  monthlySpend: number;
  eventsPerMonth: number;
  gbPerMonth: number;
  opportunities: SavingsOpportunity[];
  filters: TransformationFilter[];
}

const INITIAL_SOURCES: LogSource[] = [
  {
    id: 'securityevent', name: 'SecurityEvent', provider: 'Windows Security Events via AMA',
    monthlySpend: 4820, eventsPerMonth: 128_400_000, gbPerMonth: 1930,
    opportunities: [
      { id: 'o1', description: 'Exclude verbose Process Creation (4688) noise from domain controllers', matchPct: 22, monthlySavings: 1060, eventsExcluded: 28_200_000 },
      { id: 'o2', description: 'Drop successful logon (4624) events from known service accounts', matchPct: 9, monthlySavings: 434, eventsExcluded: 11_500_000 },
    ],
    filters: [
      { id: 'f1', name: 'Exclude debug-level audit events', kql: "SecurityEvent\n| where EventID != 4688 or Process !endswith 'svchost.exe'", isActive: true, monthlySavings: 312, eventsExcluded: 8_100_000, source: 'recommended' },
    ],
  },
  {
    id: 'signinlogs', name: 'SigninLogs', provider: 'Microsoft Entra ID',
    monthlySpend: 1610, eventsPerMonth: 41_200_000, gbPerMonth: 644,
    opportunities: [
      { id: 'o3', description: 'Exclude successful non-interactive sign-ins from trusted service principals', matchPct: 31, monthlySavings: 499, eventsExcluded: 12_770_000 },
    ],
    filters: [],
  },
  {
    id: 'azureactivity', name: 'AzureActivity', provider: 'Azure Resource Manager',
    monthlySpend: 890, eventsPerMonth: 22_800_000, gbPerMonth: 356,
    opportunities: [
      { id: 'o4', description: 'Exclude routine autoscale and health-probe activity', matchPct: 18, monthlySavings: 160, eventsExcluded: 4_100_000 },
    ],
    filters: [
      { id: 'f2', name: 'Suppress read-only ARM calls', kql: "AzureActivity\n| where OperationNameValue !endswith '/read'", isActive: true, monthlySavings: 205, eventsExcluded: 5_300_000, source: 'custom' },
    ],
  },
  {
    id: 'commonsecuritylog', name: 'CommonSecurityLog', provider: 'CEF — firewalls & network appliances',
    monthlySpend: 3120, eventsPerMonth: 96_600_000, gbPerMonth: 1248,
    opportunities: [
      { id: 'o5', description: 'Exclude allowed east-west traffic between known internal subnets', matchPct: 27, monthlySavings: 843, eventsExcluded: 26_100_000 },
      { id: 'o6', description: 'Drop verbose DNS query logging below severity 4', matchPct: 12, monthlySavings: 375, eventsExcluded: 11_600_000 },
    ],
    filters: [],
  },
  {
    id: 'syslog', name: 'Syslog', provider: 'Linux agents',
    monthlySpend: 1340, eventsPerMonth: 38_900_000, gbPerMonth: 536,
    opportunities: [
      { id: 'o7', description: 'Exclude cron / systemd heartbeat noise', matchPct: 15, monthlySavings: 201, eventsExcluded: 5_800_000 },
    ],
    filters: [],
  },
  {
    id: 'officeactivity', name: 'OfficeActivity', provider: 'Microsoft 365',
    monthlySpend: 2210, eventsPerMonth: 61_300_000, gbPerMonth: 884,
    opportunities: [],
    filters: [
      { id: 'f3', name: 'Exclude SharePoint file-view events', kql: "OfficeActivity\n| where Operation != 'FileAccessed'", isActive: true, monthlySavings: 288, eventsExcluded: 7_900_000, source: 'recommended' },
    ],
  },
];

const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtCompact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export default function DataCollection() {
  const [sources, setSources] = useState<LogSource[]>(INITIAL_SOURCES);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [applyModalFor, setApplyModalFor] = useState<string | null>(null);
  const [queryModalFor, setQueryModalFor] = useState<string | null>(null);

  const filtered = useMemo(() => sources.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.provider.toLowerCase().includes(search.toLowerCase())
  ), [sources, search]);

  const totals = useMemo(() => {
    const spend = sources.reduce((s, x) => s + x.monthlySpend, 0);
    const events = sources.reduce((s, x) => s + x.eventsPerMonth, 0);
    const gb = sources.reduce((s, x) => s + x.gbPerMonth, 0);
    const potential = sources.reduce((s, x) => s + x.opportunities.reduce((a, o) => a + o.monthlySavings, 0), 0);
    return { spend, events, gb, potential };
  }, [sources]);

  const applyOpportunity = (sourceId: string, oppId: string) => {
    setSources(prev => prev.map(s => {
      if (s.id !== sourceId) return s;
      const opp = s.opportunities.find(o => o.id === oppId);
      if (!opp) return s;
      toast.success(`Filter applied — saving ${fmtMoney(opp.monthlySavings)}/mo on ${s.name}`);
      return {
        ...s,
        opportunities: s.opportunities.filter(o => o.id !== oppId),
        filters: [...s.filters, {
          id: `f-${opp.id}`, name: opp.description, kql: `${s.name}\n| where /* excludes: ${opp.description} */ true`,
          isActive: true, monthlySavings: opp.monthlySavings, eventsExcluded: opp.eventsExcluded, source: 'recommended',
        }],
      };
    }));
  };

  const toggleFilter = (sourceId: string, filterId: string) => {
    setSources(prev => prev.map(s => s.id !== sourceId ? s : {
      ...s,
      filters: s.filters.map(f => f.id === filterId ? { ...f, isActive: !f.isActive } : f),
    }));
  };

  const saveCustomFilter = (sourceId: string, name: string, kql: string) => {
    setSources(prev => prev.map(s => s.id !== sourceId ? s : {
      ...s,
      filters: [...s.filters, {
        id: `custom-${Date.now()}`, name, kql, isActive: true,
        monthlySavings: 0, eventsExcluded: 0, source: 'custom',
      }],
    }));
    toast.success(`Custom filter "${name}" saved to ${sources.find(s => s.id === sourceId)?.name}`);
  };

  const applyModalSource = sources.find(s => s.id === applyModalFor) ?? null;
  const queryModalSource = sources.find(s => s.id === queryModalFor) ?? null;

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#092E3F] text-xl font-semibold">Data Collection</h1>
              <p className="text-sm text-[#092E3F]/60">Identify redundant logs, cut ingestion cost, and keep every security-critical event.</p>
            </div>
          </div>
        </div>

        {/* Prerequisites banner */}
        <div className="flex items-center gap-2.5 mb-6 px-4 py-2.5 bg-[#e3f0e8] border border-[#2f7d52]/20 rounded-[4px]">
          <ShieldCheck className="w-4 h-4 text-[#2f7d52] shrink-0" />
          <p className="text-xs text-[#2f7d52]">
            <span className="font-medium">Cost subscription active</span> · Data Collection permissions granted — recommendations are up to date.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#2A96A8]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">30-day est. spend</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">{fmtMoney(totals.spend)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-[#6b828c]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Events / month</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">{fmtCompact(totals.events)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-[#6b828c]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Data ingested</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">{totals.gb.toLocaleString()} <span className="text-sm font-normal text-[#6b828c]">GB</span></p>
          </div>
          <div className="bg-white border border-[#2f7d52]/30 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-[#2f7d52]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Potential savings / mo</span>
            </div>
            <p className="text-2xl font-bold text-[#2f7d52]">{fmtMoney(totals.potential)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search log sources…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
          />
        </div>

        {/* Log source cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => {
            const isExpanded = !!expanded[s.id];
            const oppsShown = isExpanded ? s.opportunities : s.opportunities.slice(0, 2);
            const activeFilters = s.filters.filter(f => f.isActive);
            const sourcePotential = s.opportunities.reduce((a, o) => a + o.monthlySavings, 0);

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-[6px] p-5 flex flex-col">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#092E3F]">{s.name}</h3>
                      {activeFilters.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">
                          {activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''} active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#87999f] mt-0.5">{s.provider}</p>
                  </div>
                  {sourcePotential > 0 && (
                    <span className="shrink-0 text-xs font-medium text-[#2f7d52]">{fmtMoney(sourcePotential)}/mo available</span>
                  )}
                </div>

                {/* Overview stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-[#f6f6f6] rounded-[4px]">
                  <div>
                    <p className="text-[10px] text-[#87999f] uppercase tracking-wide">Spend</p>
                    <p className="text-sm font-semibold text-[#092E3F]">{fmtMoney(s.monthlySpend)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#87999f] uppercase tracking-wide">Events</p>
                    <p className="text-sm font-semibold text-[#092E3F]">{fmtCompact(s.eventsPerMonth)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#87999f] uppercase tracking-wide">Volume</p>
                    <p className="text-sm font-semibold text-[#092E3F]">{s.gbPerMonth.toLocaleString()} GB</p>
                  </div>
                </div>

                {/* Existing transformation filters */}
                {s.filters.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-medium text-[#092E3F]/60 uppercase tracking-wide mb-1.5">Transformation filters</p>
                    <div className="space-y-1.5">
                      {s.filters.map(f => (
                        <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 border border-gray-100 rounded-[4px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => toggleFilter(s.id, f.id)}
                              title={f.isActive ? 'Disable filter' : 'Enable filter'}
                              className={`shrink-0 w-7 h-4 rounded-full transition-colors relative ${f.isActive ? 'bg-[#2A96A8]' : 'bg-gray-300'}`}
                            >
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${f.isActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </button>
                            <span className="text-xs text-[#092E3F] truncate" title={f.name}>{f.name}</span>
                          </div>
                          {f.monthlySavings > 0 && (
                            <span className="shrink-0 text-[11px] text-[#2f7d52] font-medium">{fmtMoney(f.monthlySavings)}/mo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top savings opportunities */}
                {s.opportunities.length > 0 ? (
                  <div className="mb-4 flex-1">
                    <p className="text-[11px] font-medium text-[#092E3F]/60 uppercase tracking-wide mb-1.5">Top savings opportunities</p>
                    <div className="space-y-1.5">
                      {oppsShown.map(o => (
                        <div key={o.id} className="flex items-center justify-between gap-3 px-2.5 py-2 bg-[#e3f0e8]/40 border border-[#2f7d52]/15 rounded-[4px]">
                          <div className="min-w-0">
                            <p className="text-xs text-[#092E3F] leading-snug">{o.description}</p>
                            <p className="text-[10px] text-[#6b828c] mt-0.5">{o.matchPct}% of events · {fmtCompact(o.eventsExcluded)} excluded/mo</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#2f7d52] whitespace-nowrap">{fmtMoney(o.monthlySavings)}/mo</span>
                            <button
                              onClick={() => applyOpportunity(s.id, o.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-[#092E3F] text-white rounded-[4px] text-[11px] font-medium hover:bg-[#092E3F]/90 transition-colors"
                            >
                              <Check className="w-3 h-3" /> Apply
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {s.opportunities.length > 2 && (
                      <button
                        onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                        className="flex items-center gap-1 mt-1.5 text-[11px] text-[#2A96A8] hover:underline"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Show fewer' : `Show ${s.opportunities.length - 2} more`}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mb-4 flex-1 flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-[4px]">
                    <Sparkles className="w-3.5 h-3.5 text-[#87999f] shrink-0" />
                    <p className="text-xs text-[#87999f]">No new savings opportunities — this source is well tuned.</p>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => setApplyModalFor(s.id)}
                    disabled={s.opportunities.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:border-[#092E3F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Filter className="w-3.5 h-3.5" /> Apply Transformation Filters
                  </button>
                  <button
                    onClick={() => setQueryModalFor(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:border-[#092E3F] transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" /> Create with Query
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No log sources match your search</p>
          </div>
        )}

        {/* Limitation note */}
        <div className="flex items-start gap-2 mt-6 px-4 py-3 bg-gray-50 border border-gray-200 rounded-[4px]">
          <Info className="w-4 h-4 text-[#6b828c] mt-0.5 shrink-0" />
          <p className="text-xs text-[#6b828c]">Seculyze Data Collection Rules does not support custom Log Sources yet — only the tables listed above can be filtered.</p>
        </div>
      </div>

      {applyModalSource && (
        <ApplyFiltersModal
          source={applyModalSource}
          onClose={() => setApplyModalFor(null)}
          onApply={(oppIds) => {
            oppIds.forEach(id => applyOpportunity(applyModalSource.id, id));
            setApplyModalFor(null);
          }}
        />
      )}

      {queryModalSource && (
        <QueryConstructorModal
          source={queryModalSource}
          onClose={() => setQueryModalFor(null)}
          onSave={(name, kql) => {
            saveCustomFilter(queryModalSource.id, name, kql);
            setQueryModalFor(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Apply Transformation Filters modal — bulk-select recommended filters ─────

function ApplyFiltersModal({ source, onClose, onApply }: {
  source: LogSource;
  onClose: () => void;
  onApply: (oppIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(source.opportunities.map(o => o.id)));
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const totalSavings = source.opportunities.filter(o => selected.has(o.id)).reduce((a, o) => a + o.monthlySavings, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-start justify-between">
          <div>
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Apply transformation filters</p>
            <p className="text-white text-base font-semibold">{source.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-2 overflow-y-auto">
          <p className="text-xs text-[#092E3F]/60 mb-3">Select which recommended filters to apply. Matching events will be excluded before ingestion.</p>
          {source.opportunities.map(o => (
            <label key={o.id} className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-[#f6f6f6] rounded-[4px] cursor-pointer">
              <div
                onClick={e => { e.preventDefault(); toggle(o.id); }}
                className={`w-4 h-4 mt-0.5 rounded-[3px] border-2 flex items-center justify-center shrink-0 ${selected.has(o.id) ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-[#c4d2d6] bg-white'}`}
              >
                {selected.has(o.id) && <span className="text-white text-[10px]">✓</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#092E3F]">{o.description}</p>
                <p className="text-[10px] text-[#6b828c] mt-0.5">{o.matchPct}% of events · {fmtMoney(o.monthlySavings)}/mo</p>
              </div>
            </label>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-[#092E3F]/60">
            Estimated savings: <span className="font-semibold text-[#2f7d52]">{fmtMoney(totalSavings)}/mo</span>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-gray-100 transition-colors">Cancel</button>
            <button
              onClick={() => onApply([...selected])}
              disabled={selected.size === 0}
              className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply {selected.size > 0 ? selected.size : ''} filter{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create with Query modal — KQL constructor with row-level cost preview ───

interface SimResult { matched: number; pctOfVolume: number; monthlySavings: number; sampleRows: { text: string; cost: string }[]; }

function simulateQuery(source: LogSource, kql: string): SimResult {
  const seed = kql.split('').reduce((s, c) => s + c.charCodeAt(0), 0) + source.id.length;
  const pctOfVolume = 4 + (seed % 22);
  const matched = Math.round(source.eventsPerMonth * (pctOfVolume / 100));
  const monthlySavings = Math.round(source.monthlySpend * (pctOfVolume / 100));
  const sampleRows = [
    { text: `${source.name} row #${1000 + (seed % 900)} — routine, matches filter`, cost: `$${(monthlySavings / matched * 1000).toFixed(5)}/1k events` },
    { text: `${source.name} row #${2000 + (seed % 900)} — routine, matches filter`, cost: `$${(monthlySavings / matched * 1000).toFixed(5)}/1k events` },
    { text: `${source.name} row #${3000 + (seed % 900)} — routine, matches filter`, cost: `$${(monthlySavings / matched * 1000).toFixed(5)}/1k events` },
  ];
  return { matched, pctOfVolume, monthlySavings, sampleRows };
}

function QueryConstructorModal({ source, onClose, onSave }: {
  source: LogSource;
  onClose: () => void;
  onSave: (name: string, kql: string) => void;
}) {
  const [name, setName] = useState('');
  const [kql, setKql] = useState(`${source.name}\n| where /* add your exclusion condition here */ true`);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  const runSimulation = () => {
    setIsSimulating(true);
    setResult(null);
    setTimeout(() => {
      setResult(simulateQuery(source, kql));
      setIsSimulating(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-start justify-between">
          <div>
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Create with query</p>
            <p className="text-white text-base font-semibold">{source.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-[11px] font-medium text-[#092E3F]/60 uppercase tracking-wide mb-1.5 block">Filter name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Exclude verbose health-check traffic"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#092E3F]/60 uppercase tracking-wide mb-1.5 block">KQL query</label>
            <textarea
              value={kql}
              onChange={e => { setKql(e.target.value); setResult(null); }}
              rows={5}
              className="w-full px-3 py-2.5 bg-[#092E3F] text-[#e5f2f4] rounded-[4px] text-[12px] font-mono leading-6 focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/40 resize-none"
              spellCheck={false}
            />
            <p className="text-[10px] text-[#87999f] mt-1">Events matching this query are excluded before ingestion. Security-critical fields are always preserved.</p>
          </div>

          <button
            onClick={runSimulation}
            disabled={isSimulating}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c9d6dc] text-[#092E3F] rounded-[4px] text-sm font-medium hover:border-[#092E3F] disabled:opacity-60 transition-colors"
          >
            {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isSimulating ? 'Simulating…' : 'Test / simulate'}
          </button>

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#f6f6f6] rounded-[4px] p-3">
                  <p className="text-[10px] text-[#87999f] uppercase tracking-wide">Events matched</p>
                  <p className="text-lg font-bold text-[#092E3F]">{fmtCompact(result.matched)}</p>
                </div>
                <div className="bg-[#e5f2f4] rounded-[4px] p-3">
                  <p className="text-[10px] text-[#1e7d8f] uppercase tracking-wide">% of volume</p>
                  <p className="text-lg font-bold text-[#092E3F]">{result.pctOfVolume}%</p>
                </div>
                <div className="bg-[#e3f0e8] rounded-[4px] p-3">
                  <p className="text-[10px] text-[#2f7d52] uppercase tracking-wide">Est. savings / mo</p>
                  <p className="text-lg font-bold text-[#2f7d52]">{fmtMoney(result.monthlySavings)}</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-[4px] divide-y divide-gray-100">
                <p className="px-3 py-2 text-[11px] font-medium text-[#092E3F]/60 uppercase tracking-wide">Sample matched rows · row-level cost</p>
                {result.sampleRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-xs text-[#092E3F] font-mono truncate">{r.text}</span>
                    <span className="shrink-0 text-[11px] text-[#2f7d52] font-mono">{r.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-gray-100 transition-colors">Cancel</button>
          <button
            onClick={() => onSave(name.trim() || 'Custom filter', kql)}
            disabled={!result || !name.trim()}
            title={!result ? 'Run a simulation first' : !name.trim() ? 'Name the filter first' : undefined}
            className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save as filter
          </button>
        </div>
      </div>
    </div>
  );
}
