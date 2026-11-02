import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import EvidenceList, { evidenceTally } from './EvidenceList';
import imgSentinelPng from 'figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png';
import type { Analysis, Finding, Metric, RedesignIncident, Recommendation, Verdict } from './triageRedesignData';

// ─── Incident panel, decision-first (AI Triage B) ────────────────────────────
//
// The first triage sidebar laid out what the agent produced, in the order it
// produced it. This one is ordered by the questions an analyst answers:
//
//   header          what is it, how severe, who is affected        (always)
//   AI assessment   what does the AI think, how sure, what is known  (L1)
//   recommendation  what to do, why, what pressing the button does   (L1)
//   key findings    the 3 findings that matter, rest on demand       (L1 → L2)
//   details         entities, MITRE, alerts, evidence, changelog     (L2)
//
// The old Executive summary and Conclusion said the same thing twice; their
// content is split between the assessment (what is and isn't known) and the
// recommendation (what to do and why), and the Conclusion is gone.
//
// Severity, verdict and confidence are three different things and are labelled
// as such: severity comes from the alert rule, the verdict and its confidence
// from the AI. Nothing here presents the verdict as fact.

const VERDICT: Record<Verdict, { label: string; icon: typeof ShieldAlert; cls: string }> = {
  TruePositive: { label: 'True positive', icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-200' },
  FalsePositive: { label: 'False positive', icon: ShieldCheck, cls: 'bg-green-50 text-green-700 border-green-200' },
  Undetermined: { label: 'Undetermined', icon: HelpCircle, cls: 'bg-gray-100 text-[#092E3F] border-gray-200' },
};

const SEVERITY = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-700',
} as const;

const TONE = {
  suspicious: { icon: AlertTriangle, text: 'text-red-700', iconCls: 'text-red-600', bar: 'border-l-red-400' },
  benign: { icon: CheckCircle2, text: 'text-green-700', iconCls: 'text-green-600', bar: 'border-l-green-500' },
  neutral: { icon: Info, text: 'text-[#092E3F]', iconCls: 'text-[#092E3F]/50', bar: 'border-l-gray-300' },
} as const;

const ACTION_KIND: Record<Recommendation['kind'], string> = {
  escalate: 'Escalate',
  investigate: 'Investigate',
  dismiss: 'Dismiss',
};

/** How long the simulated analysis takes. */
const ANALYSIS_MS = 2400;

type Phase = 'none' | 'running' | 'error' | 'done';

// ─── Building blocks ─────────────────────────────────────────────────────────

function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium uppercase tracking-wide text-[#6b828c] ${className}`}>{children}</p>;
}

