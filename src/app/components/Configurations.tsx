import { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal, Search, ChevronDown, ChevronRight, X,
  Check, AlertTriangle, Shuffle, Coins, Activity, Brain,
} from 'lucide-react';
import { TABLE_SHELL, GRID_HEAD, GRID_ROW, GRID_BODY, GRID_SCROLL } from './tableStyles';
import Pagination from './Pagination';

// ─── Configurations ──────────────────────────────────────────────────────────
//
// The workspace-level settings a tenant either has in place or does not. This
// is what Calibrate's Configuration Score has been scoring all along — until
// now there was nowhere to go and see which settings it meant.
//
// Rows are settings rather than tenants, because a gap is almost never one
// tenant's problem: the same parser tends to be missing across half the estate,
// and that is the unit of work. Pick a single client from the filter to flip it
// into a straight configured / not-configured checklist for that tenant.

type Category = 'Normalisation' | 'Cost & retention' | 'Health' | 'Analytics';

const CATEGORY_ICON: Record<Category, typeof Shuffle> = {
  'Normalisation': Shuffle,
  'Cost & retention': Coins,
  'Health': Activity,
  'Analytics': Brain,
};

interface ConfigItem {
  key: string;
  category: Category;
  what: string;
  /** What stops working while this is missing — the reason to care. */
  cost: string;
  /** Tenants where it is not configured. */
  missing: string[];
}

const CLIENTS = [
  'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok',
  'New Balance', 'Asics', 'Converse', 'Vans',
];

// ASIM is Microsoft's Advanced Security Information Model: parsers that map a
// tenant's raw tables onto a common schema. Analytics rules written against
// the normalised schema return nothing at all on a tenant whose parser is
// missing — they do not error, they just never fire, which is why this page
// exists.
const ITEMS: ConfigItem[] = [
  { key: 'ASimAuthentication', category: 'Normalisation',
    what: 'ASIM parser mapping sign-in events onto the normalised schema',
    cost: 'Sign-in detections never fire on this tenant',
    missing: [] },
  { key: 'ASimDNS', category: 'Normalisation',
    what: 'ASIM parser for DNS queries and responses',
    cost: 'DNS tunnelling and DGA detections return nothing',
    missing: [] },
  { key: 'ASimFileEvent', category: 'Normalisation',
    what: 'ASIM parser for file create, modify and delete activity',
    cost: 'File-based detections skip this tenant',
    missing: [] },
  { key: 'ASimNetworkSession', category: 'Normalisation',
    what: 'ASIM parser for network sessions and flows',
    cost: 'Lateral movement and beaconing rules cannot read this traffic',
    missing: [] },
  { key: 'ASimProcessCreate', category: 'Normalisation',
    what: 'ASIM parser for process creation events',
    cost: 'The largest family of endpoint detections depends on this',
    missing: [] },
  { key: 'ASimRegistryEvent', category: 'Normalisation',
    what: 'ASIM parser for registry key and value changes',
    cost: 'Registry persistence goes undetected',
    missing: ['Nike', 'Puma'] },
  { key: 'ASimWebSession', category: 'Normalisation',
    what: 'ASIM parser for web and proxy sessions',
    cost: 'Exfiltration and C2-over-HTTP rules go blind',
    missing: ['Under Armour', 'New Balance'] },

  { key: 'FirewallLogsDataLake', category: 'Cost & retention',
    what: 'High-volume firewall logs routed to the data lake tier',
    cost: 'Firewall volume billed at analytics rates',
    missing: ['Adidas', 'Converse', 'Vans'] },
  { key: 'LogRetention', category: 'Cost & retention',
    what: 'Per-table retention set to match the contracted policy',
    cost: 'Either paying to keep data nobody queries, or losing it before an investigation needs it',
    missing: ['Adidas'] },
  { key: 'SkuLogAnalytics', category: 'Cost & retention',
    what: 'Log Analytics commitment tier matched to daily volume',
    cost: 'Pay-as-you-go above ~100 GB/day costs materially more',
    missing: ['Asics', 'Vans'] },
  { key: 'SkuSentinel', category: 'Cost & retention',
    what: 'Sentinel commitment tier aligned with the workspace tier',
    cost: 'Paying Sentinel list price on committed volume',
    missing: [] },

  { key: 'SentinelHealth', category: 'Health',
    what: 'SentinelHealth diagnostic table enabled on the workspace',
    cost: 'No signal when a connector or rule fails quietly',
    missing: [] },
  { key: 'UnhealthyItems', category: 'Health',
    what: 'Failing connectors and rules triaged down to zero',
    cost: 'Detections that look like they are running but see nothing',
    missing: ['Asics'] },

  { key: 'UEBA', category: 'Analytics',
    what: 'User and Entity Behaviour Analytics enabled',
    cost: 'No entity risk scores, and anomaly detections unavailable',
    missing: ['Adidas', 'New Balance', 'Asics', 'Vans'] },
];

