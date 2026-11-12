import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  ExternalLink,
  RotateCcw,
  ArrowRight,
  Target,
  Fingerprint,
  Copy,
  Search,
  ListFilter,
  ArrowUpDown,
  ArrowDownWideNarrow,
  Globe,
  Mail,
  Monitor,
  Terminal,
  FileText,
  MessageSquare,
  Layers,
  Send,
  Undo2,
  CircleDashed,
  History,
} from 'lucide-react';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import EvidenceText, { RichText } from './EvidenceText';
import InvestigationEvidence, { type QueryFocus } from './InvestigationEvidence';
import { SEVERITIES, SEVERITY_BADGE, SEVERITY_DOT_ON_DARK } from './severity';
import { STATUSES, STATUS_DOT, STATUS_DOT_RING } from './status';
import { ATTENTION_ON_DARK } from './attention';
import { entityChipLabel, entityIcon, entityLabel, entityRank } from './entityTypes';
import imgSentinelPng from 'figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png';
import type { Analysis, DecisionAction, Finding, IncidentAlert, Lean, RedesignIncident, Verdict } from './triageRedesignData';

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

const VERDICT: Record<Verdict, { label: string; short: string; icon: typeof ShieldAlert; cls: string; icon_: string; lead: Lean }> = {
  TruePositive: { label: 'True positive', short: 'True positive', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-200', icon_: 'text-red-600', lead: 'attack' },
  FalsePositive: { label: 'False positive', short: 'False positive', icon: ShieldCheck, cls: 'bg-green-50 text-green-700 border-green-200', icon_: 'text-green-600', lead: 'away' },
  Undetermined: { label: 'Undetermined', short: 'Undetermined', icon: HelpCircle, cls: 'bg-gray-100 text-[#092E3F] border-gray-200', icon_: 'text-[#092E3F]/50', lead: 'unclear' },
};

// Labels in navy; the icon (shape and colour) is the only category signal.
const LEAN: Record<Lean, { label: string; icon: typeof AlertTriangle; icon_: string; text: string }> = {
  attack: { label: 'Malicious / Suspicious', icon: AlertTriangle, icon_: 'text-red-600', text: 'text-[#092E3F]' },
  unclear: { label: 'Inconclusive', icon: HelpCircle, icon_: 'text-amber-600', text: 'text-[#092E3F]' },
  away: { label: 'Benign', icon: CheckCircle2, icon_: 'text-green-600', text: 'text-[#092E3F]' },
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

/**
 * The AI's assessment in two lines: the verdict and its confidence as plain
 * text, then the AI's one-sentence reasoning. The verdict keeps a small
 * coloured icon as its only colour; the supporting figures live in Key
 * findings below, so they aren't repeated here.
 */
function VerdictCard({ a }: { a: Analysis }) {
  const v = VERDICT[a.verdict];
  return (
    // No border or inset: it reads as part of the triage, not a separate box.
    <section className="space-y-1.5">
      <Eyebrow>AI assessment</Eyebrow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-base font-bold text-[#092E3F]">
          <v.icon className={`w-4 h-4 ${v.icon_}`} aria-hidden /> {v.label}
        </span>
        <span className="text-[#092E3F]/25" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-[#092E3F]/70">
          <span className="tabular-nums">{a.confidence}%</span> confidence
          {/* A button, not a bare icon, so the explanation is reachable by keyboard too. */}
          <span className="relative group flex">
            <button type="button" aria-label="About AI confidence" className="ml-0.5 text-[#092E3F]/40 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
              <Info className="w-3.5 h-3.5" />
            </button>
            <span
              role="tooltip"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
            >
              How strongly the AI holds this verdict, given the checks it ran — not a measured probability of attack. Automated containment runs from {a.threshold}%;
              below that, every action waits for your approval.
            </span>
          </span>
        </span>
      </div>
      <p className="text-sm leading-snug text-[#092E3F]/85">
        <RichText text={a.headline} />
      </p>

      {a.gaps && (
        <div className="!mt-3 px-3 py-2 rounded-[4px] bg-amber-50 border border-amber-200">
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

/** "incident stays open" → "Incident stays open"; "closes as false positive" → "Incident closes as false positive". */
const effectLine = (effect: string) => (effect.startsWith('incident') ? effect[0].toUpperCase() + effect.slice(1) : `Incident ${effect}`);

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
          <p className="text-sm font-bold text-[#092E3F]">
            {act.title} <span className="font-normal text-xs text-[#092E3F]/55">· {act.channel}</span>
          </p>
          <dl className="mt-1 grid grid-cols-[56px_1fr] gap-x-2 gap-y-0.5 text-xs">
            {act.target && (
              <>
                <dt className="text-[#6b828c]">Affects</dt>
                <dd className="text-[#092E3F]/80 min-w-0">
                  {act.target.label && <span className="mr-1 text-[#092E3F]/55">{act.target.label}</span>}
                  <EvidenceText text={act.target.value} emphasis={false} />
                </dd>
              </>
            )}
            <dt className="text-[#6b828c]">Result</dt>
            <dd className="text-[#092E3F]/80">{effectLine(act.effect)}</dd>
          </dl>
        </div>
        {settled ? (
          <div className="shrink-0 flex items-center gap-3 pt-0.5">
            <span className={`inline-flex items-center gap-1.5 text-sm ${state === 'approved' ? 'text-[#1e7d8f]' : 'text-[#092E3F]/55'}`}>
              {state === 'approved' ? <Check className="w-4 h-4" /> : null}
              {state === 'approved' ? DONE[act.kind](act) : 'Dismissed — not run'}
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

      <button
        onClick={() => setWhy(!why)}
        aria-expanded={why}
        className="w-full flex items-center gap-1 px-4 pb-2.5 pt-0.5 text-left text-xs font-medium text-[#092E3F] hover:text-[#2A96A8]"
      >
        Why the AI recommends this
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${why ? 'rotate-180' : ''}`} />
      </button>
      {why && (
        <div className="mx-4 mb-3 -mt-1 pl-3 border-l-2 border-[#2A96A8]/30 space-y-1.5">
          <p className="text-sm text-[#092E3F]/85 leading-relaxed">
            <RichText text={act.why} />
          </p>
          <p className="text-xs text-[#092E3F]/60">
            <span className="text-[#6b828c]">What happens: </span>
            {act.does}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Findings ────────────────────────────────────────────────────────────────

function FindingRow({ f, a, onGo }: { f: Finding; a: Analysis; onGo: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const L = LEAN[f.lean];
  const checks = (f.queryIds ?? []).map(id => a.queries.find(q => q.id === id)!).filter(Boolean);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-start gap-2.5 pl-10 pr-4 py-2 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span className="sr-only">{L.label}: </span>
        <span className="flex-1 min-w-0 text-sm text-[#092E3F]">
          <RichText text={f.title} />
        </span>
        <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-[#092E3F]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pl-10 pr-4 pb-3 space-y-2.5">
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
          {checks.length === 0 && <p className="text-xs text-[#092E3F]/50">No supporting query is linked to this finding.</p>}
        </div>
      )}
    </div>
  );
}

/** One evidence category: a labelled, collapsible group of findings. */
function FindingGroup({ lean, items, a, onGo, defaultOpen }: { lean: Lean; items: Finding[]; a: Analysis; onGo: (id: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const L = LEAN[lean];
  return (
    <div className="border-b border-[var(--stroke)] last:border-b-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
        <L.icon className={`w-4 h-4 shrink-0 ${L.icon_}`} aria-hidden />
        <span className={`flex-1 text-sm font-bold ${L.text}`}>
          {L.label} <span className="font-normal text-[#092E3F]/50 tabular-nums">({items.length})</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#092E3F]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {items.map(f => (
            <FindingRow key={f.id} f={f} a={a} onGo={onGo} />
          ))}
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
      {/* Same shape as the failed state: message, then its action underneath. */}
      <div className="flex-1">
        <p className="text-sm text-[#092E3F]">This alert hasn’t been analysed yet</p>
        <p className="text-xs text-[#092E3F]/60 mt-0.5">Resolve reviews the sign-ins, threat intel and similar incidents, then recommends what to do. Typically 4–10 min.</p>
        <div className="flex gap-2 mt-3">
          <Btn primary onClick={onRun}>
            <Sparkles className="w-3.5 h-3.5" /> Analyze
          </Btn>
        </div>
      </div>
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
  const [historyOpen, setHistoryOpen] = useState(false);
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

  // Order: evaluate the conclusion → verify the evidence → decide → investigate further.
  return (
    <div className="space-y-5">
      <VerdictCard a={a} />

      {/* Key findings — the category that backs the verdict starts open. */}
      <section>
        <Eyebrow className="mb-2">Key findings ({a.findings.length})</Eyebrow>
        <div className="rounded-[8px] border border-[var(--stroke)] overflow-hidden">
          {groups.map(g => (
            <FindingGroup key={g.l} lean={g.l} items={g.items} a={a} onGo={goToQuery} defaultOpen={g.l === VERDICT[a.verdict].lead} />
          ))}
        </div>
      </section>

      {/* Recommended actions — suggestions waiting for the analyst, not decisions already made. */}
      <section className="space-y-2">
        <div className="flex items-center gap-1">
          <Eyebrow>Recommended actions ({a.actions.length})</Eyebrow>
          {a.actions.length > 0 && (
            // The (?) like Incident summary's: a button, so it's reachable by keyboard too.
            <span className="relative group flex">
              <button type="button" aria-label="About recommended actions" className="text-[#092E3F]/35 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              <span
                role="tooltip"
                className="absolute left-0 top-full mt-1.5 w-56 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
              >
                Suggested by the AI. Nothing runs until you approve it.
              </span>
            </span>
          )}
        </div>
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
        {a.footerNote && (
          <p className="pt-0.5 text-xs text-[#092E3F]/55">
            <span className="text-[#6b828c]">Playbooks: </span>
            {a.footerNote}
          </p>
        )}
      </section>

      {/* Investigation details — useful, but not the first thing to read. */}
      <section>
        <Eyebrow className="mb-2">Investigation details</Eyebrow>
        <div className="rounded-[8px] border border-[var(--stroke)] divide-y divide-[var(--stroke)]">
          {[
            ['What happened', a.happened],
            ['How did it happen', a.how],
          ].map(([title, lines]) => (
            <Disclosure key={title as string} title={title as string}>
              <ul className="space-y-1 list-disc pl-4 marker:text-[#092E3F]/30">
                {(lines as string[]).map(line => (
                  <li key={line} className="text-sm text-[#092E3F]/85">
                    <RichText text={line} />
                  </li>
                ))}
              </ul>
            </Disclosure>
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

      {/* Activity history — secondary, collapsed. */}
      <section className="rounded-[8px] border border-[var(--stroke)]">
        <button onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
          <History className="w-4 h-4 text-[#092E3F]/50" aria-hidden />
          <span className="flex-1 text-sm text-[#092E3F]">
            Activity history <span className="text-[#092E3F]/50 tabular-nums">({changelog.length})</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-[#092E3F]/45 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
        </button>
        {historyOpen && (
          <ol className="px-4 pb-3 space-y-1.5">
            {changelog.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#092E3F]/85">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#092E3F]/30 shrink-0" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

// ─── Incident overview ───────────────────────────────────────────────────────

/** Analysis status only — whether the AI has a result, not what the result is. */
function AnalysisState({ phase }: { phase: Phase }) {
  if (phase === 'running')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#1e7d8f]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing
      </span>
    );
  if (phase === 'error')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-700">
        <AlertOctagon className="w-3.5 h-3.5" aria-hidden /> Failed
      </span>
    );
  if (phase === 'none')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#092E3F]/55">
        <CircleDashed className="w-3.5 h-3.5" aria-hidden /> Not analysed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
      <CheckCircle2 className="w-3.5 h-3.5 text-[#2A96A8]" aria-hidden /> Completed
    </span>
  );
}

// ─── Secondary sections, as on Incidents (A) ─────────────────────────────────

type SectionKey = 'triage' | 'entities' | 'mitre' | 'comments' | 'similar';

function SectionHeader({
  icon: Icon,
  iconCls = 'text-[#092E3F]',
  title,
  count,
  help,
  open,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconCls?: string;
  title: string;
  /** Shown after the title in plain text: "Entities (17)". */
  count?: string | number;
  /** Text for a (?) tooltip next to the title. */
  help?: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (!help) {
    return (
      <button onClick={onToggle} className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconCls}`} />
          <h3 className="text-base font-bold text-[#092E3F]">
            {title}
            {count !== undefined && <span className="ml-1 font-normal text-[#092E3F]/50 tabular-nums">({count})</span>}
          </h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#092E3F]/60" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/60" />}
      </button>
    );
  }
  // With a (?): the title and the chevron toggle, the (?) is its own control —
  // a button can't sit inside another button.
  return (
    <div className="relative flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconCls}`} />
          <h3 className="text-base font-bold text-[#092E3F]">
            {title}
            {count !== undefined && <span className="ml-1 font-normal text-[#092E3F]/50 tabular-nums">({count})</span>}
          </h3>
        </button>
        <span className="group flex">
          <button type="button" aria-label={`About ${title.toLowerCase()}`} className="text-[#092E3F]/35 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <span
            role="tooltip"
            className="absolute left-0 top-full mt-1 w-64 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
          >
            {help}
          </span>
        </span>
      </div>
      <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>
        {open ? <ChevronUp className="w-4 h-4 text-[#092E3F]/60" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/60" />}
      </button>
    </div>
  );
}

/**
 * How an entity card copies its value — two patterns, side by side for user
 * testing before one is picked:
 *   card  click anywhere copies (on release; a drag selects text instead):
 *         hover border, "Click to copy", "Copied"
 *   icon  static card, selectable text, a copy icon next to the value on hover
 * Accounts use `card`, everything else `icon`.
 */
const COPY_PATTERN: Record<string, 'card' | 'icon'> = { Account: 'card' };

/** Entities shown before "Show all" — enough for most incidents, short for big ones. */
const ENTITY_CAP = 6;

/**
 * Threat-intel score bands — the frontend's thresholds, in the Threat Analysis
 * colour order (High navy, Medium teal, Low light teal, safe pale). Red is left
 * out on purpose: it means a True Positive verdict, not a reputation score.
 */
const SCORE_BANDS = [
  { min: 80, label: 'High', cls: 'bg-[#092E3F] text-white' },
  { min: 50, label: 'Medium', cls: 'bg-[#2A96A8] text-white' },
  { min: 30, label: 'Low', cls: 'bg-[#90C6CF] text-[#092E3F]' },
  { min: 0, label: 'Safe', cls: 'bg-[#E5F2F4] text-[#092E3F]' },
];

function ScoreBadge({ score }: { score: number }) {
  const band = SCORE_BANDS.find(b => score >= b.min)!;
  return (
    <span className="relative group/score flex-shrink-0">
      <span
        tabIndex={0}
        aria-label={`Threat intel score ${score} of 100, ${band.label.toLowerCase()}`}
        className={`grid place-items-center min-w-[30px] h-[22px] px-1.5 rounded-[4px] text-xs font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A96A8]/40 ${band.cls}`}
      >
        {score}
      </span>
      <span
        role="tooltip"
        className="absolute right-0 bottom-full mb-1.5 w-max max-w-[220px] p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover/score:opacity-100 group-hover/score:visible group-focus-within/score:opacity-100 group-focus-within/score:visible transition-opacity z-10 pointer-events-none"
      >
        <span className="block font-bold">Threat intel score: {score}/100</span>
        <span className="block text-white/70">{band.label} · reputation across the connected threat-intel feeds</span>
      </span>
    </span>
  );
}

/** The entity's type icon at the start of the card — the bare icon, no tile. */
function EntityTile({ icon: Icon, copied }: { icon: React.ComponentType<{ className?: string }>; copied?: boolean }) {
  return copied ? <Check className="w-4 h-4 text-green-600 flex-shrink-0" /> : <Icon className="w-4 h-4 text-[#092E3F]/60 flex-shrink-0" />;
}

/**
 * A toolbar button beside a search field that opens a menu under it. Closes on
 * a click outside or Escape. `active` marks a non-default setting so it can be
 * told apart at a glance; `badge` counts what's applied.
 */
function MenuButton({
  icon: Icon,
  label,
  active,
  badge,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[4px] border bg-white text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A96A8]/40 ${
          active || open ? 'border-[#092E3F] text-[#092E3F]' : 'border-[var(--stroke)] text-[#092E3F]/75 hover:border-[#2A96A8] hover:text-[#092E3F]'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
        {!!badge && (
          <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-[4px] bg-[#092E3F] text-white text-[11px] font-bold tabular-nums">{badge}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[var(--stroke)] rounded-[4px] shadow-lg z-20">{children(() => setOpen(false))}</div>
      )}
    </div>
  );
}

/** Filter menu: every entity type in the incident, multi-select, with counts for the current search. */
function EntityFilterMenu({
  types,
  counts,
  picked,
  onToggle,
  onClear,
}: {
  types: string[];
  counts: Record<string, number>;
  picked: string[];
  onToggle: (t: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const listed = types.filter(t => !q || entityChipLabel(t).toLowerCase().includes(q));
  return (
    <MenuButton icon={ListFilter} label="Filter" active={picked.length > 0} badge={picked.length}>
      {() => (
        <>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">Entity type</span>
            {picked.length > 0 && (
              <button onClick={onClear} className="text-xs text-[#1e7d8f] hover:text-[#092E3F]">
                Clear
              </button>
            )}
          </div>
          {types.length > 6 && (
            <div className="px-2 pb-2">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find a type…"
                aria-label="Find an entity type"
                className="w-full h-8 px-2.5 text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 border border-[var(--stroke)] rounded-[4px] focus:outline-none focus:border-[#2A96A8]"
              />
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto pb-1 border-t border-[var(--stroke)] pt-1">
            {listed.map(t => {
              const on = picked.includes(t);
              const Icon = entityIcon(t);
              const n = counts[t] ?? 0;
              return (
                <li key={t}>
                  <button
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => onToggle(t)}
                    disabled={!on && !n}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-[#092E3F] hover:bg-[#f6f6f6] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <span className={`grid place-items-center w-4 h-4 rounded-[4px] border flex-shrink-0 ${on ? 'bg-[#092E3F] border-[#092E3F]' : 'border-[#092E3F]/30'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-[#092E3F]/60 flex-shrink-0" />
                    <span className="flex-1 truncate">{entityChipLabel(t)}</span>
                    <span className="text-xs tabular-nums text-[#092E3F]/45">{n}</span>
                  </button>
                </li>
              );
            })}
            {listed.length === 0 && <li className="px-3 py-2 text-xs text-[#092E3F]/50">No type matches “{query.trim()}”.</li>}
          </ul>
        </>
      )}
    </MenuButton>
  );
}

export type EntitySort = 'default' | 'score';
const SORTS: { id: EntitySort; label: string; hint: string }[] = [
  { id: 'default', label: 'Default order', hint: 'By type: accounts, hosts, IPs, then the rest' },
  { id: 'score', label: 'Highest reputation score', hint: 'Riskiest first; unscored entities last' },
];

/** Sort menu: default type order, or highest threat-intel reputation score first. */
function EntitySortMenu({ sort, onSort, hasScores }: { sort: EntitySort; onSort: (s: EntitySort) => void; hasScores: boolean }) {
  return (
    <MenuButton icon={sort === 'score' ? ArrowDownWideNarrow : ArrowUpDown} label={sort === 'score' ? 'Highest score' : 'Sort'} active={sort !== 'default'}>
      {close => (
        <ul className="py-1" role="menu">
          {SORTS.map(o => {
            const on = sort === o.id;
            const off = o.id === 'score' && !hasScores;
            return (
              <li key={o.id}>
                <button
                  role="menuitemradio"
                  aria-checked={on}
                  disabled={off}
                  onClick={() => {
                    onSort(o.id);
                    close();
                  }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[#f6f6f6] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${on ? 'text-[#092E3F]' : 'invisible'}`} />
                  <span>
                    <span className="block text-sm text-[#092E3F]">{o.label}</span>
                    <span className="block text-xs text-[#092E3F]/50">{off ? 'No entity in this incident has a score' : o.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </MenuButton>
  );
}

/**
 * A header label that changes on click, as Azure DevOps does with a work
 * item's state. A chevron marks it as editable — read-only labels beside it
 * (Attention, the Sentinel source) have none — and hover or keyboard focus
 * strengthens it. A click opens the options under it, picking one applies it
 * straight away. Closes on a click outside or Escape.
 */
/** The confidence column in the alert list ("60%" with its tooltip). Hidden for now on request; set true to bring it back as it was. */
const SHOW_ROW_CONFIDENCE = false;

/** The Attention pill in the header ("True Positive Detected"…). Set false to hide it. */
const SHOW_ATTENTION = true;

/** Where "Open in Sentinel" goes — the Sentinel incidents blade (mock: no per-incident deep link). */
const SENTINEL_URL = 'https://portal.azure.com/#view/Microsoft_Azure_Security_Insights/MainMenuBlade/~/Incidents';

/** The panel toolbar's buttons: one size, padding and gap for all three. */
const TOOLBAR_BTN =
  'inline-flex items-center gap-2 h-9 px-4 rounded-[8px] bg-white border border-[var(--stroke)] text-sm text-[#092E3F] hover:border-[#2A96A8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A96A8]/40 transition-colors';

/** Editable header chip: a ringed dot, the value and a chevron; the translucent fill appears on hover, focus or while open. */
const HEADER_CHIP = 'gap-2 h-8 pl-3 pr-3.5 rounded-full bg-transparent hover:bg-white/10 focus-visible:bg-white/10 text-white';

function HeaderPicker<T extends string>({
  label,
  note,
  value,
  options,
  onPick,
  triggerCls,
  busy,
  children,
}: {
  /** While a change is saving: the trigger is locked and says so. */
  busy?: boolean;
  /** The menu's heading and the trigger's accessible name, e.g. "Status". */
  label: string;
  /** Optional line under the heading. */
  note?: string;
  value: T;
  options: { value: T; swatch: React.ReactNode }[];
  onPick: (v: T) => void;
  /** Classes for the trigger's own look (pill or bare label). */
  triggerCls: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        aria-busy={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={busy ? `${label}: saving` : `${label}: ${value}. Change`}
        className={`group/pick inline-flex items-center gap-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${triggerCls} ${open ? '!bg-white/10' : ''} disabled:cursor-progress`}
      >
        {children}
        {/* Always shown, so the label reads as a control and not a static tag; brighter on hover or focus. */}
        {busy ? (
          <span className="text-xs text-white/60">Saving…</span>
        ) : (
        <ChevronDown
          className={`w-3.5 h-3.5 -mr-1 transition-[opacity,transform] ${open ? 'opacity-100 rotate-180' : 'opacity-60 group-hover/pick:opacity-100 group-focus-visible/pick:opacity-100'}`}
          aria-hidden
        />
        )}
      </button>
      {open && !busy && (
        <div role="menu" aria-label={label} className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-[var(--stroke)] rounded-[4px] shadow-lg z-30 text-left">
          <div className="px-3 pt-2.5 pb-2 border-b border-[var(--stroke)]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
            {note && <p className="mt-0.5 text-xs leading-snug text-[#092E3F]/60">{note}</p>}
          </div>
          <ul className="py-1">
            {options.map(o => {
              const on = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      setOpen(false);
                      if (!on) onPick(o.value);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm text-[#092E3F] hover:bg-[#f6f6f6]"
                  >
                    {o.swatch}
                    <span className="flex-1">{o.value}</span>
                    {on && <Check className="w-4 h-4 text-[#092E3F]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </span>
  );
}

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
  const [status, setStatus] = useState(incident.status);
  const [severity, setSeverity] = useState(incident.severity);
  const shownStatus = closed ? 'Closed' : status;
  const showAttention = SHOW_ATTENTION && incident.attention !== 'No Attention';
  // A header change in flight: the chip shows the new value with a spinner until
  // the save settles. A failed save puts the old value back and says so — never
  // a silent revert — with a Retry.
  const [saving, setSaving] = useState<{ field: 'status' | 'severity'; value: string } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeClass, setCloseClass] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState('');
  const saveHeader = (field: 'status' | 'severity', value: string, previous: string, savedNote = 'Saved to Microsoft Sentinel.') => {
    setSaving({ field, value });
    const name = field === 'status' ? 'Status' : 'Severity';
    setTimeout(() => {
      setSaving(null);
      // Mock: #14371 can't be written back to Sentinel, to show the failure path.
      if (incident.number === '14371') {
        toast.error(`Couldn't change ${field} to ${value}`, {
          description: `Sentinel didn't accept the change, so it's still ${previous}. Nothing else was changed.`,
          action: { label: 'Retry', onClick: () => saveHeader(field, value, previous, savedNote) },
          duration: 8000,
        });
        return;
      }
      if (field === 'severity') setSeverity(value as typeof severity);
      else {
        setClosed(value === 'Closed');
        if (value !== 'Closed') setStatus(value as typeof status);
      }
      toast.success(`${name} changed to ${value}`, { description: savedNote });
    }, 900);
  };
  useEffect(() => {
    if (!confirmClose) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setConfirmClose(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [confirmClose]);
  const shownSeverity = saving?.field === 'severity' ? (saving.value as typeof severity) : severity;
  const headerStatus = saving?.field === 'status' ? (saving.value as typeof shownStatus) : shownStatus;
  const [showITSM, setShowITSM] = useState(false);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ triage: true, entities: true, mitre: true, comments: true, similar: true });
  const toggle = (k: SectionKey) => setSections(s => ({ ...s, [k]: !s[k] }));
  const [copiedEntity, setCopiedEntity] = useState<string | null>(null);
  // Where the pointer went down on a click-to-copy card, to tell a click from a drag.
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  // Cursor-following "Copy to clipboard" tip over an entity's copy icon, as in the Incidents (A) table.
  const [copyTip, setCopyTip] = useState<{ name: string; x: number; y: number } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ id: number; user: string; role: string; timestamp: string; content: string }[]>([]);
  const [allEntities, setAllEntities] = useState(false);
  const [entityQuery, setEntityQuery] = useState('');
  const sortedEntities = [...incident.entities].sort((x, y) => entityRank(x.type) - entityRank(y.type));
  // Search matches the value or the type ("ip", "account"). While searching, every
  // match shows — the cap only shortens the unfiltered list.
  const entityQ = entityQuery.trim().toLowerCase();
  const searching = entityQ.length > 0;
  const searched = searching ? sortedEntities.filter(e => e.name.toLowerCase().includes(entityQ) || e.type.toLowerCase().includes(entityQ)) : sortedEntities;
  // One list for every type, narrowed by type chips — no per-type groups, so the
  // two-column grid always fills (one account no longer leaves a hole beside it).
  // Chips toggle independently; none selected means every type.
  const [pickedTypes, setPickedTypes] = useState<string[]>([]);
  const entityTypes = [...new Set(sortedEntities.map(e => e.type))];
  const [entitySort, setEntitySort] = useState<EntitySort>('default');
  const filtered = pickedTypes.length ? searched.filter(e => pickedTypes.includes(e.type)) : searched;
  // Highest score first; entities without a score keep their default order, after the scored ones.
  const entities = entitySort === 'score' ? [...filtered].sort((x, y) => (y.score ?? -1) - (x.score ?? -1)) : filtered;
  const countBy = (list: { type: string }[]) => list.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  const togglePicked = (t: string) => setPickedTypes(p => (p.includes(t) ? p.filter(x => x !== t) : [...p, t]));
  // "IP addresses" when exactly one type is picked, otherwise "entities".
  const pickedNoun = pickedTypes.length === 1 ? entityLabel(pickedTypes[0], 2) : 'entities';
  const shownEntities = allEntities || searching ? entities : entities.slice(0, ENTITY_CAP);
  const analysedCount = incident.alerts.filter(al => phases[al.id] === 'done').length;

  const alert = incident.alerts.find(al => al.id === selected)!;
  const multi = incident.alerts.length > 1;
  // How past incidents were closed — history, so it doesn't wait on today's analysis.
  const primaryVerdict = incident.alerts[0].analysis.verdict;

  const runAnalysis = (id: string) => {
    setPhases(p => ({ ...p, [id]: 'running' }));
    setTimeout(() => setPhases(p => ({ ...p, [id]: 'done' })), ANALYSIS_MS);
  };

  const running = incident.alerts.filter(al => phases[al.id] === 'running');
  // Alerts that still need the AI: never analysed, or the last run failed.
  const pending = incident.alerts.filter(al => phases[al.id] === 'none' || phases[al.id] === 'error');
  const pendingNote = () => {
    const none = pending.filter(al => phases[al.id] === 'none').length;
    const failed = pending.length - none;
    return [none && `${none} not analysed`, failed && `${failed} failed`].filter(Boolean).join(', ');
  };
  const runMany = (list: IncidentAlert[], done: string) => {
    const batch = list.map(al => al.id);
    setPhases(p => ({ ...p, ...Object.fromEntries(batch.map(id => [id, 'running' as Phase])) }));
    batch.forEach((id, i) =>
      setTimeout(() => {
        setPhases(p => ({ ...p, [id]: 'done' }));
        if (i === batch.length - 1) toast.success(`${batch.length} ${batch.length === 1 ? 'alert' : 'alerts'} ${done}`);
      }, ANALYSIS_MS + i * 1100),
    );
  };
  // One click for every alert that still needs it; they finish at different times, as real runs do.
  const analyzeAll = () => runMany(pending, 'analysed');
  // New tab, so this panel stays as it is.
  const openSentinel = () => window.open(SENTINEL_URL, '_blank', 'noopener,noreferrer');
  const pick = (id: string) => {
    setSelected(id);
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
        {/* ── Header and toolbar, as in the Seculyze app ── */}
        {/* Gradient sampled from the live app's incident panel header. */}
        <header className="bg-gradient-to-r from-[#013042] to-[#184354] px-6 pt-6 pb-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-6">
            {/* The incident number leads, quieter than the title, so analysts can quote or search it. */}
            <h2 className="text-xl font-semibold leading-snug text-white line-clamp-2" title={`#${incident.number} ${incident.title}`}>
              <span className="mr-2 text-base font-normal text-white/60 tabular-nums">#{incident.number}</span>
              {incident.title}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] bg-white/10 hover:bg-white/20 transition-colors"
                title={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                {expanded ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </button>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-[8px] bg-white/10 hover:bg-white/20 transition-colors" title="Close panel">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          {/* Seculyze's verdict first, then the rule's default severity, then workflow state. */}
          {/* With no Attention pill first, the severity chip leads; its hover padding is pulled back so the dot lines up with the title. */}
          <div className={`mt-3 flex flex-wrap items-center gap-2 ${showAttention ? '' : '-ml-3'}`}>
            {showAttention && (
              <span className={`px-3 py-0.5 rounded-full border text-sm ${ATTENTION_ON_DARK[incident.attention]}`}>{incident.attention}</span>
            )}
            <HeaderPicker
              label="Severity"
              note="Sentinel’s severity for this incident. The analytics rule sets it, the same for every incident it raises; change it here to correct it. Seculyze’s own assessment is in Attention."
              value={severity}
              options={SEVERITIES.map(v => ({ value: v, swatch: <span className={`w-3 h-3 rounded-[3px] flex-shrink-0 border border-[#2A96A8]/30 ${SEVERITY_BADGE[v]}`} aria-hidden /> }))}
              onPick={v => saveHeader('severity', v, severity)}
              busy={saving?.field === 'severity'}
              triggerCls={HEADER_CHIP}
            >
              {saving?.field === 'severity' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" aria-hidden />
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full ring-2 ${SEVERITY_DOT_ON_DARK[shownSeverity]}`} aria-hidden />
              )}
              {shownSeverity}
            </HeaderPicker>
            <HeaderPicker
              label="Status"
              value={shownStatus}
              options={STATUSES.map(v => ({ value: v, swatch: <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[v]}`} aria-hidden /> }))}
              onPick={v => {
                // Closing writes back to Sentinel and can set off automation, so it asks first.
                if (v === 'Closed') {
                  setCloseClass(null);
                  setCloseNote('');
                  setConfirmClose(true);
                } else saveHeader('status', v, shownStatus);
              }}
              busy={saving?.field === 'status'}
              triggerCls={HEADER_CHIP}
            >
              {saving?.field === 'status' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" aria-hidden />
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full ring-2 ${STATUS_DOT[headerStatus]} ${STATUS_DOT_RING[headerStatus]}`} aria-hidden />
              )}
              {headerStatus}
            </HeaderPicker>
          </div>
        </header>

        <div className="relative px-4 py-3 bg-[#f8fafb] border-b border-[var(--stroke)] flex items-center gap-2 flex-shrink-0">
          {/* Opens a new tab, so the panel the analyst is working in stays put — the icon and tooltip say so before the click. */}
          <a
            href={SENTINEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens Microsoft Sentinel in a new tab"
            className={TOOLBAR_BTN}
          >
            {/* The source image is 600×315 with the shield centred; cropped to a square so it takes the same 16px as the other icons. */}
            <img src={imgSentinelPng} alt="" className="w-4 h-4 object-cover flex-shrink-0" />
            Open in Sentinel
            <ExternalLink className="w-3.5 h-3.5 text-[#092E3F]/50" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <button onClick={() => toast.success('Report generated')} className={TOOLBAR_BTN}>
            <FileText className="w-4 h-4 flex-shrink-0" /> Generate report
          </button>
          {/* Equal weight: not every incident needs escalating, so none of the three leads. */}
          {/* Same name as the AI's "Create Ticket" recommendation; where it goes is in the tooltip. */}
          <button onClick={() => setShowITSM(true)} title="Opens a ticket in the client's ITSM system" className={TOOLBAR_BTN}>
            <Ticket className="w-4 h-4 flex-shrink-0" /> Create ticket
          </button>

        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── AI triage: pick an alert, then its triage ── */}
          <div>
            <SectionHeader
              icon={Sparkles}
              iconCls="text-[#2A96A8]"
              title="AI triage"
              count={`${incident.alerts.length} ${incident.alerts.length === 1 ? 'alert' : 'alerts'}`}
              open={sections.triage}
              onToggle={() => toggle('triage')}
            />
            {sections.triage && (
              <>
                {/* Incident summary — written by the AI analysis, so it lives here and
                    only appears once at least one alert has been analysed. */}
                <div className="mb-5">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Eyebrow>Incident summary</Eyebrow>
                    <span className="relative group flex">
                      <button type="button" aria-label="About the incident summary" className="text-[#092E3F]/35 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                      <span
                        role="tooltip"
                        className="absolute left-0 top-full mt-1.5 w-64 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
                      >
                        {analysedCount === 0
                          ? 'The AI writes a summary of the whole incident once its alerts are analysed.'
                          : analysedCount === incident.alerts.length
                            ? `AI summary of ${incident.alerts.length === 1 ? 'the alert' : `all ${incident.alerts.length} alerts`} on this incident.`
                            : `AI summary of ${analysedCount} of ${incident.alerts.length} alerts. ${incident.alerts.length - analysedCount} ${incident.alerts.length - analysedCount === 1 ? 'isn’t' : 'aren’t'} analysed yet, so it may change.`}
                      </span>
                    </span>
                  </div>
                  {analysedCount === 0 ? (
                    <p className="text-sm text-[#092E3F]/60">
                      No summary yet. Analyse the {incident.alerts.length === 1 ? 'alert' : 'alerts'} below and the AI will summarise the incident.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-[#092E3F]">
                      <RichText text={incident.summary} />
                    </p>
                  )}
                </div>
                {/* Several alerts: the list is the picker, and the selected row says which
                    alert the triage below is about. One alert: just name it. */}
                {multi ? (
              <div className="mb-5 rounded-[8px] border border-[var(--stroke)]">
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#f6f6f6] border-b border-[var(--stroke)] rounded-t-[8px]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">Alerts on this incident</p>
                  <div className="flex items-center gap-3">
                    {/* No summary line: each row already shows its own status and verdict, and the section title gives the count. */}
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
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors [li:last-child>&]:rounded-b-[8px] ${on ? 'bg-[#e5f2f4] shadow-[inset_3px_0_0_#2A96A8]' : 'hover:bg-black/[0.02]'}`}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-[#092E3F] truncate" title={al.title}>
                              {al.title}
                            </span>
                            <span className="block text-xs text-[#092E3F]/50 tabular-nums truncate">
                              {al.ref} · {al.time} · {al.source}
                            </span>
                          </span>
                          {/* Status, verdict and confidence each get their own column, so none reads as another; the tinted row with its edge marks the one being viewed. */}
                          {/* Severity sits in a fixed-width column after the title, so every title starts at the same edge. */}
                          <span className="shrink-0 w-[72px]">
                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[11px] ${SEVERITY_BADGE[al.severity]}`}>{al.severity}</span>
                          </span>
                          <span className="shrink-0 w-[104px]">
                            <AnalysisState phase={phases[al.id]} />
                          </span>
                          <span className="shrink-0 w-[96px]">
                            {phases[al.id] === 'done' && (
                              <span className={`px-1.5 py-0.5 rounded-[4px] border text-[11px] ${VERDICT[al.analysis.verdict].cls}`}>{VERDICT[al.analysis.verdict].short}</span>
                            )}
                          </span>
                          {SHOW_ROW_CONFIDENCE && (
                          <span className="shrink-0 w-9 text-right">
                            {phases[al.id] === 'done' && (
                              // Hover or row focus explains the bare number.
                              <span className="relative group/conf inline-block">
                                <span className="text-xs text-[#092E3F]/60 tabular-nums underline decoration-dotted decoration-[#092E3F]/30 underline-offset-2 cursor-help">
                                  <span className="sr-only">AI confidence </span>
                                  {al.analysis.confidence}%
                                </span>
                                <span
                                  role="tooltip"
                                  className="absolute right-0 bottom-full mb-2 w-60 p-2.5 bg-[#092E3F] text-white text-xs text-left leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover/conf:opacity-100 group-hover/conf:visible transition-opacity z-20 pointer-events-none"
                                >
                                  <span className="block font-bold">AI confidence: {al.analysis.confidence}%</span>
                                  <span className="block text-white/75">
                                    How strongly the AI holds its {VERDICT[al.analysis.verdict].label.toLowerCase()} verdict for this alert — not a measured probability of attack.
                                  </span>
                                </span>
                              </span>
                            )}
                          </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
                ) : (
                  <p className="-mt-2 mb-4 text-xs text-[#092E3F]/55 tabular-nums">
                    {alert.ref} · {alert.title} · {alert.source}
                  </p>
                )}
                {/* Every alert stays mounted, so decisions and open sections survive switching between them. */}
                {incident.alerts.map(al => (
                  <div key={al.id} hidden={al.id !== selected}>
                    <AlertTriage
                      alert={al}
                      phase={phases[al.id]}
                      onRun={() => runAnalysis(al.id)}
                      onSentinel={openSentinel}
                      onClosed={setClosed}
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Entities, grouped by type; long lists start capped ── */}
          <div>
            <SectionHeader
              icon={Fingerprint}
              title="Entities"
              count={incident.entities.length}
              open={sections.entities}
              onToggle={() => toggle('entities')}
            />
            {sections.entities && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#092E3F]/40 pointer-events-none" />
                  <input
                    type="search"
                    value={entityQuery}
                    onChange={e => setEntityQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEntityQuery('')}
                    placeholder="Search entities…"
                    aria-label="Search entities"
                    className="w-full h-9 pl-9 pr-9 text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 bg-white border border-[var(--stroke)] rounded-[4px] focus:outline-none focus:border-[#2A96A8] transition-colors [&::-webkit-search-cancel-button]:hidden"
                  />
                  {searching && (
                    <button
                      onClick={() => setEntityQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] text-[#092E3F]/40 hover:text-[#092E3F] hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {entityTypes.length > 1 && (
                  <EntityFilterMenu types={entityTypes} counts={countBy(searched)} picked={pickedTypes} onToggle={togglePicked} onClear={() => setPickedTypes([])} />
                )}
                <EntitySortMenu sort={entitySort} onSort={setEntitySort} hasScores={sortedEntities.some(e => e.score !== undefined)} />
                </div>
                {entities.length === 0 && (
                  <p className="text-sm text-[#092E3F]/60">
                    {searching ? `No ${pickedNoun} match “${entityQuery.trim()}”.` : `No ${pickedNoun}.`}
                  </p>
                )}
                {shownEntities.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                {shownEntities.map(entity => {
                  const Icon = entityIcon(entity.type);
                  const copied = copiedEntity === entity.name;
                  // Two copy patterns side by side for user testing (see COPY_PATTERN).
                  if (COPY_PATTERN[entity.type] === 'card') {
                    return (
                      // A div, not a <button>: browsers don't allow selecting text inside a
                      // button. Copies on release only if it was a plain click — a drag or
                      // a selection inside the card is left alone so part of it can be copied.
                      <div
                        key={entity.name}
                        role="button"
                        tabIndex={0}
                        aria-label={`Copy ${entity.name}`}
                        onMouseDown={e => (pressAt.current = { x: e.clientX, y: e.clientY })}
                        onMouseEnter={e => setCopyTip({ name: entity.name, x: e.clientX, y: e.clientY })}
                        onMouseMove={e => setCopyTip({ name: entity.name, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setCopyTip(null)}
                        onClick={e => {
                          const p = pressAt.current;
                          pressAt.current = null;
                          const dragged = p !== null && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4;
                          const sel = window.getSelection();
                          const selecting = !!sel && !sel.isCollapsed && e.currentTarget.contains(sel.anchorNode);
                          if (!dragged && !selecting) copyEntity(entity.name);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            copyEntity(entity.name);
                          }
                        }}
                        className="flex items-center gap-2.5 p-3 text-left bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] focus-visible:border-[#2A96A8] focus:outline-none transition-colors group cursor-pointer"
                      >
                        <EntityTile icon={Icon} copied={copied} />
                        <div className="flex-1 min-w-0">
                          <p title={entity.name} className="text-sm text-[#092E3F] truncate select-text cursor-text">{entity.name}</p>
                        </div>
                        {entity.score !== undefined && <ScoreBadge score={entity.score} />}
                      </div>
                    );
                  }
                  // Static card; the copy icon sits next to the value and appears on
                  // hover or keyboard focus, like copying an incident number in the
                  // Incidents (A) table.
                  return (
                    <div key={entity.name} className="group/entity flex items-center gap-2.5 p-3 bg-white border border-[var(--stroke)] rounded-[8px]">
                      <EntityTile icon={Icon} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <p title={entity.name} className="text-sm text-[#092E3F] truncate select-text">{entity.name}</p>
                          <button
                            onClick={() => copyEntity(entity.name)}
                            onMouseEnter={e => setCopyTip({ name: entity.name, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => setCopyTip({ name: entity.name, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setCopyTip(null)}
                            aria-label={`Copy ${entity.name}`}
                            className={`flex-shrink-0 p-1 rounded-[4px] hover:bg-gray-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#2A96A8]/40 transition-all ${
                              copied ? 'opacity-100' : 'opacity-0 group-hover/entity:opacity-100'
                            }`}
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#092E3F]/60" />}
                          </button>
                        </div>
                      </div>
                      {entity.score !== undefined && <ScoreBadge score={entity.score} />}
                    </div>
                  );
                })}
                </div>
                )}
                {!searching && entities.length > ENTITY_CAP && (
                  <button onClick={() => setAllEntities(!allEntities)} className="text-xs text-[#1e7d8f] hover:text-[#092E3F]">
                    {allEntities ? 'Show fewer' : `Show all ${entities.length} ${pickedNoun}`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── MITRE ATT&CK ── */}
          <div>
            <SectionHeader
              icon={Target}
              title="MITRE ATT&CK Mapping"
              count={`${incident.mitre.length} ${incident.mitre.length === 1 ? 'technique' : 'techniques'}`}
              open={sections.mitre}
              onToggle={() => toggle('mitre')}
            />
            {sections.mitre && (
              // Two columns, like the entity cards; the technique ID is a quiet grey tag, not a navy block that reads as a button.
              <div className="grid grid-cols-2 gap-2">
                {incident.mitre.map(m => {
                  const [id, ...name] = m.technique.split(' ');
                  return (
                    <div key={m.technique} className="flex items-center gap-3 p-3 bg-white border border-[var(--stroke)] rounded-[8px] group min-w-0">
                      <span className="shrink-0 px-1.5 py-0.5 bg-[#eef2f3] text-[#092E3F]/75 text-[11px] rounded-[4px] font-mono">{id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#092E3F] truncate" title={name.join(' ')}>
                          {name.join(' ')}
                        </p>
                        {/* Sentinel stores tactics run together ("CredentialAccess"); MITRE writes them as words. */}
                        <p className="text-xs text-[#092E3F]/60">{m.tactic.replace(/([a-z])([A-Z])/g, '$1 $2')}</p>
                      </div>
                      <a
                        href={`https://attack.mitre.org/techniques/${id.replace('.', '/')}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${id} on attack.mitre.org`}
                        aria-label={`Open ${id} on attack.mitre.org (new tab)`}
                        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4 text-[#092E3F]/50 hover:text-[#092E3F]" />
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
              count={comments.length}
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
              count={incident.similar.total}
              open={sections.similar}
              onToggle={() => toggle('similar')}
            />
            {sections.similar &&
              (() => {
                const { total, sameVerdict } = incident.similar;
                // When this incident is itself Undetermined, both shares are the same class — merge them.
                const counts = (
                  primaryVerdict === 'Undetermined'
                    ? [['Undetermined', total]]
                    : [
                        [primaryVerdict, sameVerdict],
                        ['Undetermined', total - sameVerdict],
                      ]
                ).filter(([, n]) => (n as number) > 0) as [Verdict, number][];
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

      {confirmClose && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onMouseDown={e => e.target === e.currentTarget && setConfirmClose(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="close-incident-title" className="w-full max-w-md bg-white rounded-[8px] shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-[var(--stroke)]">
              <h2 id="close-incident-title" className="text-base font-bold text-[#092E3F]">
                Close incident #{incident.number}?
              </h2>
              <p className="mt-1.5 text-sm text-[#092E3F]/70 leading-snug">
                This closes it in Microsoft Sentinel too. Automation rules that run on closure — ITSM sync, customer notifications — will run for {incident.client}.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">Classification · required by Sentinel</legend>
                <div className="space-y-1">
                  {[
                    ['True positive', 'Suspicious activity'],
                    ['Benign positive', 'Suspicious but expected'],
                    ['False positive', 'Incorrect alert logic or data'],
                    ['Undetermined', 'Not enough to decide'],
                  ].map(([c, hint]) => (
                    <label key={c} className={`flex items-center gap-2.5 px-3 py-2 rounded-[4px] border cursor-pointer transition-colors ${closeClass === c ? 'border-[#092E3F] bg-[#092E3F]/[0.03]' : 'border-[var(--stroke)] hover:border-[#2A96A8]'}`}>
                      <input type="radio" name="close-class" className="accent-[#092E3F]" checked={closeClass === c} onChange={() => setCloseClass(c)} />
                      <span className="text-sm text-[#092E3F]">{c}</span>
                      <span className="text-xs text-[#092E3F]/50">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">Comment · optional</span>
                <textarea
                  value={closeNote}
                  onChange={e => setCloseNote(e.target.value)}
                  rows={2}
                  placeholder="Why it's being closed"
                  className="w-full px-3 py-2 text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 border border-[var(--stroke)] rounded-[4px] focus:outline-none focus:border-[#2A96A8] resize-none"
                />
              </label>
            </div>
            <div className="px-5 py-3 bg-[#f8fafb] border-t border-[var(--stroke)] rounded-b-[8px] flex justify-end gap-2">
              <button onClick={() => setConfirmClose(false)} className="h-9 px-4 rounded-[8px] bg-white border border-[var(--stroke)] text-sm text-[#092E3F] hover:border-[#2A96A8] transition-colors">
                Cancel
              </button>
              <button
                disabled={!closeClass}
                onClick={() => {
                  setConfirmClose(false);
                  saveHeader('status', 'Closed', shownStatus, `Closed as ${closeClass} in Microsoft Sentinel.`);
                }}
                className="h-9 px-4 rounded-[8px] bg-[#092E3F] text-sm text-white hover:bg-[#2A96A8] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Close incident
              </button>
            </div>
          </div>
        </div>
      )}

      {showITSM && (
        <ITSMTicketSidebar
          context={{
            sourceType: 'incident',
            sourceId: incident.number,
            title: incident.title,
            severity,
            client: incident.client,
            description: ticketDescription,
            entities: incident.entities.map(e => e.name),
          }}
          onClose={() => setShowITSM(false)}
        />
      )}

      {/* Portalled: the sliding panel's transform would otherwise trap a fixed tip. */}
      {copyTip &&
        createPortal(
          <div className="fixed z-[100] pointer-events-none" style={{ left: copyTip.x + 15, top: copyTip.y + 15 }}>
            <div
              className={`px-3 py-2 rounded-[8px] shadow-lg flex items-center gap-2 text-xs text-white whitespace-nowrap transition-colors ${
                copiedEntity === copyTip.name ? 'bg-[#2A96A8] shadow-[#2A96A8]/30' : 'bg-[#092E3F] shadow-gray-900/20'
              }`}
            >
              {copiedEntity === copyTip.name ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{copyTip.name} copied to clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy to clipboard</span>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
