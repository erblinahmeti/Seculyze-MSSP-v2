import { useRef, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  HelpCircle,
  Info,
  ShieldAlert,
  ShieldCheck,
  User,
  Loader2,
  Check,
  Ticket,
  FileCheck,
  ExternalLink,
  RotateCcw,
  ArrowRight,
  Target,
  Copy,
  Globe,
  Mail,
  Monitor,
  Terminal,
  FileText,
  MessageSquare,
  Layers,
  Send,
  Calendar,
  Bell,
  Undo2,
} from 'lucide-react';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import EvidenceText, { RichText } from './EvidenceText';
import InvestigationEvidence, { type QueryFocus } from './InvestigationEvidence';
import imgSentinelPng from 'figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png';
import type { Analysis, DecisionAction, Finding, IncidentAlert, Lean, Metric, RedesignIncident, Verdict } from './triageRedesignData';

// ─── Incident panel, decision-first (AI Triage B) ────────────────────────────
//
// An incident groups alerts; the AI analyses each alert on its own. The panel
// reads top-down in the order an analyst works:
//
//   header              what incident, how severe, who is affected
//   incident overview   metadata, and every alert with its own verdict —
//                       pick one to triage
//   AI triage (alert)   what do I need to know   verdict, headline, 3 numbers
//                       what do I need to do     one card per action
//                       the rest                 what happened, how, findings,
//                                                evidence, changelog
//   below               entities, MITRE, comments, similar — as on Incidents (A)
//
// Severity, verdict and confidence stay separate and labelled: severity comes
// from the alert rule, the verdict and its confidence from the AI.

const VERDICT: Record<Verdict, { label: string; short: string; icon: typeof ShieldAlert; cls: string; edge: string }> = {
  TruePositive: { label: 'True positive', short: 'True positive', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-200', edge: 'border-l-red-400' },
  FalsePositive: { label: 'False positive', short: 'False positive', icon: ShieldCheck, cls: 'bg-green-50 text-green-700 border-green-200', edge: 'border-l-green-500' },
  Undetermined: { label: 'Undetermined', short: 'Undetermined', icon: HelpCircle, cls: 'bg-gray-100 text-[#092E3F] border-gray-200', edge: 'border-l-gray-300' },
};

const SEVERITY = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-700',
} as const;

const METRIC_TONE: Record<Metric['tone'], string> = {
  suspicious: 'text-red-700',
  benign: 'text-green-700',
  neutral: 'text-[#092E3F]',
};

const LEAN: Record<Lean, { label: string; icon: typeof AlertTriangle; icon_: string; text: string }> = {
  attack: { label: 'Points to attack', icon: AlertTriangle, icon_: 'text-red-600', text: 'text-red-700' },
  unclear: { label: 'Unclear', icon: HelpCircle, icon_: 'text-amber-600', text: 'text-amber-800' },
  away: { label: 'Points away from attack', icon: CheckCircle2, icon_: 'text-green-600', text: 'text-green-700' },
};

/** How long the simulated analysis takes. */
const ANALYSIS_MS = 2400;

type Phase = 'none' | 'running' | 'error' | 'done';
type Decision = 'open' | 'approved' | 'dismissed' | 'confirming';

// ─── Building blocks ─────────────────────────────────────────────────────────

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium uppercase tracking-wide text-[#6b828c] ${className}`}>{children}</p>;
}