function Btn({
  primary,
  onClick,
  children,
  disabled,
}: {
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
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
        <div
          className={`h-full rounded-[2px] ${confidence >= threshold ? 'bg-[#2A96A8]' : 'bg-amber-500'}`}
          style={{ width: `${confidence}%` }}
        />
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

function MetricTile({ m }: { m: Metric }) {
  const t = TONE[m.tone];
  return (
    <div className={`border-l-2 ${t.bar} pl-3 py-0.5 min-w-0`}>
      <p className={`flex items-center gap-1.5 text-xl tabular-nums ${t.text}`}>
        <t.icon className={`w-4 h-4 shrink-0 ${t.iconCls}`} aria-hidden />
        {m.value}
      </p>
      <p className="text-xs text-[#092E3F]/65 leading-snug">{m.label}</p>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const t = TONE[f.tone];
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-[#fafbfb] transition-colors">
        <t.icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.iconCls}`} aria-label={f.tone === 'suspicious' ? 'Suspicious' : 'Benign'} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-[#092E3F]">{f.title}</span>
          <span className="block text-xs text-[#092E3F]/60">{f.line}</span>
        </span>
        <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-[#092E3F]/35 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="mx-3 mb-2 ml-9 px-3 py-2 rounded-[4px] bg-[#f6f6f6] text-xs text-[#092E3F]/80 leading-relaxed">{f.detail}</p>
      )}
    </div>
  );
}

/** A secondary section: one quiet row with a count and a preview, closed by default. */
function Detail({ title, count, preview, children }: { title: string; count?: number; preview?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#fafbfb] transition-colors">
        <ChevronRight className={`w-4 h-4 shrink-0 text-[#092E3F]/40 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="text-sm text-[#092E3F]">{title}</span>
        {count !== undefined && <span className="px-1.5 rounded-[4px] bg-[#eef2f3] text-xs text-[#092E3F]/70 tabular-nums">{count}</span>}
        {preview && !open && <span className="flex-1 min-w-0 truncate text-right text-xs text-[#092E3F]/45">{preview}</span>}
      </button>
      {open && <div className="px-3 pb-3 pl-9">{children}</div>}
    </div>
  );
}

// ─── AI assessment states ────────────────────────────────────────────────────

function NotAnalysed({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-[8px] border border-[#2A96A8]/30 bg-[#e5f2f4]/50">
      <Sparkles className="w-4 h-4 text-[#1e7d8f] mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-[#092E3F]">Not analysed yet</p>
        <p className="text-xs text-[#092E3F]/60 mt-0.5">
          Resolve reviews the sign-ins, threat intel and similar incidents, then recommends an action. Typically 4–10 min.
        </p>
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
        <div className="grid grid-cols-3 gap-4">
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
          <div className="h-10 rounded-[4px] bg-[#eef2f3]" />
        </div>
        <div className="h-3 w-full rounded-[4px] bg-[#eef2f3]" />
        <div className="h-3 w-4/5 rounded-[4px] bg-[#eef2f3]" />
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
        <p className="text-xs text-[#092E3F]/65 mt-0.5">{message} No verdict was produced, so treat this incident as untriaged.</p>
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

function Assessment({ a }: { a: Analysis }) {
  const v = VERDICT[a.verdict];
  return (
    <section className="rounded-[8px] border border-[var(--stroke)]">
      <div className="px-4 pt-3.5 pb-3 flex items-start gap-8">
        <div>
          <Eyebrow className="mb-1.5">AI verdict</Eyebrow>
          <span className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border text-sm ${v.cls}`}>
            <v.icon className="w-4 h-4" /> {v.label}
          </span>
        </div>
        {/* Confidence mirrors the verdict column: label on top, then one row
            the same height as the verdict badge — the number, then the bar
            beside it — so the two read as a pair. */}
        <div className="w-72">
          <div className="flex items-center gap-1 mb-1.5">
            <Eyebrow>AI confidence</Eyebrow>
            {/* A button, not a bare icon, so the explanation is reachable by keyboard too. */}
            <span className="relative group flex">
              <button
                type="button"
                aria-label="About AI confidence"
                className="text-[#092E3F]/40 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <span
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-60 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-10 pointer-events-none"
              >
                AI-generated. Confidence is how sure the model is of this verdict, not how severe the incident is.
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 h-8">
            <span className="text-xl text-[#092E3F] tabular-nums leading-none w-12">{a.confidence}%</span>
            {/* The top padding matches the threshold label's height below the
                bar, so the bar itself — not bar plus label — is centred on the number. */}
            <div className="flex-1 pt-4">
              <ConfidenceMeter confidence={a.confidence} threshold={a.threshold} />
            </div>
          </div>
        </div>
      </div>

      {a.gaps && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-[4px] bg-amber-50 border border-amber-200">
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

      <div className="px-4 py-3 grid grid-cols-3 gap-4 border-t border-[var(--stroke)]">
        {a.metrics.map(m => (
          <MetricTile key={m.label} m={m} />
        ))}
      </div>

      <dl className="px-4 py-3 border-t border-[var(--stroke)] grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-xs text-[#6b828c] pt-0.5">What happened</dt>
        <dd className="text-[#092E3F]">{a.happened}</dd>
        <dt className="text-xs text-[#6b828c] pt-0.5">Evidence supports</dt>
        <dd className="text-[#092E3F]">{a.supports}</dd>
        <dt className="text-xs text-[#6b828c] pt-0.5">Not confirmed</dt>
        <dd className="text-[#092E3F]">{a.unconfirmed}</dd>
      </dl>
    </section>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function IncidentTriageSidebarV2({ incident, onClose }: { incident: RedesignIncident; onClose: () => void }) {
  const a = incident.analysis;
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<Phase>(incident.analysisState);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [showITSM, setShowITSM] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closed, setClosed] = useState(false);
  const [changelog, setChangelog] = useState(a.changelog);

  const rec = a.recommendation;
  const below = a.confidence < a.threshold;
  const suspicious = a.findings.filter(f => f.tone === 'suspicious');
  const benign = a.findings.filter(f => f.tone === 'benign');
  const keyFindings = a.findings.filter(f => f.key);
  const [first, ...more] = incident.entities;

  const runAnalysis = () => {
    setPhase('running');
    setTimeout(() => setPhase('done'), ANALYSIS_MS);
  };

  const openSentinel = () => toast('Opening incident in Microsoft Sentinel…');

  const closeIncident = () => {
    setConfirmClose(false);
    setClosed(true);
    const line = `Closed as ${rec.closeAs?.join(' / ')} by analyst at ${a.confidence}% confidence`;
    setChangelog(l => [...l, line]);
    toast.success(`Incident ${incident.number} closed`, {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          setClosed(false);
          setChangelog(l => l.filter(x => x !== line));
        },
      },
    });
  };

  const primaryAction = () => {
    if (rec.kind === 'escalate') return setShowITSM(true);
    if (rec.kind === 'investigate') return openSentinel();
    return below ? setConfirmClose(true) : closeIncident();
  };
  const primaryLabel = { escalate: 'Create ITSM ticket', investigate: 'Open in Sentinel', dismiss: 'Close as false positive' }[rec.kind];
  const PrimaryIcon = { escalate: Ticket, investigate: ExternalLink, dismiss: Check }[rec.kind];

  const analysed = phase === 'done';
  const ticketDescription = [
    `Incident ${incident.number} — ${incident.title}`,
    analysed ? `AI verdict: ${VERDICT[a.verdict].label} (${a.confidence}% confidence)` : 'Not analysed by AI',
    '',
    ...(analysed
      ? [`What happened: ${a.happened}`, `Evidence supports: ${a.supports}`, `Not confirmed: ${a.unconfirmed}`, '', `Recommended: ${rec.title}. ${rec.why}`]
      : []),
  ].join('\n');

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200" onClick={onClose} />

      <div
        className={`fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col ${
          expanded ? 'max-w-[95vw]' : 'max-w-3xl'
        }`}
      >
        {/* ── Header: what, how severe, who — and the actions that apply to any incident ── */}
        <header className="bg-[#092E3F] px-6 pt-3.5 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-white/60 tabular-nums">
              #{incident.number} · {incident.type} · {incident.created} · {incident.client}
            </p>
            <div className="flex items-center gap-0.5 -mr-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-[4px] hover:bg-white/10"
                title={expanded ? 'Collapse panel' : 'Expand panel'}
              >
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
            <span className={`px-2 py-0.5 rounded-[4px] text-xs ${closed ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
              {closed ? 'Closed' : incident.status}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs bg-white/10 text-white max-w-[260px]"
              title={incident.entities.map(e => `${e.type}: ${e.name}`).join('\n')}
            >
              <User className="w-3.5 h-3.5 shrink-0 text-white/70" />
              <span className="truncate">{first.name}</span>
              {more.length > 0 && <span className="text-white/60">+{more.length}</span>}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={openSentinel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10"
              >
                <img src={imgSentinelPng} alt="" className="h-3.5 w-auto" /> Sentinel
              </button>
              <button
                onClick={() => toast.success('Report generated')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10"
              >
                <FileCheck className="w-3.5 h-3.5 text-white/70" /> Report
              </button>
              <button
                onClick={() => setShowITSM(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-white/20 text-xs text-white hover:bg-white/10"
              >
                <Ticket className="w-3.5 h-3.5 text-white/70" /> ITSM
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* ── A. AI assessment ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#2A96A8]" />
              <h3 className="text-sm text-[#092E3F]">AI triage assessment</h3>
            </div>
            {phase === 'none' && <NotAnalysed onRun={runAnalysis} />}
            {phase === 'running' && <Analysing />}
            {phase === 'error' && <AnalysisFailed message={incident.error ?? ''} onRetry={runAnalysis} onSentinel={openSentinel} />}
            {analysed && <Assessment a={a} />}
          </div>

          {analysed && (
            <>
              {/* ── B. Recommended action ── */}
              <section className="rounded-[8px] border border-[var(--stroke)] border-l-[3px] border-l-[#2A96A8] bg-[#f6fafb]">
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <Eyebrow>Recommended action</Eyebrow>
                    <span className="px-1.5 rounded-[4px] bg-white border border-[var(--stroke)] text-[11px] text-[#092E3F]/70">
                      {ACTION_KIND[rec.kind]}
                    </span>
                  </div>
                  <p className="mt-1 text-base text-[#092E3F]">{rec.title}</p>
                  <p className="mt-1 text-sm text-[#092E3F]/80 leading-relaxed">{rec.why}</p>
                  <p className="mt-1.5 text-xs text-[#092E3F]/55">
                    <span className="text-[#092E3F]/70">What it does:</span> {rec.effect}
                  </p>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {rec.kind === 'dismiss' && closed ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[#1e7d8f]">
                        <Check className="w-4 h-4" /> Closed as {rec.closeAs?.join(' / ')}
                      </span>
                    ) : (
                      <Btn primary onClick={primaryAction}>
                        <PrimaryIcon className="w-4 h-4" /> {primaryLabel}
                      </Btn>
                    )}
                  </div>

                  {confirmClose && (
                    <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-[4px] border border-[var(--stroke)] bg-white">
                      <p className="flex-1 text-xs text-[#092E3F]">
                        Close as <span className="font-medium">{rec.closeAs?.join(' / ')}</span>? You are confirming a verdict the
                        automation would not close on its own.
                      </p>
                      <Btn onClick={() => setConfirmClose(false)}>Cancel</Btn>
                      <Btn primary onClick={closeIncident}>
                        Confirm close
                      </Btn>
                    </div>
                  )}
                </div>

              </section>

              {/* ── C. Key findings, the rest on demand ── */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm text-[#092E3F]">Key findings</h3>
                  <p className="text-xs text-[#092E3F]/55 tabular-nums">
                    <span className="text-red-700">{suspicious.length} suspicious</span> ·{' '}
                    <span className="text-green-700">{benign.length} benign</span>
                  </p>
                </div>

                <div className="rounded-[8px] border border-[var(--stroke)]">
                  {showAllFindings ? (
                    [
                      { label: 'Suspicious', items: suspicious },
                      { label: 'Benign / context', items: benign },
                    ]
                      .filter(g => g.items.length)
                      .map(g => (
                        <div key={g.label} className="border-b border-[var(--stroke)] last:border-b-0">
                          <Eyebrow className="px-3 pt-2.5 pb-1">
                            {g.label} · {g.items.length}
                          </Eyebrow>
                          <div className="divide-y divide-gray-100">
                            {g.items.map(f => (
                              <FindingRow key={f.title} f={f} />
                            ))}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {keyFindings.map(f => (
                        <FindingRow key={f.title} f={f} />
                      ))}
                    </div>
                  )}
                  {a.findings.length > keyFindings.length && (
                    <button
                      onClick={() => setShowAllFindings(!showAllFindings)}
                      className="w-full px-3 py-2 border-t border-[var(--stroke)] text-left text-xs text-[#1e7d8f] hover:bg-[#fafbfb]"
                    >
                      {showAllFindings ? 'Show key findings only' : `Show all ${a.findings.length} findings`}
                    </button>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── D. Investigation details ── */}
          <section>
            <h3 className="text-sm text-[#092E3F] mb-2">Investigation details</h3>
            <div className="rounded-[8px] border border-[var(--stroke)] divide-y divide-gray-100">
              <Detail title="Entities" count={incident.entities.length} preview={incident.entities.map(e => e.name).join(', ')}>
                <div className="space-y-1">
                  {incident.entities.map(e => (
                    <p key={e.name} className="text-sm text-[#092E3F]">
                      {e.name} <span className="text-xs text-[#092E3F]/50">· {e.type}</span>
                    </p>
                  ))}
                </div>
              </Detail>
              <Detail title="MITRE ATT&CK" count={incident.mitre.length} preview={incident.mitre.map(m => m.technique.split(' ')[0]).join(', ')}>
                <div className="space-y-1">
                  {incident.mitre.map(m => (
                    <p key={m.technique} className="text-sm text-[#092E3F]">
                      {m.technique} <span className="text-xs text-[#092E3F]/50">· {m.tactic}</span>
                    </p>
                  ))}
                </div>
              </Detail>
              <Detail title="Alerts" count={1} preview={incident.alert.time}>
                <p className="text-sm text-[#092E3F]">{incident.alert.title}</p>
                <p className="text-xs text-[#092E3F]/60">{incident.alert.description}</p>
              </Detail>
              {analysed && (
                <Detail title="Evidence collected" count={a.evidence.length} preview={evidenceTally(a.evidence)}>
                  <EvidenceList items={a.evidence} />
                </Detail>
              )}
              {analysed && (
                <Detail title="Changelog" count={changelog.length} preview={changelog[changelog.length - 1]}>
                  <ol className="space-y-1">
                    {changelog.map((line, i) => (
                      <li key={i} className="flex gap-3 text-xs text-[#092E3F]/75">
                        <span className="font-mono text-[#092E3F]/40">{String(i + 1).padStart(2, '0')}</span>
                        {line}
                      </li>
                    ))}
                  </ol>
                </Detail>
              )}
              <Detail
                title="Similar incidents"
                count={incident.similar.total}
                preview={`${incident.similar.sameVerdict} of ${incident.similar.total} closed with the same verdict`}
              >
                <p className="text-sm text-[#092E3F]">
                  {incident.similar.sameVerdict} of {incident.similar.total} similar incidents were closed with the same verdict.
                </p>
              </Detail>
              <Detail title="Comments & notes" count={0}>
                <textarea
                  placeholder="Add a comment or note…"
                  className="w-full h-20 px-3 py-2 border border-[var(--stroke)] rounded-[4px] text-sm text-[#092E3F] resize-none focus:outline-none focus:border-[#2A96A8]"
                />
              </Detail>
            </div>
          </section>
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
