import { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Workflow, Plus, Copy, MoreHorizontal, Search,
  ShieldCheck, ChevronRight, AlertTriangle, Sparkles, List, LayoutGrid,
} from 'lucide-react';
import {
  MOCK_FLOWS, TRIGGER_BY_ID, CONDITION_BY_ID, ACTION_BY_ID,
  GROUP_LABEL, GROUP_SHORT, emptyFlow, cloneFlow as makeCopy,
  type Flow, type Group,
} from './flowRegister';
import {
  RECOMMENDATIONS, recommendationToFlow, recScope, type Recommendation,
} from './flowRecommendations';
import FlowBuilderAB from './FlowBuilderAB';
import Switch from './Switch';
import { TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_BODY, TABLE_ROW, TABLE_TD } from './tableStyles';

type Tab = 'recommended' | 'mine';
type View = 'list' | 'cards';

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

const GROUP_CHIP: Record<Group, string> = {
  alert: 'bg-[#eef1f3] text-[#5c707a]',
  schedule: 'bg-[#eef1f3] text-[#5c707a]',
  platform: 'bg-[#eef1f3] text-[#5c707a]',
};

const groupOf = (f: Flow): Group | null => (f.trigger ? TRIGGER_BY_ID[f.trigger].group : null);

/** An action that changes the customer's estate, running with nobody in the loop. */
const unapproved = (f: Flow) =>
  f.actions.some(a => ACTION_BY_ID[a.action].destructive) &&
  !f.conditions.some(c => c.id === 'approval' && c.value);

const customersOf = (f: Flow) => f.conditions.find(c => c.id === 'customers')?.value;

