import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  ScrollText, Search, Download, ChevronRight, CheckCircle2, XCircle,
  MinusCircle, Clock, Ban, ShieldCheck, AlertTriangle, User, Monitor,
  Globe, Mail, FileWarning, Network, Building2,
} from 'lucide-react';
import {
  RUNS, OUTCOMES, OUTCOME_LABEL, STEP_LABEL, ENTITY_LABEL, TENANTS,
  stepName, changedCustomerSystems, fmtDuration, fmtWhen, fmtClock, triggerName, toCsv,
  type FlowRun, type RunOutcome, type RunStep, type StepStatus, type Entity, type EntityKind,
} from './flowRuns';
import { ACTION_BY_ID } from './flowRegister';
import {
  TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_BODY, TABLE_ROW, TABLE_TD,
} from './tableStyles';
import Pagination from './Pagination';

// ─── Automation audit ────────────────────────────────────────────────────────
//
// Two jobs in one screen, which is why it is built the way it is.
//
// Proving. The table's unit is the run, but the unit of evidence is the step:
// a run that says "isolated a device" without naming the device proves nothing.
// So every step keeps its own target, its own clock time and its own result,
// the authority that let it happen sits on the run, and the CSV export writes
// one row per step rather than one per run.
//
// Troubleshooting. A failed step keeps the error the downstream system gave,
// and the steps after it say they were skipped rather than silently vanishing
// — "the flow failed" is not something anyone can act on.

const ENTITY_ICON: Record<EntityKind, any> = {
  user: User, device: Monitor, ip: Network, mailbox: Mail,
  file: FileWarning, domain: Globe, tenant: Building2,
};

const OUTCOME_CHIP: Record<RunOutcome, string> = {
  succeeded: 'bg-[#e3f0e8] text-[#2f7d52]',
  partial: 'bg-[#f7efdf] text-[#c07d1e]',
  failed: 'bg-[#f7e6e4] text-[#c2453d]',
  'awaiting-approval': 'bg-[#eef1f3] text-[#5c707a]',
  cancelled: 'bg-[#eef1f3] text-[#5c707a]',
};

const STEP_ICON: Record<StepStatus, { icon: any; tint: string }> = {
  succeeded: { icon: CheckCircle2, tint: 'text-[#2f7d52]' },
  failed: { icon: XCircle, tint: 'text-[#c2453d]' },
  skipped: { icon: MinusCircle, tint: 'text-[#b7c4c9]' },
  'awaiting-approval': { icon: Clock, tint: 'text-[#c07d1e]' },
  cancelled: { icon: Ban, tint: 'text-[#87999f]' },
};

function EntityChip({ e }: { e: Entity }) {
  const Icon = ENTITY_ICON[e.kind];
  return (
    <span
      title={ENTITY_LABEL[e.kind]}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a] max-w-[180px]"
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{e.value}</span>
    </span>
  );
}

