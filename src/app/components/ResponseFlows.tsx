import { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Workflow, Plus, Copy, MoreHorizontal, Search, Play, Pause,
  Zap, Clock, CalendarClock, X, FileText, Mail, Building2, ChevronRight,
} from 'lucide-react';
import {
  SoarFlow, ScheduledReport, MOCK_FLOWS, MOCK_SCHEDULED_REPORTS,
  EXECUTION_MODE_META, ACTION_LABELS, TIER_COLORS, makeNodeId,
} from './soarData';
import FlowBuilder from './FlowBuilder';

function emptyFlow(): SoarFlow {
  return {
    id: `flow-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Untitled flow',
    isPrebuilt: false,
    alertTypes: [],
    providerNames: [],
    clientScope: ['all'],
    confidenceThreshold: 80,
    minRisk: 'Medium',
    executionMode: 'recommend',
    isActive: false,
    author: 'Custom',
    priority: 99,
    nodes: [
      { id: makeNodeId(), kind: 'trigger', alertTypes: [], providerNames: [] },
      { id: makeNodeId(), kind: 'triage', minConfidence: 80, minRisk: 'Medium' },
      { id: makeNodeId(), kind: 'respond' },
    ],
  };
}

// count the action blocks for the library "actions" chips
function actionChips(flow: SoarFlow) {
  return flow.nodes
    .filter((n): n is Extract<SoarFlow['nodes'][number], { kind: 'action' }> => n.kind === 'action')
    .map(n => ({ label: ACTION_LABELS[n.action], tier: n.tier }));
}

export default function ResponseFlows() {
  const [flows, setFlows] = useState<SoarFlow[]>(MOCK_FLOWS);
  const [reports, setReports] = useState<ScheduledReport[]>(MOCK_SCHEDULED_REPORTS);
  const [editing, setEditing] = useState<SoarFlow | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'flows' | 'reports'>('flows');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<ScheduledReport | null>(null);

  const filtered = useMemo(() => flows.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.alertTypes.some(a => a.toLowerCase().includes(search.toLowerCase())) ||
    f.providerNames.some(p => p.toLowerCase().includes(search.toLowerCase()))
  ), [flows, search]);

  const activeCount = flows.filter(f => f.isActive).length;
  const autoCount = flows.filter(f => f.isActive && f.executionMode === 'auto').length;

  const saveFlow = (flow: SoarFlow) => {
    setFlows(prev => prev.some(f => f.id === flow.id)
      ? prev.map(f => f.id === flow.id ? flow : f)
      : [...prev, flow]);
    setEditing(null);
  };

  const cloneFlow = (flow: SoarFlow) => {
    const copy: SoarFlow = {
      ...JSON.parse(JSON.stringify(flow)),
      id: `flow-${Math.random().toString(36).slice(2, 8)}`,
      name: `${flow.name} (copy)`,
      isPrebuilt: false, author: 'Custom', scenarioId: undefined, isActive: false,
      priority: flows.length + 1,
    };
    setFlows(prev => [...prev, copy]);
    setOpenMenu(null);
    toast.success(`Cloned: ${flow.name}`);
  };

  const toggleFlow = (id: string) => {
    setFlows(prev => prev.map(f => {
      if (f.id !== id) return f;
      toast.success(`${f.isActive ? 'Disabled' : 'Enabled'}: ${f.name}`);
      return { ...f, isActive: !f.isActive };
    }));
  };

  const toggleReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  // ── builder takes over the full page ──
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
              <p className="text-sm text-[#092E3F]/60">Drag-and-drop automated response — triage, act, notify. Gated by confidence &amp; risk.</p>
            </div>
          </div>
          {tab === 'flows' && (
            <button
              onClick={() => setEditing(emptyFlow())}
              className="flex items-center gap-2 px-4 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New flow
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Workflow className="w-4 h-4 text-[#2A96A8]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Active flows</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">{activeCount}<span className="text-sm text-[#6b828c] font-normal"> / {flows.length}</span></p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#2f7d52]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Fully automated</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">{autoCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#c07d1e]" />
              <span className="text-xs text-[#6b828c] uppercase tracking-wide">Analyst time saved / mo</span>
            </div>
            <p className="text-2xl font-bold text-[#092E3F]">~86h</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-[#e5e9eb]">
          {([['flows', 'Flows', flows.length], ['reports', 'Scheduled reports', reports.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-[#2A96A8] text-[#092E3F]' : 'border-transparent text-[#6b828c] hover:text-[#092E3F]'
              }`}
            >
              {label} <span className="text-[#87999f]">({count})</span>
            </button>
          ))}
        </div>

        {tab === 'flows' ? (
          <>
            {/* Search */}
            <div className="relative mb-4 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search flows, alert types, providers…"
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
              />
            </div>

            {/* Flow table */}
            <div className="bg-white border border-gray-200 rounded-[6px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e9eb]">
                      {['Flow', 'Scope', 'Tenants', 'Execution', 'Status', 'Last run', ''].map((h, i) => (
                        <th key={i} className={`px-4 py-3 text-left text-xs uppercase tracking-wider text-[#6b828c] font-medium ${i === 6 ? 'w-10' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(flow => {
                      const chips = actionChips(flow);
                      return (
                        <tr
                          key={flow.id}
                          onClick={() => setEditing(flow)}
                          className="border-b border-gray-100 last:border-0 hover:bg-[#f8fdfe] transition-colors cursor-pointer align-top"
                        >
                          {/* Flow name + actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#092E3F]">{flow.name}</span>
                              {flow.isPrebuilt && (
                                <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase tracking-wide bg-[#e5f2f4] text-[#1e7d8f]">Seculyze</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {chips.slice(0, 4).map((c, i) => (
                                <span key={i} className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium ${TIER_COLORS[c.tier].bg} ${TIER_COLORS[c.tier].text}`}>
                                  {c.label}
                                </span>
                              ))}
                              {chips.length > 4 && <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a]">+{chips.length - 4}</span>}
                            </div>
                          </td>
                          {/* Scope */}
                          <td className="px-4 py-3">
                            <p className="text-xs text-[#092E3F]">{flow.alertTypes[0] ?? '—'}{flow.alertTypes.length > 1 ? ` +${flow.alertTypes.length - 1}` : ''}</p>
                            <p className="text-[10px] text-[#87999f] mt-0.5">{flow.providerNames.join(', ') || 'No provider'}</p>
                          </td>
                          {/* Tenants */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#092E3F]">
                              {flow.clientScope[0] === 'all' ? 'All tenants' : `${flow.clientScope.length} tenant${flow.clientScope.length !== 1 ? 's' : ''}`}
                            </span>
                          </td>
                          {/* Execution mode */}
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-1 rounded-[4px] text-[11px] font-medium ${EXECUTION_MODE_META[flow.executionMode].pillClass}`}>
                              {EXECUTION_MODE_META[flow.executionMode].label}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs ${flow.isActive ? 'text-[#2f7d52]' : 'text-[#87999f]'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${flow.isActive ? 'bg-[#2f7d52]' : 'bg-[#b7c4c9]'}`} />
                              {flow.isActive ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          {/* Last run */}
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#6b828c]">{flow.lastRun ?? '—'}</span>
                          </td>
                          {/* Row menu */}
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
                  <p className="text-sm text-gray-500">No flows match your search</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <ScheduledReportsTab
            reports={reports}
            onToggle={toggleReport}
            onEdit={setReportModal}
            onNew={() => setReportModal({
              id: `rep-${Math.random().toString(36).slice(2, 8)}`,
              name: 'New scheduled report', cadence: 'monthly', clientScope: ['all'],
              channels: [{ id: makeNodeId(), type: 'email', value: 'stakeholders@seculyze.com' }],
              format: 'pdf', sections: ['actions', 'time_saved', 'top_scenarios'], isActive: false, nextRun: '—',
            })}
          />
        )}
      </div>

      {reportModal && (
        <ReportModal
          report={reportModal}
          onClose={() => setReportModal(null)}
          onSave={(r) => {
            setReports(prev => prev.some(x => x.id === r.id) ? prev.map(x => x.id === r.id ? r : x) : [...prev, r]);
            setReportModal(null);
            toast.success(`Report saved: ${r.name}`);
          }}
        />
      )}
    </div>
  );
}