function Btn({ primary, onClick, children, disabled }: { primary?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm transition-colors disabled:opacity-60 ${
        primary
          ? 'bg-[#092E3F] text-white hover:bg-[#2A96A8]'
          : 'bg-white border border-[var(--stroke)] text-[#092E3F] hover:bg-[#092E3F] hover:text-white hover:border-[#092E3F]'
      }`}
    >
      {children}
    </button>
  );
}

function ConfidenceMeter({ confidence, threshold }: { confidence: number; threshold: number }) {
  return (
    <div>
      <div className="relative h-1.5 rounded-[2px] bg-[#e8eef0]">
        <div className={`h-full rounded-[2px] ${confidence >= threshold ? 'bg-[#2A96A8]' : 'bg-amber-500'}`} style={{ width: `${confidence}%` }} />
        <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-[#092E3F]" style={{ left: `calc(${threshold}% - 1px)` }} />
      </div>
      <div className="relative h-3.5 mt-0.5 text-[10px] text-[#092E3F]/45 tabular-nums">
        <span className="absolute -translate-x-1/2" style={{ left: `${threshold}%` }}>
          {threshold}%
        </span>
      </div>
    </div>
  );
}

/** A collapsible row, as in "What happened" / "How did it happen". */
function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
        <span className="flex-1 text-sm font-medium text-[#092E3F]">{title}</span>
        <ChevronDown className={`w-4 h-4 text-[#092E3F]/45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ─── What do I need to know ──────────────────────────────────────────────────

function VerdictCard({ a }: { a: Analysis }) {
  const v = VERDICT[a.verdict];
  return (
    <section className={`rounded-[8px] border border-[var(--stroke)] border-l-[3px] ${v.edge} px-4 pt-3.5 pb-4 space-y-3`}>
      <div className="flex items-start gap-8">
        <div>
          <Eyebrow className="mb-1.5">AI verdict</Eyebrow>
          <span className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border text-sm ${v.cls}`}>
            <v.icon className="w-4 h-4" /> {v.label}
          </span>
        </div>
        <div className="w-72">
          <div className="flex items-center gap-1 mb-1.5">
            <Eyebrow>AI confidence</Eyebrow>
            {/* A button, not a bare icon, so the explanation is reachable by keyboard too. */}
            <span className="relative group flex">
              <button type="button" aria-label="About AI confidence" className="text-[#092E3F]/40 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
                <Info className="w-3.5 h-3.5" />
              </button>
              <span
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-60 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
              >
                AI-generated. Confidence is how sure the model is of this verdict, not how severe the incident is. The mark is the threshold for automated action.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 h-8">
            <span className="text-xl text-[#092E3F] tabular-nums leading-none w-12">{a.confidence}%</span>
            {/* Top padding matches the threshold label's height, so the bar itself is centred on the number. */}
            <div className="flex-1 pt-4">
              <ConfidenceMeter confidence={a.confidence} threshold={a.threshold} />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[15px] leading-snug font-medium text-[#092E3F]">
        <RichText text={a.headline} />
      </p>

      {a.gaps && (
        <div className="px-3 py-2 rounded-[4px] bg-amber-50 border border-amber-200">
          <p className="flex items-center gap-1.5 text-xs text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Incomplete evidence
          </p>
          <ul className="mt-1 ml-5 list-disc text-xs text-amber-900/85 space-y-0.5">
            {a.gaps.map(g => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 pt-0.5">
        {a.metrics.map(m => (
          <div key={m.label} className="min-w-0">
            <p className={`text-[22px] leading-tight font-semibold tabular-nums ${METRIC_TONE[m.tone]}`}>{m.value}</p>
            <p className="text-xs text-[#092E3F]/60 leading-snug">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── What do I need to do ────────────────────────────────────────────────────

const PRIMARY: Record<DecisionAction['kind'], { label: string; icon: typeof Check }> = {
  ticket: { label: 'Approve', icon: Check },
  notify: { label: 'Approve', icon: Check },
  close: { label: 'Approve', icon: Check },
  investigate: { label: 'Open in Sentinel', icon: ExternalLink },
};

const DONE: Record<DecisionAction['kind'], (act: DecisionAction) => string> = {
  ticket: () => 'Approved · ticket SEC-491 created',
  notify: act => `Approved · email sent to ${act.target?.value ?? 'recipient'}`,
  close: () => 'Approved · incident closed as false positive',
  investigate: () => 'Opened in Microsoft Sentinel',
};

function ActionCard({
  act,
  state,
  needsConfirm,
  onApprove,
  onConfirm,
  onCancel,
  onDismiss,
  onUndo,
}: {
  act: DecisionAction;
  state: Decision;
  needsConfirm: boolean;
  onApprove: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const [why, setWhy] = useState(false);
  const P = PRIMARY[act.kind];
  const settled = state === 'approved' || state === 'dismissed';
  return (
    <div
      className={`rounded-[8px] border transition-colors ${
        state === 'approved' ? 'border-[#2A96A8]/40 bg-[#f6fafb]' : state === 'dismissed' ? 'border-[var(--stroke)] bg-[#fafbfb]' : 'border-[var(--stroke)] bg-white'
      }`}
    >
      <div className="flex items-start gap-4 px-4 pt-3 pb-2">
        <div className={`flex-1 min-w-0 ${state === 'dismissed' ? 'opacity-60' : ''}`}>
          <p className="text-sm font-medium text-[#092E3F]">{act.title}</p>
          <p className="text-xs text-[#092E3F]/60">
            {act.channel} · {act.effect}
          </p>
          {act.target && (
            <p className="mt-1 text-xs text-[#092E3F]/60">
              {act.target.label && <span className="mr-1">{act.target.label}</span>}
              <EvidenceText text={act.target.value} emphasis={false} />
            </p>
          )}
        </div>
        {settled ? (
          <div className="shrink-0 flex items-center gap-3 pt-0.5">
            <span className={`inline-flex items-center gap-1.5 text-sm ${state === 'approved' ? 'text-[#1e7d8f]' : 'text-[#092E3F]/55'}`}>
              {state === 'approved' ? <Check className="w-4 h-4" /> : null}
              {state === 'approved' ? DONE[act.kind](act) : 'Dismissed'}
            </span>
            <button onClick={onUndo} className="inline-flex items-center gap-1 text-xs text-[#092E3F]/55 hover:text-[#092E3F]">
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-2">
            <Btn primary onClick={needsConfirm ? onApprove : onConfirm}>
              {P.label}
            </Btn>
            <Btn onClick={onDismiss}>Dismiss</Btn>
          </div>
        )}
      </div>

      {state === 'confirming' && (
        <div className="mx-4 mb-2 flex items-center gap-3 px-3 py-2.5 rounded-[4px] border border-[var(--stroke)] bg-[#fafbfb]">
          <p className="flex-1 text-xs text-[#092E3F]">
            Close as <span className="font-medium">{act.closeAs?.join(' / ')}</span>? You are confirming a verdict the automation would not close on its own.
          </p>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn primary onClick={onConfirm}>
            Confirm close
          </Btn>
        </div>
      )}

      <button onClick={() => setWhy(!why)} className="w-full flex items-center justify-between px-4 pb-2.5 pt-0.5 text-left">
        <span className="text-xs font-medium text-[#1e7d8f]">Why?</span>
        <ChevronDown className={`w-4 h-4 text-[#092E3F]/45 transition-transform ${why ? 'rotate-180' : ''}`} />
      </button>
      {why && (
        <div className="px-4 pb-3 -mt-1 space-y-1.5">
          <p className="text-sm text-[#092E3F]/85 leading-relaxed">
            <RichText text={act.why} />
          </p>
          {act.kind === 'notify' && act.target && (
            <p className="text-xs text-[#092E3F]/60">
              To: <EvidenceText text={act.target.value} emphasis={false} />
            </p>
          )}
          <p className="text-xs text-[#092E3F]/55">{act.does}</p>
        </div>
      )}
    </div>
  );
}

// ─── Findings ────────────────────────────────────────────────────────────────

/** "4 point to an attack, 3 are unclear and 3 point away." */
function findingSummary(findings: Finding[]) {
  const n = (l: Lean) => findings.filter(f => f.lean === l).length;
  const parts = [
    n('attack') && `${n('attack')} ${n('attack') === 1 ? 'points' : 'point'} to an attack`,
    n('unclear') && `${n('unclear')} ${n('unclear') === 1 ? 'is' : 'are'} unclear`,
    n('away') && `${n('away')} ${n('away') === 1 ? 'points' : 'point'} away`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `${list[0].toUpperCase()}${list.slice(1)}.`;
}

function FindingRow({ f, a, onGo }: { f: Finding; a: Analysis; onGo: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const L = LEAN[f.lean];
  const checks = (f.queryIds ?? []).map(id => a.queries.find(q => q.id === id)!).filter(Boolean);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
        <L.icon className={`w-4 h-4 mt-0.5 shrink-0 ${L.icon_}`} aria-label={L.label} />
        <span className="flex-1 min-w-0 text-sm text-[#092E3F]">
          <RichText text={f.title} />
        </span>
        <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-[#092E3F]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 pl-[42px] space-y-2.5">
          <div>
            <Eyebrow className="mb-0.5">What it means</Eyebrow>
            <p className="text-sm text-[#092E3F]/85 leading-relaxed">
              <RichText text={f.means} />
            </p>
          </div>
          {f.when && (
            <div>
              <Eyebrow className="mb-0.5">When</Eyebrow>
              <p className="text-sm text-[#092E3F] tabular-nums">{f.when}</p>
            </div>
          )}
          {checks.length > 0 && (
            <div>
              <Eyebrow className="mb-1">Check it yourself</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {checks.map(q => (
                  <button
                    key={q.id}
                    onClick={() => onGo(q.id)}
                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--stroke)] bg-white text-xs text-[#1e7d8f] hover:border-[#2A96A8] transition-colors"
                  >
                    {q.title}
                    <span className="text-[#092E3F]/45 tabular-nums">
                      · {q.status === 'completed' ? `${(q.rows ?? 0).toLocaleString()} ${q.rows === 1 ? 'row' : 'rows'}` : q.status}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#092E3F]/35 group-hover:text-[#2A96A8]" aria-hidden />
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[#092E3F]/45">Opens the query in Evidence below.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI analysis states ──────────────────────────────────────────────────────

function NotAnalysed({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-[8px] border border-[#2A96A8]/30 bg-[#e5f2f4]/50">
      <Sparkles className="w-4 h-4 text-[#1e7d8f] mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-[#092E3F]">This alert hasn’t been analysed yet</p>
        <p className="text-xs text-[#092E3F]/60 mt-0.5">Resolve reviews the sign-ins, threat intel and similar incidents, then recommends what to do. Typically 4–10 min.</p>
      </div>
      <Btn primary onClick={onRun}>
        Analyze
      </Btn>
    </div>
  );
}

function Analysing() {
  return (
    <div className="p-4 rounded-[8px] border border-[var(--stroke)]" aria-busy>
      <p className="flex items-center gap-2 text-sm text-[#092E3F]">
        <Loader2 className="w-4 h-4 animate-spin text-[#2A96A8]" /> Analysing — reviewing logs, threat intel and similar incidents
      </p>
      <div className="mt-4 space-y-2.5 animate-pulse">
        <div className="h-5 w-1/3 rounded-[4px] bg-[#eef2f3]" />
        <div className="h-4 w-4/5 rounded-[4px] bg-[#eef2f3]" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
        </div>
      </div>
    </div>
  );
}

function AnalysisFailed({ message, onRetry, onSentinel }: { message: string; onRetry: () => void; onSentinel: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-[8px] border border-red-200 bg-red-50/50">
      <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-[#092E3F]">AI analysis failed</p>
        <p className="text-xs text-[#092E3F]/65 mt-0.5">{message} No verdict was produced, so treat this alert as untriaged.</p>
        <div className="flex gap-2 mt-3">
          <Btn primary onClick={onRetry}>
            <RotateCcw className="w-3.5 h-3.5" /> Retry analysis
          </Btn>
          <Btn onClick={onSentinel}>
            <ExternalLink className="w-3.5 h-3.5" /> Investigate in Sentinel
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── One alert's triage ──────────────────────────────────────────────────────

function AlertTriage({
  alert,
  phase,
  onRun,
  onSentinel,
  onClosed,
}: {
  alert: IncidentAlert;
  phase: Phase;
  onRun: () => void;
  onSentinel: () => void;
  onClosed: (closed: boolean) => void;
}) {
  const a = alert.analysis;
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [changelog, setChangelog] = useState(a.changelog);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [focus, setFocus] = useState<QueryFocus | null>(null);

  if (phase === 'none') return <NotAnalysed onRun={onRun} />;
  if (phase === 'running') return <Analysing />;
  if (phase === 'error') return <AnalysisFailed message={alert.error ?? ''} onRetry={onRun} onSentinel={onSentinel} />;

  const decision = (id: string): Decision => decisions[id] ?? 'open';
  const set = (id: string, d: Decision) => setDecisions(s => ({ ...s, [id]: d }));
  const log = (line: string) => setChangelog(l => [...l, line]);
  const unlog = (line: string) => setChangelog(l => l.filter(x => x !== line));

  const approve = (act: DecisionAction) => {
    set(act.id, 'approved');
    const line = `Analyst approved: ${act.title}${act.target ? ` (${act.target.value})` : ''}`;
    log(line);
    if (act.kind === 'close') onClosed(true);
    if (act.kind === 'investigate') onSentinel();
    else toast.success(DONE[act.kind](act));
  };
  const dismiss = (act: DecisionAction) => {
    set(act.id, 'dismissed');
    log(`Analyst dismissed: ${act.title}`);
  };
  const undo = (act: DecisionAction) => {
    const was = decision(act.id);
    set(act.id, 'open');
    setChangelog(l => l.filter(x => !x.startsWith(was === 'approved' ? `Analyst approved: ${act.title}` : `Analyst dismissed: ${act.title}`)));
    if (act.kind === 'close' && was === 'approved') onClosed(false);
  };

  // Open Evidence and hand it the query to reveal.
  const goToQuery = (id: string) => {
    setEvidenceOpen(true);
    setFocus(prev => ({ id, n: (prev?.n ?? 0) + 1 }));
  };

  const groups = (['attack', 'unclear', 'away'] as Lean[]).map(l => ({ l, items: a.findings.filter(f => f.lean === l) })).filter(g => g.items.length);

  return (
    <div className="space-y-5">
      {/* What do I need to know */}
      <VerdictCard a={a} />

      {/* What do I need to do */}
      <section className="space-y-2">
        <Eyebrow>Your decision · {a.actions.length}</Eyebrow>
        {a.actions.length === 0 ? (
          <p className="px-4 py-3 rounded-[8px] border border-dashed border-[var(--stroke)] text-sm text-[#092E3F]/60">{a.noActionNote}</p>
        ) : (
          a.actions.map(act => (
            <ActionCard
              key={act.id}
              act={act}
              state={decision(act.id)}
              needsConfirm={act.kind === 'close' && a.confidence < a.threshold}
              onApprove={() => set(act.id, 'confirming')}
              onConfirm={() => approve(act)}
              onCancel={() => set(act.id, 'open')}
              onDismiss={() => dismiss(act)}
              onUndo={() => undo(act)}
            />
          ))
        )}
      </section>

      {/* The rest */}
      <section className="rounded-[8px] border border-[var(--stroke)] divide-y divide-[var(--stroke)]">
        {[
          ['What happened', a.happened],
          ['How did it happen', a.how],
        ].map(([title, lines]) => (
          <Disclosure key={title as string} title={title as string}>
            <ul className="space-y-1">
              {(lines as string[]).map(line => (
                <li key={line} className="text-sm text-[#092E3F]/85">
                  <RichText text={line} />
                </li>
              ))}
            </ul>
          </Disclosure>
        ))}
      </section>

      <section>
        <h3 className="text-base text-[#092E3F]">Key findings</h3>
        <p className="text-xs text-[#092E3F]/60 mb-2">{findingSummary(a.findings)} Open a finding to see what it means and check it yourself.</p>
        <div className="rounded-[8px] border border-[var(--stroke)] overflow-hidden">
          {groups.map(g => (
            <div key={g.l} className="border-b border-[var(--stroke)] last:border-b-0">
              <p className={`px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide ${LEAN[g.l].text}`}>
                {LEAN[g.l].label} · {g.items.length}
              </p>
              <div className="divide-y divide-gray-100">
                {g.items.map(f => (
                  <FindingRow key={f.id} f={f} a={a} onGo={goToQuery} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <InvestigationEvidence
        analysis={a}
        focus={focus}
        open={evidenceOpen}
        onOpenChange={v => {
          setEvidenceOpen(v);
          if (!v) setFocus(null);
        }}
      />

      <section className="rounded-[8px] border border-[var(--stroke)] overflow-hidden">
        {a.footerNote && <p className="px-4 py-2.5 text-xs text-[#092E3F]/55">{a.footerNote}</p>}
        <div className={`px-4 py-3 bg-[#fbfcfc] ${a.footerNote ? 'border-t border-[var(--stroke)]' : ''}`}>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#092E3F]/45 mb-1.5">Changelog</p>
          <ol className="space-y-1">
            {changelog.map((line, i) => (
              <li key={i} className="flex gap-2 text-[11px] text-[#092E3F]/70">
                <span className="text-[#092E3F]/30 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

// ─── Incident overview ───────────────────────────────────────────────────────

function AlertStatus({ alert, phase }: { alert: IncidentAlert; phase: Phase }) {
  if (phase === 'none') return <span className="text-xs text-[#092E3F]/50">Not analysed</span>;
  if (phase === 'running')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#1e7d8f]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing
      </span>
    );
  if (phase === 'error') return <span className="text-xs text-red-700">Analysis failed</span>;
  const v = VERDICT[alert.analysis.verdict];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`px-1.5 py-0.5 rounded-[4px] border text-[11px] ${v.cls}`}>{v.short}</span>
      <span className="text-xs text-[#092E3F]/60 tabular-nums w-8 text-right">{alert.analysis.confidence}%</span>
    </span>
  );
}

/** "3 alerts · 2 true positive · 1 not analysed" */
function rollup(alerts: IncidentAlert[], phases: Record<string, Phase>) {
  const counts = new Map<string, number>();
  for (const al of alerts) {
    const p = phases[al.id];
    const key = p === 'done' ? VERDICT[al.analysis.verdict].label.toLowerCase() : p === 'none' ? 'not analysed' : p === 'running' ? 'analysing' : 'analysis failed';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [`${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'}`, ...[...counts].map(([k, n]) => `${n} ${k}`)].join(' · ');
}

// ─── Secondary sections, as on Incidents (A) ─────────────────────────────────

type SectionKey = 'overview' | 'triage' | 'entities' | 'mitre' | 'comments' | 'similar';

function SectionHeader({
  icon: Icon,
  iconCls = 'text-[#092E3F]',
  title,
  badge,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconCls?: string;
  title: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconCls}`} />
        <h3 className="text-lg text-[#092E3F]">{title}</h3>
        {badge}
      </div>
      {open ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
    </button>
  );
}

const ENTITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Account: User,
  IP: Globe,
  Host: Monitor,
  Mailbox: Mail,
  Process: Terminal,
  FileHash: FileText,
};

const CLASS_BAR: Record<Verdict, string> = {
  TruePositive: 'bg-[#b73520]',
  FalsePositive: 'bg-[#66c1bf]',
  Undetermined: 'bg-[#d0d5dc]',
};

/** Mock past incidents for the Similar Incidents list, derived so each scenario gets its own. */
function similarRows(incident: RedesignIncident, verdict: Verdict) {
  const { total, sameVerdict } = incident.similar;
  const ages = ['3 days ago', '6 days ago', '11 days ago', '2 weeks ago', '3 weeks ago'];
  const offsets = [37, 112, 208, 341, 455];
  const shown = Math.min(total, 5);
  const others = Math.min(total - sameVerdict, shown);
  const m = incident.entities.length;
  return Array.from({ length: shown }, (_, i) => ({
    ref: String(Number(incident.number) - offsets[i]),
    severity: incident.severity,
    age: ages[i],
    shared: Math.max(1, m - (i % 2)),
    of: m,
    cls: (i >= shown - others ? 'Undetermined' : verdict) as Verdict,
  }));
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function IncidentTriageSidebarV2({ incident, onClose }: { incident: RedesignIncident; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [phases, setPhases] = useState<Record<string, Phase>>(() => Object.fromEntries(incident.alerts.map(al => [al.id, al.analysisState])));
  const [selected, setSelected] = useState(incident.alerts[0].id);
  const [closed, setClosed] = useState(false);
  const [showITSM, setShowITSM] = useState(false);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ overview: true, triage: true, entities: true, mitre: true, comments: true, similar: true });
  const toggle = (k: SectionKey) => setSections(s => ({ ...s, [k]: !s[k] }));
  const [copiedEntity, setCopiedEntity] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ id: number; user: string; role: string; timestamp: string; content: string }[]>([]);
  const triageRef = useRef<HTMLDivElement>(null);

  const alert = incident.alerts.find(al => al.id === selected)!;
  const multi = incident.alerts.length > 1;
  const [first, ...more] = incident.entities;
  // How past incidents were closed — history, so it doesn't wait on today's analysis.
  const primaryVerdict = incident.alerts[0].analysis.verdict;

  const runAnalysis = (id: string) => {
    setPhases(p => ({ ...p, [id]: 'running' }));
    setTimeout(() => setPhases(p => ({ ...p, [id]: 'done' })), ANALYSIS_MS);
  };

  // Alerts that still need the AI: never analysed, or the last run failed.
  const pending = incident.alerts.filter(al => phases[al.id] === 'none' || phases[al.id] === 'error');
  const running = incident.alerts.filter(al => phases[al.id] === 'running');
  // One click for every alert that still needs it. They finish at different
  // times, as real runs do, and each row updates as its own result lands.
  const analyzeAll = () => {
    const batch = pending.map(al => al.id);
    setPhases(p => ({ ...p, ...Object.fromEntries(batch.map(id => [id, 'running' as Phase])) }));
    batch.forEach((id, i) =>
      setTimeout(() => {
        setPhases(p => ({ ...p, [id]: 'done' }));
        if (i === batch.length - 1) toast.success(`${batch.length} ${batch.length === 1 ? 'alert' : 'alerts'} analysed`);
      }, ANALYSIS_MS + i * 1100),
    );
  };
  const pendingNote = () => {
    const none = pending.filter(al => phases[al.id] === 'none').length;
    const failed = pending.length - none;
    return [none && `${none} not analysed`, failed && `${failed} failed`].filter(Boolean).join(', ');
  };
  const openSentinel = () => toast('Opening incident in Microsoft Sentinel…');
  const pick = (id: string) => {
    setSelected(id);
    if (!sections.triage) toggle('triage');
    setTimeout(() => triageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };
  const copyEntity = (name: string) => {
    navigator.clipboard?.writeText(name).catch(() => {});
    setCopiedEntity(name);
    setTimeout(() => setCopiedEntity(null), 2000);
  };
  const addComment = () => {
    if (!newComment.trim()) return;
    setComments(c => [{ id: Date.now(), user: 'John Doe', role: 'Admin', timestamp: 'Just now', content: newComment.trim() }, ...c]);
    setNewComment('');
    toast.success('Comment added successfully');
  };

  const a = alert.analysis;
  const ticketDescription = [
    `Incident ${incident.number} — ${incident.title}`,
    `Alert ${alert.ref} — ${alert.title}`,
    phases[alert.id] === 'done' ? `AI verdict: ${VERDICT[a.verdict].label} (${a.confidence}% confidence)` : 'Not analysed by AI',
    ...(phases[alert.id] === 'done' ? ['', a.headline.replace(/\*\*/g, '')] : []),
  ].join('\n');

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200" onClick={onClose} />

      <div className={`fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col ${expanded ? 'max-w-[95vw]' : 'max-w-3xl'}`}>
        {/* ── Header: what, how severe, who — and the actions that apply to any incident ── */}
        <header className="bg-[#092E3F] px-6 pt-3.5 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-white/60 tabular-nums">
              #{incident.number} · {incident.type} · {incident.created} · {incident.client}
            </p>
            <div className="flex items-center gap-0.5 -mr-2">
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-[4px] hover:bg-white/10" title={expanded ? 'Collapse panel' : 'Expand panel'}>
                {expanded ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-[4px] hover:bg-white/10" title="Close panel">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          <h2 className="mt-1 text-lg leading-snug text-white line-clamp-2" title={incident.title}>
            {incident.title}
          </h2>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY[incident.severity]}`}>{incident.severity} severity</span>
            <span className={`px-2 py-0.5 rounded-[4px] text-xs ${closed ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>{closed ? 'Closed' : incident.status}</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs bg-white/10 text-white max-w-[260px]"
              title={incident.entities.map(e => `${e.type}: ${e.name}`).join('\n')}
            >
              <User className="w-3.5 h-3.5 shrink-0 text-white/70" />
              <span className="truncate">{first.name}</span>
              {more.length > 0 && <span className="text-white/60">+{more.length}</span>}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={openSentinel} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10">
                <img src={imgSentinelPng} alt="" className="h-3.5 w-auto" /> Sentinel
              </button>
              <button onClick={() => toast.success('Report generated')} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10">
                <FileCheck className="w-3.5 h-3.5 text-white/70" /> Report
              </button>
              <button onClick={() => setShowITSM(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10">
                <Ticket className="w-3.5 h-3.5 text-white/70" /> ITSM
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Incident overview: the incident at a glance, and every alert on it ── */}
          <div>
            <SectionHeader
              icon={Layers}
              title="Incident overview"
              badge={<span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[4px]">{incident.alerts.length} {incident.alerts.length === 1 ? 'alert' : 'alerts'}</span>}
              open={sections.overview}
              onToggle={() => toggle('overview')}
            />
            {sections.overview && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-[8px] px-5 py-4 grid grid-cols-4 gap-4">
                  {[
                    { icon: Calendar, label: 'Created', value: incident.created },
                    // CredentialAccess → Credential Access, as A labels tactics.
                    { icon: Target, label: 'MITRE Tactic', value: incident.mitre[0]?.tactic.replace(/([a-z])([A-Z])/g, '$1 $2') ?? '—' },
                    { icon: Bell, label: 'Alerts', value: String(incident.alerts.length) },
                    { icon: FileText, label: 'Logs', value: incident.logs.toLocaleString() },
                  ].map(m => (
                    <div key={m.label} className="flex items-center gap-2.5 min-w-0">
                      <m.icon className="w-4 h-4 text-[#2A96A8] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#092E3F]/50">{m.label}</p>
                        <p className="text-sm text-[#092E3F] truncate">{m.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[8px] border border-[var(--stroke)] overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#f6f6f6] border-b border-[var(--stroke)]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">Alerts on this incident</p>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-[#092E3F]/55">{rollup(incident.alerts, phases)}</p>
                      {/* Single-alert incidents use the Analyze button in the triage card instead. */}
                      {multi && running.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--stroke)] bg-white text-xs text-[#092E3F]/60">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2A96A8]" /> Analysing {running.length}…
                        </span>
                      )}
                      {multi && running.length === 0 && pending.length > 0 && (
                        <button
                          onClick={analyzeAll}
                          title={`Runs the AI on ${pending.length} ${pending.length === 1 ? 'alert' : 'alerts'}: ${pendingNote()}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[#092E3F] text-xs text-white hover:bg-[#2A96A8] transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {pending.length === incident.alerts.length ? 'Analyze all' : `Analyze remaining (${pending.length})`}
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {incident.alerts.map(al => {
                      const on = al.id === selected;
                      return (
                        <li key={al.id}>
                          <button
                            onClick={() => pick(al.id)}
                            aria-current={on}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${on ? 'bg-[#e5f2f4] shadow-[inset_3px_0_0_#2A96A8]' : 'hover:bg-black/[0.02]'}`}
                          >
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[11px] ${SEVERITY[al.severity]}`}>{al.severity}</span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm text-[#092E3F] truncate" title={al.title}>
                                {al.title}
                              </span>
                              <span className="block text-xs text-[#092E3F]/50 tabular-nums truncate">
                                {al.ref} · {al.time} · {al.source}
                              </span>
                            </span>
                            <AlertStatus alert={al} phase={phases[al.id]} />
                            {on ? <span className="shrink-0 w-14 text-right text-[11px] text-[#1e7d8f]">Viewing</span> : <span className="shrink-0 w-14" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* ── AI triage for the selected alert ── */}
          <div ref={triageRef} className="scroll-mt-4">
            <SectionHeader
              icon={Sparkles}
              iconCls="text-[#2A96A8]"
              title="AI triage"
              badge={multi && <span className="px-2 py-0.5 bg-[#eef2f3] text-[#092E3F]/70 text-xs rounded-[4px]">Alert {incident.alerts.indexOf(alert) + 1} of {incident.alerts.length}</span>}
              open={sections.triage}
              onToggle={() => toggle('triage')}
            />
            {sections.triage && (
              <>
                {multi && (
                  <p className="-mt-2 mb-4 text-xs text-[#092E3F]/55">
                    {alert.ref} · {alert.title}
                  </p>
                )}
                {/* Every alert stays mounted, so decisions and open sections survive switching between them. */}
                {incident.alerts.map(al => (
                  <div key={al.id} hidden={al.id !== selected}>
                    <AlertTriage alert={al} phase={phases[al.id]} onRun={() => runAnalysis(al.id)} onSentinel={openSentinel} onClosed={setClosed} />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Entities ── */}
          <div>
            <SectionHeader
              icon={Target}
              title="Entities"
              badge={<span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[4px]">{incident.entities.length}</span>}
              open={sections.entities}
              onToggle={() => toggle('entities')}
            />
            {sections.entities && (
              <div className="grid grid-cols-2 gap-2">
                {incident.entities.map(entity => {
                  const Icon = ENTITY_ICON[entity.type] ?? User;
                  return (
                    <div key={entity.name} className="flex items-center gap-2 p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#092E3F] truncate">{entity.name}</p>
                        <p className="text-xs text-[#092E3F]/50">{entity.type}</p>
                      </div>
                      <button onClick={() => copyEntity(entity.name)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-[4px]" title="Copy entity">
                        {copiedEntity === entity.name ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#092E3F]/60" />}
                      </button>
                      <Icon className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── MITRE ATT&CK ── */}
          <div>
            <SectionHeader
              icon={Target}
              title="MITRE ATT&CK Mapping"
              badge={
                <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[4px]">
                  {incident.mitre.length} {incident.mitre.length === 1 ? 'technique' : 'techniques'}
                </span>
              }
              open={sections.mitre}
              onToggle={() => toggle('mitre')}
            />
            {sections.mitre && (
              <div className="space-y-2">
                {incident.mitre.map(m => {
                  const [id, ...name] = m.technique.split(' ');
                  return (
                    <div key={m.technique} className="flex items-center justify-between p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-[#092E3F] text-white text-xs rounded-[4px] font-mono">{id}</span>
                        <div>
                          <p className="text-sm text-[#092E3F]">{name.join(' ')}</p>
                          <p className="text-xs text-[#092E3F]/60">{m.tactic}</p>
                        </div>
                      </div>
                      <a href={`https://attack.mitre.org/techniques/${id.replace('.', '/')}/`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4 text-[#2A96A8]" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Comments & Notes ── */}
          <div>
            <SectionHeader
              icon={MessageSquare}
              title="Comments & Notes"
              badge={<span className="px-2 py-0.5 bg-gray-200 text-[#092E3F]/70 text-xs rounded-[4px]">{comments.length}</span>}
              open={sections.comments}
              onToggle={() => toggle('comments')}
            />
            {sections.comments && (
              <div className="space-y-4">
                <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment or note..."
                    rows={3}
                    className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-[4px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Add Comment
                    </button>
                  </div>
                </div>
                {comments.map(c => (
                  <div key={c.id} className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-[#092E3F]">{c.user}</p>
                        <p className="text-xs text-[#092E3F]/50">{c.role}</p>
                      </div>
                      <span className="text-xs text-[#092E3F]/50">{c.timestamp}</span>
                    </div>
                    <p className="text-sm text-[#092E3F]/80">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Similar Incidents ── */}
          <div>
            <SectionHeader
              icon={Layers}
              title="Similar Incidents"
              badge={<span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[4px]">{incident.similar.total}</span>}
              open={sections.similar}
              onToggle={() => toggle('similar')}
            />
            {sections.similar &&
              (() => {
                const { total, sameVerdict } = incident.similar;
                const counts = ([
                  [primaryVerdict, sameVerdict],
                  ['Undetermined', total - sameVerdict],
                ] as [Verdict, number][]).filter(([, n]) => n > 0);
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-[8px]">
                      <p className="text-[11px] font-medium text-[#092E3F]/50 uppercase tracking-wide mb-2">How they were resolved</p>
                      <p className="text-sm text-[#092E3F]">
                        <span className="font-medium">
                          {sameVerdict} of {total}
                        </span>{' '}
                        were classified <span className="font-medium">{VERDICT[primaryVerdict].label}</span>
                        <span className="text-[#092E3F]/45"> ({Math.round((sameVerdict / total) * 100)}%)</span>
                      </p>
                      <div className="flex gap-[2px] h-1.5 rounded-[2px] overflow-hidden bg-gray-50 mt-3">
                        {counts.map(([c, n]) => (
                          <div key={c} className={CLASS_BAR[c]} style={{ width: `${(n / total) * 100}%` }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {counts.map(([c, n]) => (
                          <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/60">
                            <span className={`w-1.5 h-1.5 rounded-[1px] ${CLASS_BAR[c]}`} />
                            {VERDICT[c].label} {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-[var(--stroke)]">
                        <span className="flex-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Incident</span>
                        <span className="w-[70px] text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Entities</span>
                        <span className="w-[110px] text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Closed as</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {similarRows(incident, primaryVerdict).map(it => (
                          <div key={it.ref} className="flex items-center gap-3 px-3 py-2.5">
                            <span className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-[#092E3F]">#{it.ref}</span>
                              <span className="block text-xs text-[#092E3F]/45 truncate">
                                {it.severity} · {it.age}
                              </span>
                            </span>
                            <span className="w-[70px] shrink-0 text-xs text-[#092E3F]/70">
                              {it.shared} of {it.of}
                            </span>
                            <span className="w-[110px] shrink-0 inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
                              <span className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${CLASS_BAR[it.cls]}`} />
                              <span className="truncate">{VERDICT[it.cls].label}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      {showITSM && (
        <ITSMTicketSidebar
          context={{
            sourceType: 'incident',
            sourceId: incident.number,
            title: incident.title,
            severity: incident.severity,
            client: incident.client,
            description: ticketDescription,
            entities: incident.entities.map(e => e.name),
          }}
          onClose={() => setShowITSM(false)}
        />
      )}
    </>
  );
}
