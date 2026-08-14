import { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Workflow, Plus, Copy, MoreHorizontal, Search, Play, Pause,
  Zap, ShieldCheck, ChevronRight, AlertTriangle, X, Sparkles,
} from 'lucide-react';
import {
  SoarFlow, MOCK_FLOWS, Category, CATEGORIES,
  ACTION_BY_ID, TRIGGER_BY_ID, CONDITION_BY_ID,
  blockedCount, emptyFlow, permissionFor, cloneFlow as makeCopy,
} from './soarData';
import FlowBuilder from './FlowBuilder';

const CATEGORY_CLASS: Record<Category, string> = {
  'SOC automation': 'bg-[#f7e6e4] text-[#c2453d]',
  'Calibrate': 'bg-[#e5f2f4] text-[#1e7d8f]',
  'Cost': 'bg-[#f7efdf] text-[#c07d1e]',
  'Enrich': 'bg-[#ede7f6] text-[#6a4fb6]',
  'Reporting': 'bg-[#e3f0e8] text-[#2f7d52]',
};

export default function ResponseFlows() {
  const [flows, setFlows] = useState<SoarFlow[]>(MOCK_FLOWS);
  const [editing, setEditing] = useState<SoarFlow | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const filtered = useMemo(() => flows.filter(f => {
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    const q = search.toLowerCase();
    return !q
      || f.name.toLowerCase().includes(q)
      || (f.trigger ? TRIGGER_BY_ID[f.trigger].name.toLowerCase().includes(q) : false)
      || f.actions.some(a => ACTION_BY_ID[a.action].name.toLowerCase().includes(q));
  }), [flows, search, categoryFilter]);

  const activeCount = flows.filter(f => f.isActive).length;
  const containingCount = flows.filter(f =>
    f.isActive && f.actions.some(a => ACTION_BY_ID[a.action].cls === 'containment')
  ).length;
  const brokenCount = flows.filter(f => blockedCount(f) > 0).length;

  const saveFlow = (flow: SoarFlow) => {
    setFlows(prev => prev.some(f => f.id === flow.id) ? prev.map(f => f.id === flow.id ? flow : f) : [...prev, flow]);
    setEditing(null);
  };

  const cloneFlow = (flow: SoarFlow) => {
    setFlows(prev => [...prev, { ...makeCopy(flow), priority: prev.length + 1 }]);
    setOpenMenu(null);
    toast.success(`Cloned: ${flow.name}`);
  };

  const toggleFlow = (id: string) => {
    setFlows(prev => prev.map(f => {
      if (f.id !== id) return f;
      if (!f.isActive && blockedCount(f) > 0) {
        toast.error(`Can't enable ${f.name} — it has steps that can't run`);
        return f;
      }
      toast.success(`${f.isActive ? 'Disabled' : 'Enabled'}: ${f.name}`);
      return { ...f, isActive: !f.isActive };
    }));
  };

  if (editing) {
    return <FlowBuilder flow={editing} onSave={saveFlow} onBack={() => setEditing(null)} />;
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Workflow className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#092E3F] text-xl font-semibold">Response Flows</h1>
              <p className="text-sm text-[#092E3F]/60">What starts a flow decides what it may ever do. Containment always runs behind safety checks.</p>
            </div>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New flow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard icon={Workflow} tint="text-[#2A96A8]" label="Active flows"
            value={<>{activeCount}<span className="text-sm text-[#6b828c] font-normal"> / {flows.length}</span></>} />
          <StatCard icon={ShieldCheck} tint="text-[#c2453d]" label="Can contain" value={containingCount}
            hint="Only confirmed-threat flows reach containment" />
          <StatCard icon={AlertTriangle} tint={brokenCount > 0 ? 'text-[#c2453d]' : 'text-[#2f7d52]'} label="Flows with blocked steps" value={brokenCount}
            hint={brokenCount === 0 ? 'Every flow validates' : 'These can’t be enabled'} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search flows, triggers, actions…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[4px] p-1">
            {(['all', ...CATEGORIES] as const).map(o => (
              <button
                key={o}
                onClick={() => setCategoryFilter(o as Category | 'all')}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors ${
                  categoryFilter === o ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'
                }`}
              >
                {o === 'all' ? 'All categories' : o}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-[6px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e9eb]">
                  {['Flow', 'Starts on', 'Only for', 'Tenants', 'Category', 'Status', 'Last run', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-left text-xs uppercase tracking-wider text-[#6b828c] font-medium ${i === 7 ? 'w-10' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(flow => {
                  const t = flow.trigger ? TRIGGER_BY_ID[flow.trigger] : null;
                  const bad = blockedCount(flow);
                  return (
                    <tr
                      key={flow.id}
                      onClick={() => setEditing(flow)}
                      className="border-b border-gray-100 last:border-0 hover:bg-[#f8fdfe] transition-colors cursor-pointer align-top"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#092E3F]">{flow.name}</span>
                          {flow.isPrebuilt && (
                            <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase tracking-wide bg-[#e5f2f4] text-[#1e7d8f]">Seculyze</span>
                          )}
                          {bad > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7e6e4] text-[#c2453d]">
                              <AlertTriangle className="w-2.5 h-2.5" />{bad} blocked
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {flow.actions.slice(0, 4).map(a => {
                            const d = ACTION_BY_ID[a.action];
                            const gated = flow.trigger ? permissionFor(flow.trigger, a.action) === 'gated' : false;
                            return (
                              <span key={a.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium ${
                                d.cls === 'containment' ? 'bg-[#f7e6e4] text-[#c2453d]'
                                : d.cls === 'playbook' ? 'bg-[#f7efdf] text-[#c07d1e]'
                                : d.cls === 'notification' ? 'bg-[#e3f0e8] text-[#2f7d52]'
                                : d.cls === 'reporting' ? 'bg-[#e5f2f4] text-[#1e7d8f]'
                                : 'bg-[#eef1f3] text-[#5c707a]'
                              }`}>
                                {gated && <ShieldCheck className="w-2.5 h-2.5" />}{d.name}
                              </span>
                            );
                          })}
                          {flow.actions.length > 4 && (
                            <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a]">+{flow.actions.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {t ? (
                          <>
                            <p className="text-xs text-[#092E3F]">{t.name}</p>
                            <p className="text-[10px] text-[#87999f] mt-0.5">{t.reach}</p>
                          </>
                        ) : <span className="text-xs text-[#c07d1e]">Not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        {flow.conditions.length === 0
                          ? <span className="text-xs text-[#87999f]">Any</span>
                          : (
                            <>
                              <p className="text-xs text-[#092E3F]">{CONDITION_BY_ID[flow.conditions[0].id].name}</p>
                              <p className="text-[10px] text-[#87999f] mt-0.5 truncate max-w-[160px]">
                                {flow.conditions[0].value}
                                {flow.conditions.length > 1 ? ` +${flow.conditions.length - 1}` : ''}
                              </p>
                            </>
                          )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#092E3F]">
                          {flow.clientScope[0] === 'all' ? 'All tenants' : `${flow.clientScope.length} tenants`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-[4px] text-[11px] font-medium ${CATEGORY_CLASS[flow.category]}`}>{flow.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${flow.isActive ? 'text-[#2f7d52]' : 'text-[#87999f]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${flow.isActive ? 'bg-[#2f7d52]' : 'bg-[#b7c4c9]'}`} />
                          {flow.isActive ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#6b828c]">{flow.lastRun ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative flex items-center gap-1">
                          <button
                            onClick={() => toggleFlow(flow.id)}
                            title={flow.isActive ? 'Disable' : 'Enable'}
                            className="p-1.5 rounded-[4px] text-[#6b828c] hover:bg-[#f0f3f4] hover:text-[#092E3F] transition-colors"
                          >
                            {flow.isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setOpenMenu(openMenu === flow.id ? null : flow.id)}
                            className="p-1.5 rounded-[4px] text-[#6b828c] hover:bg-[#f0f3f4] hover:text-[#092E3F] transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenu === flow.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-[4px] shadow-xl border border-gray-100 py-1 z-50">
                                <button onClick={() => { setEditing(flow); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
                                  <ChevronRight className="w-3.5 h-3.5" /> Open builder
                                </button>
                                <button onClick={() => cloneFlow(flow)} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
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
      </div>

      {picking && (
        <NewFlowPicker
          onClose={() => setPicking(false)}
          onBlank={() => { setPicking(false); setEditing(emptyFlow()); }}
          onTemplate={(t) => { setPicking(false); setEditing(makeCopy(t, t.name)); }}
        />
      )}
    </div>
  );
}

// ─── new-flow picker ──────────────────────────────────────────────────────────
// Blank first — templates are a shortcut, not the expected path.

function NewFlowPicker({ onClose, onBlank, onTemplate }: {
  onClose: () => void; onBlank: () => void; onTemplate: (t: SoarFlow) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-start justify-between">
          <div>
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">New flow</p>
            <h2 className="text-white text-base font-semibold">Start from scratch, or from a template</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <button
            onClick={onBlank}
            className="w-full text-left p-4 rounded-[4px] border-2 border-dashed border-[#c9d6dc] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors mb-5 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-[4px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#092E3F]">Start from scratch</p>
              <p className="text-[11px] text-[#87999f] mt-0.5">Empty canvas — add a trigger, then conditions and actions.</p>
            </div>
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-[#e5e9eb]" />
            <span className="flex items-center gap-1.5 text-[10px] text-[#87999f] uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Seculyze templates
            </span>
            <div className="h-px flex-1 bg-[#e5e9eb]" />
          </div>

          <div className="space-y-2">
            {MOCK_FLOWS.map(t => {
              const trig = t.trigger ? TRIGGER_BY_ID[t.trigger] : null;
              return (
                <button
                  key={t.id}
                  onClick={() => onTemplate(t)}
                  className="w-full text-left p-3 rounded-[4px] border border-[#e5e9eb] hover:border-[#2A96A8] hover:bg-[#f8fdfe] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-sm font-medium text-[#092E3F]">{t.name}</span>
                    <span className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium shrink-0 ${CATEGORY_CLASS[t.category]}`}>{t.category}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {trig && (
                      <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#092E3F] text-white">{trig.block}</span>
                    )}
                    {t.actions.map(a => {
                      const d = ACTION_BY_ID[a.action];
                      return (
                        <span key={a.key} className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium ${
                          d.cls === 'containment' ? 'bg-[#f7e6e4] text-[#c2453d]'
                          : d.cls === 'playbook' ? 'bg-[#f7efdf] text-[#c07d1e]'
                          : d.cls === 'notification' ? 'bg-[#e3f0e8] text-[#2f7d52]'
                          : d.cls === 'reporting' ? 'bg-[#e5f2f4] text-[#1e7d8f]'
                          : 'bg-[#eef1f3] text-[#5c707a]'}`}>
                          {d.name}
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, tint, label, value, hint }: {
  icon: any; tint: string; label: string; value: React.ReactNode; hint?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-[4px] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${tint}`} />
        <span className="text-xs text-[#6b828c] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#092E3F]">{value}</p>
      {hint && <p className="text-[10px] text-[#87999f] mt-1">{hint}</p>}
    </div>
  );
}