// ─── scheduled reports tab ────────────────────────────────────────────────────

function ScheduledReportsTab({ reports, onToggle, onEdit, onNew }: {
  reports: ScheduledReport[];
  onToggle: (id: string) => void;
  onEdit: (r: ScheduledReport) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div className="bg-[#e5f2f4] rounded-[4px] p-3 max-w-2xl">
          <p className="text-xs text-[#092E3F]/70">
            Scheduled reports are time-triggered (not incident-triggered). A recurring job compiles a per-tenant automation report — alerts automated, actions executed, analyst hours saved, top scenarios — and delivers it via the notification channels.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" />
          New report
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => (
          <div
            key={r.id}
            onClick={() => onEdit(r)}
            className="bg-white border border-gray-200 rounded-[6px] p-4 cursor-pointer hover:border-[#2A96A8]/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[4px] bg-[#e5f2f4] flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4 text-[#2A96A8]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#092E3F]">{r.name}</p>
                  <p className="text-[11px] text-[#6b828c] capitalize">{r.cadence} · next {r.nextRun}</p>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onToggle(r.id); }}
                className={`relative inline-block w-10 h-5 rounded-full transition-colors shrink-0 ${r.isActive ? 'bg-[#4caf50]' : 'bg-[#e5e9eb]'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${r.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {r.sections.map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#f6f6f6] text-[#5c707a]">
                  {s.replace('_', ' ')}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#87999f] pt-2 border-t border-[#f0f3f4]">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{r.clientScope[0] === 'all' ? 'All tenants' : `${r.clientScope.length} tenants`}</span>
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{r.format.replace('_', ' ')}</span>
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.channels.length} channel{r.channels.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── report config modal ──────────────────────────────────────────────────────

function ReportModal({ report, onClose, onSave }: {
  report: ScheduledReport;
  onClose: () => void;
  onSave: (r: ScheduledReport) => void;
}) {
  const [draft, setDraft] = useState<ScheduledReport>(() => JSON.parse(JSON.stringify(report)));
  const patch = (p: Partial<ScheduledReport>) => setDraft(prev => ({ ...prev, ...p }));
  const toggleSection = (s: ScheduledReport['sections'][number]) =>
    patch({ sections: draft.sections.includes(s) ? draft.sections.filter(x => x !== s) : [...draft.sections, s] });

  const SECTIONS: [ScheduledReport['sections'][number], string][] = [
    ['actions', 'Actions executed by type'],
    ['time_saved', 'Analyst hours saved'],
    ['top_scenarios', 'Top scenarios fired'],
    ['approvals', 'Approval turnaround'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-start justify-between">
          <div>
            <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Scheduled report</p>
            <input
              value={draft.name}
              onChange={e => patch({ name: e.target.value })}
              className="text-white text-base font-semibold bg-transparent border-b border-white/20 focus:border-[#2A96A8] focus:outline-none"
            />
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          <div>
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Cadence</p>
            <div className="flex gap-2">
              {(['weekly', 'monthly', 'quarterly'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => patch({ cadence: c })}
                  className={`flex-1 py-2 rounded-[4px] text-xs font-medium border capitalize transition-colors ${
                    draft.cadence === c ? 'bg-[#092E3F] text-white border-[#092E3F]' : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Report sections</p>
            <div className="space-y-1">
              {SECTIONS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#f6f6f6] rounded-[4px] cursor-pointer">
                  <div
                    onClick={e => { e.preventDefault(); toggleSection(key); }}
                    className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center shrink-0 ${draft.sections.includes(key) ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-[#c4d2d6] bg-white'}`}
                  >
                    {draft.sections.includes(key) && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-xs text-[#092E3F]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Format</p>
            <div className="flex gap-2">
              {([['pdf', 'PDF attachment'], ['email_html', 'Inline email'], ['dashboard_link', 'Dashboard link']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => patch({ format: val })}
                  className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                    draft.format === val ? 'bg-[#e5f2f4] text-[#092E3F] border-[#2A96A8]/50' : 'bg-white text-[#6b828c] border-[#e5e9eb] hover:border-[#c9d6dc]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#f6f6f6] rounded-[4px] p-3">
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-1">Delivery</p>
            <p className="text-xs text-[#092E3F]/70">
              {draft.clientScope[0] === 'all' ? 'All tenants' : `${draft.clientScope.length} tenants`} · {draft.channels.map(c => c.itsmType ?? c.type).join(', ')}
            </p>
            <p className="text-[10px] text-[#87999f] mt-1">Channels reuse the Notifications module configuration.</p>
          </div>
        </div>

        <div className="border-t border-[#e5f2f4] px-6 py-4 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors">Cancel</button>
          <button onClick={() => onSave(draft)} className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors">
            Save report
          </button>
        </div>
      </div>
    </div>
  );
}