export default function ResponseFlows() {
  const [flows, setFlows] = useState<Flow[]>(MOCK_FLOWS);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<Group | 'all'>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('recommended');
  const [view, setView] = useState<View>('list');

  const filtered = useMemo(() => flows.filter(f => {
    if (groupFilter !== 'all' && groupOf(f) !== groupFilter) return false;
    const q = search.toLowerCase();
    return !q
      || f.name.toLowerCase().includes(q)
      || (f.trigger ? TRIGGER_BY_ID[f.trigger].name.toLowerCase().includes(q) : false)
      || f.actions.some(a => ACTION_BY_ID[a.action].name.toLowerCase().includes(q));
  }), [flows, search, groupFilter]);

  const activeCount = flows.filter(f => f.isActive).length;
  const changingCount = flows.filter(f =>
    f.isActive && f.actions.some(a => ACTION_BY_ID[a.action].destructive)).length;
  const riskyCount = flows.filter(f => f.isActive && unapproved(f)).length;

  // A recommendation has three states, not two: never adopted, adopted but
  // switched off, and running. The switch shows the third; `adopted` tells the
  // first two apart so an existing-but-paused flow isn't offered as if it were
  // new.
  const adoptedOf = (r: Recommendation) => flows.find(f => f.name === r.name);
  const recOn = (r: Recommendation) => !!adoptedOf(r)?.isActive;
  const openRecs = RECOMMENDATIONS.filter(r => !recOn(r));

  const recs = useMemo(() => RECOMMENDATIONS.filter(r => {
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q);
  }), [search]);

  const adopt = (r: Recommendation) => setEditing(adoptedOf(r) ?? recommendationToFlow(r));

  /**
   * Turning one on adopts it if it isn't already a flow. Turning it off keeps
   * the flow — switching off is pausing, not throwing away whatever was edited
   * since it was adopted.
   */
  const toggleRec = (r: Recommendation) => {
    const existing = adoptedOf(r);
    if (existing) {
      setFlows(prev => prev.map(f => (f.id === existing.id ? { ...f, isActive: !f.isActive } : f)));
      toast.success(`${existing.isActive ? 'Disabled' : 'Enabled'}: ${r.name}`);
      return;
    }
    setFlows(prev => [...prev, { ...recommendationToFlow(r), isActive: true }]);
    toast.success(`Enabled: ${r.name}`);
  };

  const saveFlow = (flow: Flow) => {
    setFlows(prev => prev.some(f => f.id === flow.id) ? prev.map(f => f.id === flow.id ? flow : f) : [...prev, flow]);
    setEditing(null);
  };

  const cloneFlow = (flow: Flow) => {
    setFlows(prev => [...prev, makeCopy(flow, `${flow.name} (copy)`)]);
    setOpenMenu(null);
    toast.success(`Cloned: ${flow.name}`);
  };

  const toggleFlow = (id: string) => {
    setFlows(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (!f.isActive && (!f.trigger || f.actions.length === 0)) {
        toast.error(`Can't enable ${f.name} — it has no trigger or no actions`);
        return f;
      }
      toast.success(`${f.isActive ? 'Disabled' : 'Enabled'}: ${f.name}`);
      return { ...f, isActive: !f.isActive };
    }));
  };

  if (editing) {
    return <FlowBuilderAB flow={editing} onSave={saveFlow} onBack={() => setEditing(null)} />;
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Workflow className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#092E3F] text-xl font-semibold">Response Flows</h1>
              <p className="text-sm text-[#092E3F]/60">
                What starts a flow decides what it can be asked about and what it can do.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditing(emptyFlow())}
            className="flex items-center gap-2 px-4 py-2 bg-[#092e3f] text-white rounded-[8px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New flow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard icon={Workflow} tint="text-[#2A96A8]" label="Active flows"
            value={<>{activeCount}<span className="text-sm text-[#6b828c] font-normal"> / {flows.length}</span></>} />
          <StatCard icon={ShieldCheck} tint="text-[#c2453d]" label="Change the estate" value={changingCount}
            hint="Isolate, disable, revoke, block or quarantine" />
          <StatCard
            icon={AlertTriangle}
            tint={riskyCount > 0 ? 'text-[#c2453d]' : 'text-[#2f7d52]'}
            label="Running without approval"
            value={riskyCount}
            hint={riskyCount === 0 ? 'Every estate change has a human in the loop' : 'No Approval condition on these'}
          />
        </div>

        {/* Tabs — recommendations first, because that is what the page is for.
            Your own flows are one click away and keep their own filters. */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
            {([['recommended', 'Recommended', openRecs.length], ['mine', 'Your flows', flows.length]] as const).map(
              ([id, label, n]) => (
                <button
                  key={id}
                  onClick={() => setTab(id as Tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors ${
                    tab === id ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'
                  }`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-[8px] text-[10px] ${
                    tab === id ? 'bg-[#eef1f3] text-[#5c707a]' : 'bg-white/60 text-[#87999f]'
                  }`}>
                    {n}
                  </span>
                </button>
              ))}
          </div>

          {tab === 'recommended' && (
            <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
              {([['list', List, 'List view'], ['cards', LayoutGrid, 'Card view']] as const).map(([id, Icon, title]) => (
                <button
                  key={id}
                  onClick={() => setView(id as View)}
                  title={title}
                  className={`w-7 h-7 flex items-center justify-center rounded-[8px] transition-colors ${
                    view === id ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#6b828c] hover:text-[#092E3F]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'recommended' && (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search recommendations…"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
                />
              </div>
            </div>

            {view === 'list'
              ? <RecList recs={recs} on={recOn} adopted={adoptedOf} onToggle={toggleRec} onReview={adopt} />
              : <RecCards recs={recs} on={recOn} adopted={adoptedOf} onToggle={toggleRec} onReview={adopt} />}

            {recs.length === 0 && (
              <div className="text-center py-12 bg-white border border-[var(--stroke)] rounded-[8px]">
                <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recommendations match</p>
              </div>
            )}
          </>
        )}

        {tab === 'mine' && (
          <>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search flows, triggers, actions…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
            {(['all', ...GROUPS] as const).map(o => (
              <button
                key={o}
                onClick={() => setGroupFilter(o as Group | 'all')}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors ${
                  groupFilter === o ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'
                }`}
              >
                {o === 'all' ? 'All triggers' : GROUP_LABEL[o as Group]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className={TABLE_SHELL}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  {['Flow', 'Starts on', 'Only when', 'Customers', 'Status', 'Last run', 'Runs (30d)', 'Enabled'].map((h, i) => (
                    <th key={i} className={`${TABLE_TH} ${i === 7 ? 'w-28' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {filtered.map(flow => {
                  const t = flow.trigger ? TRIGGER_BY_ID[flow.trigger] : null;
                  const risky = flow.isActive && unapproved(flow);
                  return (
                    <tr
                      key={flow.id}
                      onClick={() => setEditing(flow)}
                      className={`${TABLE_ROW} cursor-pointer align-top`}
                    >
                      <td className={TABLE_TD}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#092E3F]">{flow.name}</span>
                          {flow.isPrebuilt && (
                            <span className="px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#eef1f3] text-[#5c707a]">Seculyze</span>
                          )}
                          {risky && (
                            <span
                              title="Changes the estate with no Approval condition"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />no approval
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {flow.actions.slice(0, 4).map(a => {
                            const d = ACTION_BY_ID[a.action];
                            return (
                              <span
                                key={a.key}
                                title={d.system}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium ${
                                  d.destructive ? 'bg-[#f7e6e4] text-[#c2453d]' : 'bg-[#eef1f3] text-[#5c707a]'
                                }`}
                              >
                                {d.name}
                              </span>
                            );
                          })}
                          {flow.actions.length > 4 && (
                            <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a]">+{flow.actions.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className={TABLE_TD}>
                        {t ? (
                          <>
                            <p className="text-sm text-[#092E3F]">{t.name}</p>
                            <p className="text-[10px] text-[#87999f] mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded-[8px] ${GROUP_CHIP[t.group]}`}>{GROUP_SHORT[t.group]}</span>
                            </p>
                          </>
                        ) : <span className="text-sm text-[#c07d1e]">Not set</span>}
                      </td>
                      <td className={TABLE_TD}>
                        {flow.conditions.length === 0
                          ? <span className="text-sm text-[#87999f]">Always</span>
                          : (
                            <>
                              <p className="text-sm text-[#092E3F]">{CONDITION_BY_ID[flow.conditions[0].id].name}</p>
                              <p className="text-[10px] text-[#87999f] mt-0.5 truncate max-w-[180px]">
                                {flow.conditions[0].operator} {flow.conditions[0].value}
                                {flow.conditions.length > 1 ? ` +${flow.conditions.length - 1}` : ''}
                              </p>
                            </>
                          )}
                      </td>
                      <td className={TABLE_TD}>
                        <span className={`text-sm ${customersOf(flow) ? 'text-[#092E3F]' : 'text-[#c07d1e]'}`}>
                          {customersOf(flow) ?? 'Not scoped'}
                        </span>
                      </td>
                      <td className={TABLE_TD}>
                        <span className={`inline-flex items-center gap-1.5 text-sm ${flow.isActive ? 'text-[#2f7d52]' : 'text-[#87999f]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${flow.isActive ? 'bg-[#2f7d52]' : 'bg-[#b7c4c9]'}`} />
                          {flow.isActive ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className={TABLE_TD}>
                        <span className="text-sm text-[#6b828c]">{flow.lastRun ?? '—'}</span>
                      </td>
                      <td className={TABLE_TD}>
                        <span className="text-sm text-[#6b828c]">{flow.runs30d ?? 0}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative flex items-center gap-1">
                          <Switch
                            on={flow.isActive}
                            onChange={() => toggleFlow(flow.id)}
                            title={flow.isActive ? `Disable ${flow.name}` : `Enable ${flow.name}`}
                          />
                          <button
                            onClick={() => setOpenMenu(openMenu === flow.id ? null : flow.id)}
                            className="p-1.5 rounded-[8px] text-[#6b828c] hover:bg-[#f0f3f4] hover:text-[#092E3F] transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === flow.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-[8px] shadow-xl border border-[var(--stroke)] py-1 z-50">
                                <button onClick={() => { setEditing(flow); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
                                  <ChevronRight className="w-3.5 h-3.5" /> Open builder
                                </button>
                                <button onClick={() => cloneFlow(flow)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
                                  <Copy className="w-3.5 h-3.5" /> Clone
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Workflow className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No flows match</p>
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Recommendations, list view ──────────────────────────────────────────────
// The same table the rest of the platform uses, so this reads as one product.
// The reason column is the widest, because the reason is the whole value.

function RecList({ recs, on, adopted, onToggle, onReview }: {
  recs: Recommendation[];
  on: (r: Recommendation) => boolean;
  adopted: (r: Recommendation) => Flow | undefined;
  onToggle: (r: Recommendation) => void;
  onReview: (r: Recommendation) => void;
}) {
  if (recs.length === 0) return null;
  return (
    <div className={TABLE_SHELL}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={TABLE_HEAD}>
            <tr>
              {['Recommendation', 'Why you are seeing this', 'Worth', 'What it would do', 'Enabled'].map((h, i) => (
                <th key={i} className={`${TABLE_TH} ${i === 4 ? 'w-24' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {recs.map(r => {
              const live = on(r);
              const paused = !live && !!adopted(r);
              return (
                <tr
                  key={r.id}
                  onClick={() => onReview(r)}
                  className={`${TABLE_ROW} cursor-pointer align-top`}
                >
                  <td className={TABLE_TD}>
                    <p className="text-sm font-medium text-[#092E3F] mb-1">{r.name}</p>
                    <p className="text-[11px] text-[#87999f]">{recScope(r)}</p>
                    {paused && (
                      <p className="text-[11px] text-[#c07d1e] mt-0.5">In your flows, switched off</p>
                    )}
                  </td>
                  <td className={`${TABLE_TD} max-w-[380px]`}>
                    <p className="text-sm text-[#092E3F]">{r.reason}</p>
                  </td>
                  <td className={TABLE_TD}>
                    <span className="text-sm text-[#2f7d52]">{r.impact}</span>
                  </td>
                  <td className={TABLE_TD}>
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {r.actions.map(([id]) => {
                        const d = ACTION_BY_ID[id];
                        return (
                          <span
                            key={id}
                            title={d.system}
                            className={`px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium ${
                              d.destructive ? 'bg-[#f7e6e4] text-[#c2453d]' : 'bg-[#eef1f3] text-[#5c707a]'
                            }`}
                          >
                            {d.name}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      on={live}
                      onChange={() => onToggle(r)}
                      title={live ? `Disable ${r.name}` : `Enable ${r.name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Recommendations, card view ──────────────────────────────────────────────
// Same content, more room for the reason — which is what you actually read to
// decide. Cards carry their own border, like every other card in the app.

function RecCards({ recs, on, adopted, onToggle, onReview }: {
  recs: Recommendation[];
  on: (r: Recommendation) => boolean;
  adopted: (r: Recommendation) => Flow | undefined;
  onToggle: (r: Recommendation) => void;
  onReview: (r: Recommendation) => void;
}) {
  if (recs.length === 0) return null;
  return (
    <div className="grid gap-4 grid-cols-1 min-[780px]:grid-cols-2 min-[1320px]:grid-cols-3">
      {recs.map(r => {
        const live = on(r);
        const paused = !live && !!adopted(r);
        return (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => onReview(r)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReview(r); } }}
            className={`text-left flex flex-col bg-white border rounded-[8px] p-4 cursor-pointer
                        transition-colors ${live ? 'border-[#2A96A8]' : 'border-[var(--stroke)] hover:border-[#2A96A8]'}`}
          >
            {/* Name, then scope, then worth — each on its own line. Sharing a
                row with the impact squeezed a long title into a column two
                words wide. */}
            <p className="text-sm font-medium text-[#092E3F]">{r.name}</p>
            <p className="text-[11px] text-[#87999f] mt-0.5">{recScope(r)}</p>
            {paused && <p className="text-[11px] text-[#c07d1e] mt-0.5">In your flows, switched off</p>}
            <p className="text-xs text-[#2f7d52] mt-2">{r.impact}</p>

            <p className="text-sm text-[#092E3F] mt-2 flex-1">{r.reason}</p>

            <div className="flex flex-wrap gap-1 mt-3">
              {r.actions.map(([id]) => {
                const d = ACTION_BY_ID[id];
                return (
                  <span
                    key={id}
                    title={d.system}
                    className={`px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium ${
                      d.destructive ? 'bg-[#f7e6e4] text-[#c2453d]' : 'bg-[#eef1f3] text-[#5c707a]'
                    }`}
                  >
                    {d.name}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100">
              <Switch
                on={live}
                onChange={() => onToggle(r)}
                label={live ? 'Enabled' : 'Disabled'}
                title={live ? `Disable ${r.name}` : `Enable ${r.name}`}
              />
              <span className="inline-flex items-center gap-1 text-xs text-[#6b828c]">
                Review<ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, tint, label, value, hint }: {
  icon: any; tint: string; label: string; value: React.ReactNode; hint?: string;
}) {
  return (
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${tint}`} />
        <span className="text-xs text-[#6b828c] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#092E3F]">{value}</p>
      {hint && <p className="text-[10px] text-[#87999f] mt-1">{hint}</p>}
    </div>
  );
}
