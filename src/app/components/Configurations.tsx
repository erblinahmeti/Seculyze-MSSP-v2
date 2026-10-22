import { useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal, Search, ChevronRight, ChevronDown, X, Building, Building2, LayoutGrid, Table2,
  Check, AlertTriangle, BookOpen, ExternalLink, CheckCircle2, AlertCircle,
  Shuffle, Database, Boxes, Coins,
} from 'lucide-react';
import {
  ITEMS, CLIENTS, KINDS, SCORE_MAX, SCORE_BAR, scoreFor, scoreTone, sentinelUrl,
  evidenceFor, evidenceAcross, findingGroups, NAME_LIMIT,
  fleetScore, fleetJobs,
  type ConfigItem, type Kind, type Check as ConfigCheck,
} from './configData';
import SafeguardCards from './SafeguardCards';
import {
  TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_TH_TYPE, TABLE_BODY, TABLE_ROW, TABLE_TD,
} from './tableStyles';
import Pagination from './Pagination';
import SidePanel from './SidePanel';
import { useWorkspace } from './WorkspaceContext';

// ─── Configurations ──────────────────────────────────────────────────────────
//
// The workspace settings a tenant either has in place or does not — what
// Calibrate's Configuration Score has been scoring all along.
//
// Rows are settings rather than tenants, because a gap is almost never one
// tenant's problem: the same parser tends to be missing across half the book,
// and that is the unit of work. Pick a single client to turn it into that
// tenant's own checklist, which is also when the score and the portal links
// become meaningful — both are per workspace.
//
// Against the live product this view had been dropping the evidence under each
// setting: ingestion against optimal sku, the tables UEBA needs, the breakdown
// of what is actually unhealthy. A setting is not a boolean, and the evidence
// is what someone reads before doing anything about it, so it is on the row.

const ALL = 'All clients';

const TONE = {
  good: 'text-[#2f7d52]',
  warn: 'text-[#c07d1e]',
  bad: 'text-[#b73520]',
} as const;