const ALL = 'All clients';

export default function Configurations() {
  const [client, setClient] = useState<string>(ALL);
  const [clientOpen, setClientOpen] = useState(false);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [q, setQ] = useState('');
  const [detailKey, setDetailKey] = useState<string | null>(null);

  const single = client !== ALL;
  const needle = q.trim().toLowerCase();

  const rows = useMemo(() => ITEMS.map(item => {
    const scope = single ? [client] : CLIENTS;
    const missing = item.missing.filter(c => scope.includes(c));
    return { item, missing, configured: scope.length - missing.length, total: scope.length };
  }), [client, single]);

  const matches = rows.filter(({ item }) =>
    (!needle || item.key.toLowerCase().includes(needle) || item.what.toLowerCase().includes(needle)) &&
    (category === 'all' || item.category === category)
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const visible = matches.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [needle, category, client]);

  const totals = useMemo(() => {
    const scope = single ? [client] : CLIENTS;
    const cells = ITEMS.length * scope.length;
    const gaps = ITEMS.reduce((n, i) => n + i.missing.filter(c => scope.includes(c)).length, 0);
    const perClient = scope.map(c => ({
      client: c,
      configured: ITEMS.filter(i => !i.missing.includes(c)).length,
    }));
    const complete = perClient.filter(p => p.configured === ITEMS.length).length;
    const worst = [...ITEMS].sort((a, b) =>
      b.missing.filter(c => scope.includes(c)).length - a.missing.filter(c => scope.includes(c)).length)[0];
    return { cells, gaps, configured: cells - gaps, complete, scope, perClient, worst };
  }, [client, single]);

  const detail = detailKey ? ITEMS.find(i => i.key === detailKey) ?? null : null;

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[#092E3F] text-xl font-semibold">Configurations</h1>
                <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">Tuning</span>
              </div>
              <p className="text-sm text-[#092E3F]/60">
                The workspace settings behind each tenant's Configuration Score — and which ones are missing.
              </p>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Configured"
            value={`${totals.configured} / ${totals.cells}`}
            sub={single ? `${ITEMS.length} settings on ${client}` : `${ITEMS.length} settings across ${CLIENTS.length} clients`}
          />
          <StatCard
            label="Not configured"
            value={String(totals.gaps)}
            sub={totals.gaps === 0 ? 'nothing outstanding' : 'settings to put in place'}
            accent={totals.gaps > 0 ? 'bad' : 'good'}
          />
          <StatCard
            label={single ? 'This client' : 'Fully configured'}
            value={single
              ? `${totals.perClient[0].configured} / ${ITEMS.length}`
              : `${totals.complete} of ${CLIENTS.length}`}
            sub={single ? 'settings in place' : 'clients with nothing missing'}
          />
          <StatCard
            label="Biggest gap"
            value={totals.worst.missing.filter(c => totals.scope.includes(c)).length > 0 ? totals.worst.key : '—'}
            sub={totals.worst.missing.filter(c => totals.scope.includes(c)).length > 0
              ? `missing on ${totals.worst.missing.filter(c => totals.scope.includes(c)).length} client${totals.worst.missing.filter(c => totals.scope.includes(c)).length !== 1 ? 's' : ''}`
              : 'no gaps in scope'}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-[#092E3F] mr-auto">Settings</h2>

          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
            {(['all', 'Normalisation', 'Cost & retention', 'Health', 'Analytics'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors ${
                  category === c ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#6b828c] hover:text-[#092E3F]'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#b7c4c9] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search settings"
              className="w-56 pl-8 pr-2.5 py-1.5 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>

          {/* Scope. One client turns the table into a plain checklist. */}
          <div className="relative">
            <button
              onClick={() => setClientOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] hover:border-[#2A96A8] transition-colors"
            >
              {client}
              <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />
            </button>
            {clientOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setClientOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-[8px] shadow-xl border border-[var(--stroke)] py-1 z-50">
                  {[ALL, ...CLIENTS].map(c => (
                    <button
                      key={c}
                      onClick={() => { setClient(c); setClientOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        c === client ? 'bg-[#e5f2f4] text-[#1e7d8f]' : 'text-[#092E3F] hover:bg-[#fafbfb]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={TABLE_SHELL}>
          <div className={GRID_SCROLL}>
            <div className={`grid grid-cols-[minmax(210px,1.3fr)_minmax(140px,0.7fr)_minmax(150px,0.8fr)_minmax(220px,1.6fr)_46px] gap-3 ${GRID_HEAD}`}>
              <div>Setting</div>
              <div>Category</div>
              <div>{single ? 'Status' : 'Configured'}</div>
              <div>{single ? 'What it does' : 'Not configured on'}</div>
              <div />
            </div>

            {matches.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#6b828c]">No settings match this filter.</p>
            )}

            <div className={GRID_BODY}>
              {visible.map(({ item, missing, configured, total }) => {
                const Icon = CATEGORY_ICON[item.category];
                const ok = missing.length === 0;
                return (
                  <div
                    key={item.key}
                    onClick={() => setDetailKey(item.key)}
                    className={`grid grid-cols-[minmax(210px,1.3fr)_minmax(140px,0.7fr)_minmax(150px,0.8fr)_minmax(220px,1.6fr)_46px] gap-3 items-center cursor-pointer ${GRID_ROW}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                      <p className="font-mono text-sm font-medium text-[#092E3F] truncate">{item.key}</p>
                    </div>

                    <div className="text-sm text-[#092E3F]/70 truncate">{item.category}</div>

                    {single ? (
                      <div>
                        {ok ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-sm text-emerald-600 bg-emerald-50">
                            <Check className="w-3.5 h-3.5" />Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-sm text-red-600 bg-red-50">
                            <AlertTriangle className="w-3.5 h-3.5" />Not configured
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm tabular-nums shrink-0 ${ok ? 'text-[#092E3F]' : 'text-[#b73520] font-medium'}`}>
                          {configured}/{total}
                        </span>
                        {/* One bar reads faster than nine chips when scanning
                            for the settings with the widest gap. */}
                        <span className="h-1.5 flex-1 min-w-[40px] max-w-[90px] rounded-[8px] bg-[#eef1f3] overflow-hidden">
                          <span
                            className={`block h-full rounded-[8px] ${ok ? 'bg-[#399193]' : 'bg-[#c07d1e]'}`}
                            style={{ width: `${(configured / total) * 100}%` }}
                          />
                        </span>
                      </div>
                    )}

                    <div className="min-w-0">
                      {single ? (
                        <p className="text-sm text-[#092E3F]/70 truncate">{item.what}</p>
                      ) : ok ? (
                        <p className="text-sm text-[#6b828c]">—</p>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {missing.slice(0, 2).map(c => (
                            <span key={c} className="px-2 py-0.5 rounded-[8px] text-sm bg-[#eef1f3] text-[#495565]">{c}</span>
                          ))}
                          {missing.length > 2 && (
                            <span className="px-2 py-0.5 rounded-[8px] text-sm bg-[#eef1f3] text-[#495565]">
                              +{missing.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <ChevronRight className="w-4 h-4 text-[#87999f]" />
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={matches.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {detail && (() => {
        const Icon = CATEGORY_ICON[detail.category];
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDetailKey(null)} />
            <div className="relative w-[560px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#2A96A8]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-white truncate">{detail.key}</p>
                  <p className="text-xs text-white/60">{detail.category}</p>
                </div>
                <button
                  onClick={() => setDetailKey(null)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[8px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-6">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1.5">What it is</p>
                  <p className="text-sm text-[#092E3F] leading-relaxed">{detail.what}</p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1.5">While it is missing</p>
                  <p className="text-sm text-[#092E3F] leading-relaxed">{detail.cost}</p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">
                    Per client
                  </p>
                  <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden divide-y divide-gray-100">
                    {CLIENTS.map(c => {
                      const missing = detail.missing.includes(c);
                      return (
                        <div key={c} className="flex items-center justify-between px-3.5 py-2.5">
                          <span className="text-sm text-[#092E3F]">{c}</span>
                          {missing ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-sm text-red-600 bg-red-50">
                              <AlertTriangle className="w-3.5 h-3.5" />Not configured
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-sm text-emerald-600 bg-emerald-50">
                              <Check className="w-3.5 h-3.5" />Configured
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: 'good' | 'bad';
}) {
  return (
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 truncate ${
        accent === 'good' ? 'text-[#2f7d52]' : accent === 'bad' ? 'text-[#b73520]' : 'text-[#092E3F]'
      }`}>
        {value}
      </p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}