export default function AutomationAudit() {
  const [search, setSearch] = useState('');
  const [tenant, setTenant] = useState<string>('all');
  const [outcome, setOutcome] = useState<RunOutcome | 'all'>('all');
  const [onlyChanging, setOnlyChanging] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => RUNS.filter(r => {
    if (tenant !== 'all' && r.tenant !== tenant) return false;
    if (outcome !== 'all' && r.outcome !== outcome) return false;
    if (onlyChanging && changedCustomerSystems(r).length === 0) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.id.toLowerCase().includes(q)
      || r.flowName.toLowerCase().includes(q)
      || r.sourceRef.toLowerCase().includes(q)
      || r.tenant.toLowerCase().includes(q)
      // the entity search is the one people actually use: "what did we do to
      // this user", typed straight from a customer's email
      || r.entities.some(e => e.value.toLowerCase().includes(q))
      || r.steps.some(s => s.target?.value.toLowerCase().includes(q) || stepName(s).toLowerCase().includes(q));
  }), [search, tenant, outcome, onlyChanging]);

  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);

  const total = RUNS.length;
  const failing = RUNS.filter(r => r.outcome === 'failed' || r.outcome === 'partial').length;
  const waiting = RUNS.filter(r => r.outcome === 'awaiting-approval').length;
  const touched = RUNS.reduce((n, r) => n + changedCustomerSystems(r).length, 0);

  const reset = (fn: () => void) => { fn(); setPage(1); setOpen(null); };

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `seculyze-automation-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} runs, one row per step`);
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#092E3F] text-xl font-semibold">Automation Audit</h1>
              <p className="text-sm text-[#092E3F]/60">
                Every run, every step, and what it was done to — for the last 30 days.
              </p>
            </div>
          </div>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-[#092e3f] text-white rounded-[8px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors"
          >
            <Download className="w-4 h-4" /> Export evidence
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 min-[900px]:grid-cols-4 gap-4 mb-6">
          <Stat icon={ScrollText} tint="text-[#2A96A8]" label="Runs (30d)" value={total} />
          <Stat
            icon={ShieldCheck} tint="text-[#c07d1e]" label="Changes to customer systems" value={touched}
            hint="Successful steps that reached into a customer environment"
          />
          <Stat
            icon={AlertTriangle} tint={failing > 0 ? 'text-[#c07d1e]' : 'text-[#2f7d52]'}
            label="Failed or partly done" value={failing}
            hint={failing > 0 ? 'These are the ones to troubleshoot' : 'Every run completed'}
          />
          <Stat icon={Clock} tint="text-[#6b828c]" label="Awaiting approval" value={waiting}
            hint="Held, pending a human" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
            <input
              value={search}
              onChange={e => reset(() => setSearch(e.target.value))}
              placeholder="Search a user, device, IP, run or flow…"
              className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>

          <select
            value={tenant}
            onChange={e => reset(() => setTenant(e.target.value))}
            className="h-[38px] px-2.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] cursor-pointer appearance-none focus:outline-none focus:border-[#2A96A8]"
          >
            <option value="all">All tenants</option>
            {TENANTS.map(t => <option key={t}>{t}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[8px] p-1">
            {(['all', ...OUTCOMES] as const).map(o => (
              <button
                key={o}
                onClick={() => reset(() => setOutcome(o as RunOutcome | 'all'))}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors ${
                  outcome === o ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'
                }`}
              >
                {o === 'all' ? 'All' : OUTCOME_LABEL[o as RunOutcome]}
              </button>
            ))}
          </div>

          {/* The filter a customer question starts with. */}
          <button
            onClick={() => reset(() => setOnlyChanging(v => !v))}
            className={`flex items-center gap-1.5 h-[38px] px-3 rounded-[8px] border text-xs font-medium transition-colors ${
              onlyChanging
                ? 'bg-[#f7efdf] border-[#f0dfbe] text-[#c07d1e]'
                : 'bg-white border-[var(--stroke)] text-[#6b828c] hover:border-[#2A96A8] hover:text-[#092E3F]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Touched customer systems
          </button>
        </div>

        {/* Runs */}
        <div className={TABLE_SHELL}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  {['', 'Run', 'When', 'Flow', 'Started by', 'Acted on', 'Outcome', 'Took'].map((h, i) => (
                    <th key={i} className={`${TABLE_TH} ${i === 0 ? 'w-8' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {shown.map(run => {
                  const isOpen = open === run.id;
                  const changed = changedCustomerSystems(run);
                  return (
                    <Fragment key={run.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : run.id)}
                        className={`${TABLE_ROW} cursor-pointer align-top`}
                      >
                        <td className="px-4 py-3">
                          <ChevronRight
                            className={`w-4 h-4 text-[#87999f] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </td>
                        <td className={TABLE_TD}>
                          <p className="font-medium text-[#092E3F]">{run.id}</p>
                          <p className="text-[11px] text-[#87999f] mt-0.5">{run.tenant}</p>
                        </td>
                        <td className={TABLE_TD}>
                          <p>{fmtWhen(run.startedAt)}</p>
                          <p className="text-[11px] text-[#87999f] mt-0.5">{run.sourceRef}</p>
                        </td>
                        <td className={TABLE_TD}>
                          <p className="max-w-[220px]">{run.flowName}</p>
                          {changed.length > 0 && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
                              changed customer systems
                            </span>
                          )}
                        </td>
                        <td className={TABLE_TD}>
                          <p>{triggerName(run.trigger)}</p>
                          <p className="text-[11px] text-[#87999f] mt-0.5">
                            {run.approvedBy ? `Approved by ${run.approvedBy}` : 'No approval required'}
                          </p>
                        </td>
                        <td className={TABLE_TD}>
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {run.entities.map((e, i) => <EntityChip key={i} e={e} />)}
                          </div>
                        </td>
                        <td className={TABLE_TD}>
                          <span className={`inline-block px-2 py-1 rounded-[8px] text-[11px] font-medium ${OUTCOME_CHIP[run.outcome]}`}>
                            {OUTCOME_LABEL[run.outcome]}
                          </span>
                        </td>
                        <td className={TABLE_TD}>
                          <span className="text-[#6b828c]">{fmtDuration(run.durationMs)}</span>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${run.id}-detail`}>
                          <td colSpan={8} className="px-4 pb-4 pt-0 bg-[#fafbfb]">
                            <RunDetail run={run} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No runs match</p>
            </div>
          ) : (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={p => { setPage(p); setOpen(null); }}
              onPageSizeChange={s => { setPageSize(s); setPage(1); setOpen(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── the step timeline ───────────────────────────────────────────────────────
// Where both jobs are actually done: each step's own clock time, its own
// target, and the error verbatim when it failed.

function RunDetail({ run }: { run: FlowRun }) {
  return (
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-1">What happened</p>
          <p className="text-sm text-[#092E3F]">
            {triggerName(run.trigger)} on {run.sourceRef === '—' ? run.tenant : run.sourceRef} ran{' '}
            <strong>{run.flowName}</strong> against {run.entities.map(e => e.value).join(', ')}.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-[#87999f]">Started {new Date(run.startedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC</p>
          {run.approvedAt && (
            <p className="text-[11px] text-[#87999f]">
              Approved by {run.approvedBy} at {fmtClock(run.approvedAt)}
            </p>
          )}
        </div>
      </div>

      <ol className="relative">
        {run.steps.map((s, i) => {
          const { icon: Icon, tint } = STEP_ICON[s.status];
          const d = ACTION_BY_ID[s.action];
          const last = i === run.steps.length - 1;
          return (
            <li key={s.id} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <Icon className={`w-4 h-4 ${tint}`} />
                {!last && <span className="w-px flex-1 bg-[var(--stroke)] my-1" />}
              </div>

              <div className={`flex-1 min-w-0 ${last ? '' : 'pb-4'}`}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm text-[#092E3F]">{stepName(s)}</span>
                  <span className={`px-1.5 py-0.5 rounded-[8px] text-[9px] font-semibold uppercase tracking-wide ${
                    s.status === 'succeeded' ? 'bg-[#e3f0e8] text-[#2f7d52]'
                    : s.status === 'failed' ? 'bg-[#f7e6e4] text-[#c2453d]'
                    : 'bg-[#eef1f3] text-[#5c707a]'
                  }`}>
                    {STEP_LABEL[s.status]}
                  </span>
                  {s.target && <EntityChip e={s.target} />}
                  <span className="ml-auto text-[11px] text-[#87999f] shrink-0">
                    {fmtClock(run.startedAt, s.at)}
                    {s.durationMs > 0 && ` · ${fmtDuration(s.durationMs)}`}
                  </span>
                </div>

                <p className={`text-[11px] mt-0.5 ${s.status === 'failed' ? 'text-[#c2453d]' : 'text-[#87999f]'}`}>
                  {s.detail}
                </p>
                <p className="text-[11px] text-[#b7c4c9] mt-0.5">{d.system}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-[#87999f] mt-3 pt-3 border-t border-gray-100">
        {run.id} · {run.tenant} · {run.steps.length} step{run.steps.length === 1 ? '' : 's'} ·{' '}
        {changedCustomerSystems(run).length} reached the customer environment
      </p>
    </div>
  );
}

function Stat({ icon: Icon, tint, label, value, hint }: {
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