/** The checks under a setting — UEBA's tables, UnhealthyItems' breakdown. */
function Checks({ checks, dense }: { checks: ConfigCheck[]; dense?: boolean }) {
  return (
    <div className={`flex items-center ${dense ? 'gap-2' : 'gap-3'} flex-wrap`}>
      {checks.map(c => (
        <span
          key={c.label}
          title={c.note}
          className="inline-flex items-center gap-1 cursor-help"
        >
          {c.ok
            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2f7d52] shrink-0" />
            : <AlertCircle className="w-3.5 h-3.5 text-[#c2453d] shrink-0" />}
          <span className={`text-[11px] ${c.ok ? 'text-[#6b828c]' : 'text-[#c2453d] font-medium'}`}>
            {c.label}{!c.ok && c.count ? ` ${c.count}` : ''}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function Configurations({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  // Scope comes from the sidebar switch now, not a picker on this page. One
  // console-wide answer beats every page having its own opinion of who we are
  // looking at.
  const ws = useWorkspace();
  const client = ws.single ? ws.tenant! : ALL;
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [kindOpen, setKindOpen] = useState(false);
  const [q, setQ] = useState('');
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const single = ws.single;
  const needle = q.trim().toLowerCase();

  const rows = useMemo(() => ITEMS.map(item => {
    const scope = single ? [client] : CLIENTS;
    const missing = item.missing.filter(c => scope.includes(c));
    return { item, missing, enabled: scope.length - missing.length, total: scope.length };
  }), [client, single]);

  const matches = rows.filter(({ item }) =>
    (!needle || item.key.toLowerCase().includes(needle) || item.what.toLowerCase().includes(needle)) &&
    (kind === 'all' || item.kind === kind));

  const visible = matches.slice((page - 1) * pageSize, page * pageSize);
  // Built once; it sits inside the table's card or below the grid, the same
  // way Data Collection does it.
  const pager = (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={matches.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      variant={view === 'cards' ? 'standalone' : 'attached'}
    />
  );
  // Filtering sends you back to page one, but it does not close the panel:
  // the whole point of pinning it is to keep a setting beside you while you
  // search for the next one. A filter does not invalidate what it is showing.
  useEffect(() => { setPage(1); }, [needle, kind, client]);

  const totals = useMemo(() => {
    const scope = single ? [client] : CLIENTS;
    const cells = ITEMS.length * scope.length;
    const gaps = ITEMS.reduce((n, i) => n + i.missing.filter(c => scope.includes(c)).length, 0);
    // Enabling and updating are different jobs, and the product counts them
    // separately — one is a switch, the other is a decision about money.
    //
    // Across the fleet the unit is tenant x setting, not setting: UEBA off on
    // three tenants is three jobs, and counting it as one understates the work
    // by however many tenants are affected.
    const jobs = single
      ? {
          enable: ITEMS.filter(i => i.remedy === 'enable' && i.missing.includes(client)).length,
          update: ITEMS.filter(i => i.remedy !== 'enable' && i.missing.includes(client)).length,
        }
      : fleetJobs();
    return { cells, gaps, enabled: cells - gaps, scope, jobs, fleet: fleetScore() };
  }, [client, single]);

  const detail = detailKey ? ITEMS.find(i => i.key === detailKey) ?? null : null;
  const headlineScore = single ? scoreFor(client) : totals.fleet.lowest.score;
  const tone = scoreTone(headlineScore);

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#092E3F] flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[#092E3F] text-xl font-semibold">Configurations</h1>
              <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a]">Tuning</span>
            </div>
            <p className="text-sm text-[#092E3F]/60">
              The workspace settings behind each tenant's Configuration Score — and which ones are missing.
            </p>
          </div>
        </div>

        {/* Score. The number Calibrate has been showing, with the two kinds of
            outstanding work the product counts separately beside it. */}
        <div className="grid grid-cols-1 min-[960px]:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Configuration score</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-semibold tabular-nums ${TONE[tone]}`}>
                {headlineScore.toFixed(2)}
              </span>
              <span className="text-sm text-[#6b828c]">/ {SCORE_MAX}</span>
              <span className={`w-2 h-2 rounded-full ml-1 ${
                tone === 'good' ? 'bg-[#2f7d52]' : tone === 'warn' ? 'bg-[#c07d1e]' : 'bg-[#b73520]'
              }`} />
            </div>
            {/* Eight healthy tenants and one broken one averages well, which
                is the wrong thing to put in front of whoever has to fix the
                broken one. The fleet headline is the weakest tenant. */}
            <p className="text-xs text-[#6b828c] mt-0.5">
              {single
                ? client
                : `${totals.fleet.lowest.client} is lowest · ${totals.fleet.below} of ${CLIENTS.length} below ${SCORE_BAR}`}
            </p>
          </div>

          <StatCard
            label="Enable manually"
            value={String(totals.jobs.enable)}
            sub={totals.jobs.enable === 0
              ? 'nothing to switch on'
              : single ? 'settings to switch on' : 'tenant settings to switch on'}
            accent={totals.jobs.enable > 0 ? 'bad' : 'good'}
          />
          <StatCard
            label="Update manually"
            value={String(totals.jobs.update)}
            sub={totals.jobs.update === 0
              ? 'nothing to change'
              : single ? 'settings to review or re-tier' : 'tenant settings to review or re-tier'}
            accent={totals.jobs.update > 0 ? 'warn' : 'good'}
          />
          <StatCard
            label="Enabled"
            value={`${totals.enabled} / ${totals.cells}`}
            sub={single ? `${ITEMS.length} settings on ${client}` : `${ITEMS.length} settings × ${CLIENTS.length} clients`}
          />
        </div>

        {/* Above the settings list, because a safeguard that does not exist
            outranks a setting that is merely switched off — and because these
            disappear, so they never become furniture. */}
        <SafeguardCards onNavigate={onNavigate} />

        {/* Toolbar, matched to Incidents: a heading with its count, then a
            search that leads and takes the free width, then the controls at
            42px like every other filter row in the app. This page had them at
            30px with the search buried in the middle. */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-[#092E3F]">
            Settings <span className="text-[#092E3F]/50">({matches.length})</span>
          </h2>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-[#092E3F]/40 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-[48px] pr-4 py-[10px] bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all"
            />
          </div>

          {/* Type filter, as the dropdown Incidents uses — no chevron there,
              so none here. Four long names on a segmented control ate most of
              the row for a choice made once and left alone. */}
          <div className="relative">
            <button
              onClick={() => setKindOpen(v => !v)}
              className="flex items-center gap-2 px-[20px] py-[10px] bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-all text-sm text-[#092E3F]"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#092E3F]/60" />
              <span>{kind === 'all' ? 'All types' : kind}</span>
            </button>

            {kindOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setKindOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-[8px] shadow-xl border border-[var(--stroke)] py-2 z-50">
                  {(['all', ...KINDS] as const).map(k => {
                    const n = k === 'all' ? ITEMS.length : ITEMS.filter(i => i.kind === k).length;
                    return (
                      <button
                        key={k}
                        onClick={() => { setKind(k as Kind | 'all'); setKindOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2 ${
                          kind === k ? 'bg-[#2A96A8]/10 text-[#2A96A8]' : 'text-[#092E3F] hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{k === 'all' ? 'All types' : k}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums text-[11px] text-[#87999f]">{n}</span>
                          {kind === k && <Check className="w-4 h-4" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Scope lives in the sidebar. A second picker here would let this
              page disagree with the rest of the console, so this only reports
              it — hence a chip rather than something that looks clickable. */}
          <span className="inline-flex items-center gap-2 px-[20px] py-[10px] rounded-[8px] bg-[#eef1f3] text-sm text-[#5c707a]">
            {single ? <Building className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            {single ? client : `All ${CLIENTS.length} clients`}
          </span>

          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[8px]">
            <ViewBtn active={view === 'cards'} onClick={() => setView('cards')} icon={LayoutGrid}>Cards</ViewBtn>
            <ViewBtn active={view === 'table'} onClick={() => setView('table')} icon={Table2}>Table</ViewBtn>
          </div>
        </div>

        {view === 'cards' ? (
          <>
            {/* Card view. The same fourteen settings, one card each — closer
                to how the single-tenant product shows them, and it gives the
                description and the evidence the room the table denies them. */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {visible.map(({ item, missing, enabled, total }) => (
                <SettingCard
                  key={item.key}
                  item={item}
                  missing={missing}
                  enabled={enabled}
                  total={total}
                  single={single}
                  client={client}
                  onOpen={() => setDetailKey(item.key)}
                />
              ))}
            </div>
            {matches.length === 0
              ? <p className="px-5 py-8 text-center text-sm text-[#6b828c] bg-white border border-[var(--stroke)] rounded-[8px]">No settings match this filter.</p>
              : <div className="mt-3">{pager}</div>}
          </>
        ) : (
        /* Table. Attention and Action sit together at the end, the way every
           other table in the app pairs them. */
        <div className={TABLE_SHELL}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  {/* No Evidence column. A workspace's figures belong to that
                      workspace, and across sixty there is no single value for
                      them — what needs doing goes in Attention instead. */}
                  {['Setting', 'Type', single ? 'State' : 'Enabled', 'Documentation', 'Attention', 'Action']
                    .map((h, i) => {
                      // The last two are the act-on-it columns, banded the way
                      // Incidents bands them.
                      const banded = i >= 4;
                      return (
                        <th
                          key={i}
                          className={`${banded ? `${TABLE_TH_TYPE} text-[#6b828c] bg-[#e5f2f4]` : TABLE_TH} ${i === 5 ? 'w-40' : ''}`}
                        >
                          {h}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {visible.map(({ item, missing, enabled, total }) => {
                  const ok = missing.length === 0;
                  return (
                    <tr
                      key={item.key}
                      onClick={() => setDetailKey(item.key)}
                      className={`${TABLE_ROW} cursor-pointer align-top`}
                    >
                      <td className={TABLE_TD}>
                        <p className="font-mono font-medium text-[#092E3F]">{item.key}</p>
                        <p className="text-[11px] text-[#87999f] line-clamp-2 max-w-[280px]">{item.what}</p>
                      </td>

                      <td className={TABLE_TD}>
                        <span className="text-[#092E3F]/70">{item.kind}</span>
                      </td>

                      <td className={TABLE_TD}>
                        {single ? (
                          ok ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs text-[#2f7d52] bg-[#e3f0e8]">
                              <Check className="w-3.5 h-3.5" />Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs text-[#6b828c] bg-[#eef1f3]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#b7c4c9]" />Disabled
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`tabular-nums shrink-0 ${ok ? 'text-[#092E3F]' : 'text-[#b73520] font-medium'}`}>
                              {enabled}/{total}
                            </span>
                            <span className="h-1.5 flex-1 min-w-[40px] max-w-[70px] rounded-[8px] bg-[#eef1f3] overflow-hidden">
                              <span
                                className={`block h-full rounded-[8px] ${ok ? 'bg-[#399193]' : 'bg-[#c07d1e]'}`}
                                style={{ width: `${(enabled / total) * 100}%` }}
                              />
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Documentation only. Getting into Sentinel is Action. */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[200px]">
                          {item.docs.map(d => (
                            <a
                              key={d.url}
                              href={d.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              title={d.url}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] border border-[var(--stroke)] text-[11px] text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
                            >
                              <BookOpen className="w-3 h-3" />{d.label}
                            </a>
                          ))}
                        </div>
                      </td>

                      {/* Banded with Action — the two act-on-it columns, the
                          way Incidents bands its last two. */}
                      <td className={`${TABLE_TD} bg-[#e5f2f4]/30`}>
                        {ok ? (
                          item.observation ? (
                            <span className={`inline-flex items-center gap-1.5 text-xs ${TONE[item.observation.tone]}`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />{item.observation.text}
                            </span>
                          ) : (
                            <span className="text-[#87999f]">No observation</span>
                          )
                        ) : single ? (
                          <div className="min-w-0 max-w-[260px]">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs font-medium bg-[#f7efdf] text-[#c07d1e]">
                              <AlertTriangle className="w-3 h-3" />
                              {evidenceFor(item, client).headline ?? item.verb}
                            </span>
                            <p className="text-[11px] text-[#87999f] mt-1 line-clamp-2">{item.cost}</p>
                          </div>
                        ) : (
                          <div className="min-w-0 max-w-[280px]">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs font-medium bg-[#f7efdf] text-[#c07d1e]">
                              <AlertTriangle className="w-3 h-3" />
                              Missing on {missing.length} client{missing.length === 1 ? '' : 's'}
                            </span>
                            <FleetFindings item={item} missing={missing} />
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 bg-[#e5f2f4]/30" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {ok ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#2f7d52]">
                              <Check className="w-3.5 h-3.5" />Done
                            </span>
                          ) : (
                            <button
                              onClick={() => setDetailKey(item.key)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[#2A96A8] text-white text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                            >
                              {item.verb}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {single && (
                            <a
                              href={sentinelUrl(item.blade, client)}
                              target="_blank"
                              rel="noreferrer noopener"
                              title={`Open this setting in ${client}'s Sentinel workspace`}
                              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] border border-[var(--stroke)] text-[#6b828c] hover:border-[#2A96A8] hover:text-[#092E3F] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {matches.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#6b828c]">No settings match this filter.</p>
          ) : pager}
        </div>
        )}
      </div>

      {detail && (
        <Detail
          item={detail}
          client={client}
          single={single}
          onClose={() => setDetailKey(null)}
        />
      )}
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function Detail({ item, client, single, onClose }: {
  item: ConfigItem; client: string; single: boolean; onClose: () => void;
}) {
  return (
    <SidePanel
      id="configuration-detail"
      open
      onClose={onClose}
      header={
        <>
          <p className="font-mono text-sm font-medium text-white truncate">{item.key}</p>
          <p className="text-xs text-white/60">{item.kind}</p>
        </>
      }
    >

        {/* A column rather than one long scroll: the parts that explain the
            setting keep their natural height, and the client list takes
            whatever is left. On a tall screen that is most of the panel, which
            is the point — scrolling a 320px window inside a half-empty drawer
            was wasting the screen it was given. */}
        <div className="flex-1 min-h-0 p-6 flex flex-col gap-6">
          <div className="shrink-0 space-y-6 overflow-y-auto max-h-[55%]">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1.5">What it is</p>
            <p className="text-sm text-[#092E3F] leading-relaxed">{item.what}</p>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1.5">While it is missing</p>
            <p className="text-sm text-[#092E3F] leading-relaxed">{item.cost}</p>
          </div>

          {/* Evidence is one workspace's, so it only appears when one is in
              view. Across the book the per-client list below carries each
              tenant's own finding instead. */}
          {single && (() => {
            const ev = evidenceFor(item, client);
            if (!ev.metrics && !ev.checks && !ev.observation) return null;
            return (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">
                Evidence on {client}
              </p>
              <div className="border border-[var(--stroke)] rounded-[8px] p-3.5 space-y-3">
                {ev.observation && (
                  <p className={`flex items-center gap-1.5 text-sm ${TONE[ev.observation.tone]}`}>
                    {ev.observation.tone === 'good'
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <AlertTriangle className="w-4 h-4" />}
                    {ev.observation.text}
                  </p>
                )}
                {ev.metrics && (
                  <div className="flex items-start gap-4 flex-wrap">
                    {ev.metrics.map(m => (
                      <div key={m.label}>
                        <p className="text-[10px] text-[#87999f]">{m.label}</p>
                        <p className={`text-sm tabular-nums ${m.bad ? 'text-[#c2453d] font-medium' : 'text-[#092E3F]'}`}>
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {ev.checks && (
                  <div className="space-y-1.5">
                    {ev.checks.map(c => (
                      <div key={c.label} className="flex items-start gap-2">
                        {c.ok
                          ? <CheckCircle2 className="w-4 h-4 text-[#2f7d52] shrink-0 mt-0.5" />
                          : <AlertCircle className="w-4 h-4 text-[#c2453d] shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <p className="text-sm text-[#092E3F]">
                            {c.label}{!c.ok && c.count ? ` — ${c.count} failing` : ''}
                          </p>
                          <p className={`text-[11px] ${c.ok ? 'text-[#87999f]' : 'text-[#c2453d]'}`}>{c.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">{item.verb}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {item.docs.map(d => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-[var(--stroke)] text-sm text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
                >
                  <BookOpen className="w-4 h-4" />{item.docs.length === 1 ? 'How to do it' : d.label}
                </a>
              ))}
              {single ? (
                <a
                  href={sentinelUrl(item.blade, client)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[#2A96A8] text-white text-sm font-medium hover:bg-[#1e7d8f] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />Open in {client}'s Sentinel
                </a>
              ) : (
                <span className="text-xs text-[#87999f]">
                  Pick a single client above to open its Sentinel workspace.
                </span>
              )}
            </div>
          </div>

          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex items-baseline justify-between gap-2 mb-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Per client</p>
              <p className="text-[10px] text-[#87999f]">
                {item.missing.length} of {CLIENTS.length} need attention
              </p>
            </div>
            {/* Affected tenants first — at sixty clients the ones that are
                fine are the ones you scroll past. */}
            <div className="flex-1 min-h-0 border border-[var(--stroke)] rounded-[8px] overflow-y-auto divide-y divide-gray-100">
              {evidenceAcross(item)
                .sort((a, b) => Number(b.off) - Number(a.off))
                .map(({ client: c, off, evidence }) => (
                  <div key={c} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-[#092E3F]">{c}</p>
                      {/* Each tenant's own finding — two unhealthy items on one
                          and four on another are two different jobs. */}
                      {evidence.headline && (
                        <p className="text-[11px] text-[#c07d1e] mt-0.5">{evidence.headline}</p>
                      )}
                      {!evidence.headline && evidence.observation?.tone === 'good' && (
                        <p className="text-[11px] text-[#87999f] mt-0.5">{evidence.observation.text}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {off ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs text-[#6b828c] bg-[#eef1f3]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b7c4c9]" />Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[8px] text-xs text-[#2f7d52] bg-[#e3f0e8]">
                          <Check className="w-3.5 h-3.5" />Enabled
                        </span>
                      )}
                      {/* A gap is fixed one tenant at a time. */}
                      <a
                        href={sentinelUrl(item.blade, c)}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={`Open in ${c}'s Sentinel workspace`}
                        className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#87999f] hover:bg-[#f1f4f5] hover:text-[#092E3F] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
    </SidePanel>
  );
}

// ─── Card view ───────────────────────────────────────────────────────────────
//
// Built to the same anatomy as the Data Collection cards, because two card
// designs in one product is the inconsistency this page keeps being pulled up
// on. That anatomy is four bands:
//
//   head      icon tile, mono name, and the way in on the right
//   strip     the numbers, big, divided, scannable across cards
//   callout   one tinted block for the single thing this card is telling you
//   foot      the quiet supporting line, and the links
//
// The first version of this had none of it — a grey header and three stacked
// label/value blocks, which is a table row drawn taller. The strip is what
// makes a grid of these readable: your eye runs down a column of figures
// instead of reading fourteen paragraphs.

const KIND_ICON: Record<Kind, any> = {
  'Normalization Function': Shuffle,
  'Workspace Configuration': Database,
  'Product Settings': Boxes,
  'Sku Level': Coins,
};

/**
 * Each setting carries an equal share of the 20 points, so the weight itself
 * is the same on all fourteen cards and says nothing. What differs — and what
 * the strip reports — is how many of those points are currently being lost.
 */
const PER_SETTING = SCORE_MAX / ITEMS.length;
const atRisk = (n: number) => (n * PER_SETTING).toFixed(2);

function Cell({ label, value, tone, first }: {
  label: string; value: string; tone?: 'good' | 'warn' | 'bad'; first?: boolean;
}) {
  return (
    <div className={`py-3 ${first ? 'pl-5' : 'pl-3'} pr-3`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${tone ? TONE[tone] : 'text-[#092E3F]'}`}>
        {value}
      </p>
    </div>
  );
}

function SettingCard({ item, missing, enabled, total, single, client, onOpen }: {
  item: ConfigItem; missing: string[]; enabled: number; total: number;
  single: boolean; client: string; onOpen: () => void;
}) {
  // How the rest of the book is doing on this setting. Worth a cell even when
  // looking at one tenant: "seven of your other clients already have this" is
  // context the single-tenant product cannot give you, and it is the argument
  // for turning it on here.
  const fleetOn = CLIENTS.filter(c => !item.missing.includes(c)).length;
  // Only meaningful with one workspace in view; across the book the card
  // reports the spread instead.
  const ev = single ? evidenceFor(item, client) : null;
  const ok = missing.length === 0;
  const Icon = KIND_ICON[item.kind];

  // The strip. In one workspace it is that workspace's own figures; across
  // nine there is no such number, so it reports the spread instead.
  const cells: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }[] =
    single
      ? ev?.metrics?.length
        ? [
            { label: 'State', value: ok ? 'Enabled' : 'Disabled', tone: ok ? ('good' as const) : ('warn' as const) },
            ...ev.metrics.slice(0, 3).map(m => ({
              label: m.label, value: m.value, tone: m.bad ? ('bad' as const) : undefined,
            })),
          ]
        : [
            { label: 'State', value: ok ? 'Enabled' : 'Disabled', tone: ok ? ('good' as const) : ('warn' as const) },
            { label: 'Across your book', value: `${fleetOn}/${CLIENTS.length}` },
            { label: 'Score', value: ok ? `+${atRisk(1)}` : `−${atRisk(1)}`, tone: ok ? ('good' as const) : ('bad' as const) },
          ]
      : [
          { label: 'Enabled', value: `${enabled}/${total}`, tone: ok ? undefined : 'bad' },
          { label: 'Not configured', value: String(missing.length), tone: ok ? 'good' : 'warn' },
          { label: 'Score lost', value: ok ? '—' : atRisk(missing.length), tone: ok ? undefined : 'bad' },
        ];

  return (
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] overflow-hidden flex flex-col">
      {/* Head */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3.5">
        <div className="w-9 h-9 rounded-[8px] bg-[#e5f2f4] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[#1e7d8f]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-[#092E3F] truncate">{item.key}</p>
          <p className="text-[11px] text-[#6b828c] truncate">{item.kind}</p>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-[var(--stroke)] text-xs font-medium text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
        >
          Details<ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* What it is. Data Collection's cards have no description because a
          log source name is self-explanatory; a parser name is not. */}
      <p className="px-5 pb-3.5 text-[13px] leading-relaxed text-[#092E3F]/75 line-clamp-2">
        {item.what}
      </p>

      {/* Strip */}
      <div
        className="grid border-y border-[var(--stroke)] divide-x divide-[var(--stroke)]"
        style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
      >
        {cells.map((c, i) => <Cell key={c.label} {...c} first={i === 0} />)}
      </div>

      {/* Callout — the one thing this card is telling you */}
      <div className="flex-1 px-5 pt-3.5">
        <div className={`rounded-[8px] p-3.5 ${ok ? 'bg-[#f3f7f8]' : 'bg-[#fdf6e9]'}`}>
          <p className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide mb-1.5 ${
            ok ? 'text-[#1e7d8f]' : 'text-[#c07d1e]'
          }`}>
            {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {ok ? 'Nothing outstanding' : single ? 'Needs attention' : 'Not configured everywhere'}
          </p>

          <p className="text-sm text-[#092E3F]">
            {ok
              ? (ev?.observation?.text ?? `In place on ${single ? client : `all ${total} clients`}`)
              : single
                ? (ev?.headline ?? item.cost)
                : `${missing.length} of ${total} ${item.fleetUnit}`}
          </p>

          <div className="flex items-end justify-between gap-3 mt-2">
            {/* Only the fleet view has something to add here — naming the
                clients. In one tenant the button already says the verb. */}
            <p className="text-[11px] text-[#6b828c] min-w-0 truncate">
              {!ok && !single ? missing.join(', ') : ''}
            </p>
            {!ok && (
              <button
                onClick={onOpen}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[#2A96A8] text-white text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
              >
                {item.verb}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Foot — the supporting line on the left, the links on the right */}
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          {single && ev?.checks ? (
            <Checks checks={ev.checks} dense />
          ) : (
            <p className="text-[11px] text-[#b7c4c9]">
              {single
                ? fleetOn === CLIENTS.length
                  ? 'Every client has this'
                  : `${CLIENTS.length - fleetOn} other client${CLIENTS.length - fleetOn === 1 ? '' : 's'} also missing it`
                : `${total} clients in scope`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.docs.map(d => (
            <a
              key={d.url}
              href={d.url}
              target="_blank"
              rel="noreferrer noopener"
              title={d.url}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] border border-[var(--stroke)] text-[11px] text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
            >
              <BookOpen className="w-3 h-3" />{d.label}
            </a>
          ))}
          {single && (
            <a
              href={sentinelUrl(item.blade, client)}
              target="_blank"
              rel="noreferrer noopener"
              title={`Open this setting in ${client}'s Sentinel workspace`}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] border border-[var(--stroke)] text-[#6b828c] hover:border-[#2A96A8] hover:text-[#092E3F] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewBtn({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: typeof LayoutGrid; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]'
          : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

/**
 * What an Attention cell says about a fleet.
 *
 * With a handful of affected tenants the names are the information. With
 * forty, three arbitrary names out of forty are not — and they cost three
 * lines on every row. Past that the findings are grouped instead: how many
 * are on the wrong sku beats which three happen to sort first.
 */
function FleetFindings({ item, missing }: { item: ConfigItem; missing: string[] }) {
  if (missing.length <= NAME_LIMIT) {
    return (
      <ul className="mt-1 space-y-0.5">
        {missing.map(c => {
          const head = evidenceFor(item, c).headline;
          return (
            <li key={c} className="text-[11px] text-[#6b828c] truncate">
              <span className="text-[#092E3F]">{c}</span>{head ? ` — ${head}` : ''}
            </li>
          );
        })}
      </ul>
    );
  }

  const groups = findingGroups(item);
  if (groups.length === 0) {
    // Nothing to group — a parser is simply absent, so the count said it all.
    return <p className="text-[11px] text-[#87999f] mt-1 line-clamp-2">{item.cost}</p>;
  }

  const shown = groups.slice(0, 2);
  const rest = groups.slice(2).reduce((n, g) => n + g.clients.length, 0);
  return (
    <ul className="mt-1 space-y-0.5">
      {shown.map(g => (
        <li key={g.finding} className="text-[11px] text-[#6b828c] truncate">
          <span className="tabular-nums text-[#092E3F]">{g.clients.length}</span>
          {' \u00d7 '}{g.finding}
        </li>
      ))}
      {rest > 0 && (
        <li className="text-[11px] text-[#87999f]">
          +{rest} across {groups.length - 2} other finding{groups.length - 2 === 1 ? '' : 's'}
        </li>
      )}
    </ul>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 truncate ${
        accent ? TONE[accent] : 'text-[#092E3F]'
      }`}>
        {value}
      </p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}
