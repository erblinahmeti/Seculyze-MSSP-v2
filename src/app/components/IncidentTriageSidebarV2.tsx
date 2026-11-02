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
  ArrowRight,
  TextSearch,
  ChevronUp,
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
} from 'lucide-react';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import EvidenceText from './EvidenceText';
import InvestigationEvidence, { investigationPreview, queriesRun, type QueryFocus } from './InvestigationEvidence';
import imgSentinelPng from 'figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png';
import type { Analysis, Finding, InvestigationQuery, Metric, RedesignIncident, Recommendation, Verdict } from './triageRedesignData';

// ─── Incident panel, decision-first (AI Triage B) ────────────────────────────
//
// The first triage sidebar laid out what the agent produced, in the order it
// produced it. This one is ordered by the questions an analyst answers:
//
//   header          what is it, how severe, who is affected        (always)
//   AI assessment   what does the AI think, how sure, what is known  (L1)
//   recommendation  what to do, why, what pressing the button does   (L1)
//   key findings    the 3 findings that matter, rest on demand       (L1 → L2)
//   evidence        the queries behind the findings, and changelog   (L2)
//
// All of that sits in one AI Analysis & Recommendations section. Entities,
// MITRE, alerts, comments and similar incidents follow it, as on Incidents (A).
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
  inconclusive: { icon: HelpCircle, text: 'text-amber-800', iconCls: 'text-amber-600', bar: 'border-l-amber-400' },
} as const;

const FINDING_LABEL: Record<Finding['tone'], string> = {
  suspicious: 'Suspicious',
  benign: 'Benign / context',
  inconclusive: 'Inconclusive',
};

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

function FindingRow({ f, supporting, onGo }: { f: Finding; supporting: InvestigationQuery[]; onGo: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = TONE[f.tone];
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-[#fafbfb] transition-colors">
        <t.icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.iconCls}`} aria-label={FINDING_LABEL[f.tone]} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-[#092E3F]">{f.title}</span>
          <span className="block text-xs text-[#092E3F]/60">
            <EvidenceText text={f.line} />
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-[#092E3F]/35 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Expanded: what it means for the verdict first, then the agent's own
          indicator for anyone who wants to check the wording. */}
      {open && (
        <div className="mx-3 mb-2.5 ml-9 space-y-2">
          <p className="text-sm text-[#092E3F]/85 leading-relaxed">{f.why}</p>
          <div className="px-3 py-2 rounded-[4px] bg-[#f6f6f6]">
            <Eyebrow className="mb-0.5">AI indicator</Eyebrow>
            <p className="text-xs text-[#092E3F]/80 leading-relaxed">
              <EvidenceText text={f.detail} />
            </p>
          </div>
          {/* Finding → the checks behind it → their results, one click each. */}
          {supporting.length > 0 && (
            <div>
              <Eyebrow className="mb-1">Supporting evidence</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {supporting.map(q => (
                  <button
                    key={q.id}
                    onClick={() => onGo(q.id)}
                    title={`Show ${q.title} in Investigation evidence`}
                    className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] border border-[var(--stroke)] bg-white text-left hover:border-[#2A96A8] transition-colors"
                  >
                    <TextSearch className="w-3.5 h-3.5 shrink-0 text-[#2A96A8]" aria-hidden />
                    <code className="font-mono text-[11px] text-[#092E3F]">{q.id}</code>
                    <span className="text-[11px] text-[#092E3F]/50 tabular-nums">
                      {q.status === 'completed' ? `${(q.rows ?? 0).toLocaleString()} ${q.rows === 1 ? 'row' : 'rows'}` : q.status}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#092E3F]/35 group-hover:text-[#2A96A8]" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A secondary section: one quiet row with a count and a preview, closed by default. */
function Detail({
  title,
  count,
  preview,
  open: controlled,
  onOpenChange,
  children,
}: {
  title: string;
  count?: number;
  preview?: string;
  /** Pass to open the row from elsewhere, e.g. a key finding's evidence link. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOwn(v));
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

// ─── Secondary sections, as on Incidents (A) ─────────────────────────────────
//
// Entities, MITRE, alerts, comments and similar incidents keep the look and
// behaviour they have in the main incident sidebar, so this page differs only
// where the AI analysis does.

type SectionKey = 'analysis' | 'entities' | 'mitre' | 'alerts' | 'comments' | 'similar';

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
function similarRows(incident: RedesignIncident) {
  const { total, sameVerdict } = incident.similar;
  const verdict = incident.analysis.verdict;
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
  const a = incident.analysis;
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<Phase>(incident.analysisState);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [showITSM, setShowITSM] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closed, setClosed] = useState(false);
  const [changelog, setChangelog] = useState(a.changelog);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [focus, setFocus] = useState<QueryFocus | null>(null);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    analysis: true,
    entities: true,
    mitre: true,
    alerts: true,
    comments: true,
    similar: true,
  });
  const toggle = (k: SectionKey) => setSections(s => ({ ...s, [k]: !s[k] }));
  const [copiedEntity, setCopiedEntity] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ id: number; user: string; role: string; timestamp: string; content: string }[]>([]);

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

  const queryById = new Map((a.queries ?? []).map(q => [q.id, q]));
  const supportingFor = (f: Finding) => (f.queryIds ?? []).map(id => queryById.get(id)!).filter(Boolean);
  // Open Investigation evidence and hand it the query to reveal.
  const goToQuery = (id: string) => {
    setEvidenceOpen(true);
    setFocus(prev => ({ id, n: (prev?.n ?? 0) + 1 }));
  };

  const rec = a.recommendation;
  const below = a.confidence < a.threshold;
  const findingGroups = (['suspicious', 'inconclusive', 'benign'] as const)
    .map(tone => ({ tone, items: a.findings.filter(f => f.tone === tone) }))
    .filter(g => g.items.length);
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── AI Analysis & Recommendations: assessment, action, findings,
              the evidence behind them, and what has been done ── */}
          <div>
            <SectionHeader
              icon={Sparkles}
              iconCls="text-[#2A96A8]"
              title="AI Analysis & Recommendations"
              badge={analysed && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-[4px]">Complete</span>}
              open={sections.analysis}
              onToggle={() => toggle('analysis')}
            />
            {sections.analysis && (
              <div className="space-y-5">
                {phase === 'none' && <NotAnalysed onRun={runAnalysis} />}
                {phase === 'running' && <Analysing />}
                {phase === 'error' && <AnalysisFailed message={incident.error ?? ''} onRetry={runAnalysis} onSentinel={openSentinel} />}
                {analysed && <Assessment a={a} />}

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
                  <p className="flex items-center gap-3 text-xs text-[#092E3F]/65 tabular-nums">
                    {findingGroups.map(g => {
                      const t = TONE[g.tone];
                      return (
                        <span key={g.tone} className="inline-flex items-center gap-1">
                          <t.icon className={`w-3.5 h-3.5 ${t.iconCls}`} aria-hidden />
                          {g.items.length} {g.tone}
                        </span>
                      );
                    })}
                  </p>
                </div>

                <div className="rounded-[8px] border border-[var(--stroke)]">
                  {showAllFindings ? (
                    findingGroups.map(g => (
                        <div key={g.tone} className="border-b border-[var(--stroke)] last:border-b-0">
                          <Eyebrow className="px-3 pt-2.5 pb-1">
                            {FINDING_LABEL[g.tone]} · {g.items.length}
                          </Eyebrow>
                          <div className="divide-y divide-gray-100">
                            {g.items.map(f => (
                              <FindingRow key={f.title} f={f} supporting={supportingFor(f)} onGo={goToQuery} />
                            ))}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {keyFindings.map(f => (
                        <FindingRow key={f.title} f={f} supporting={supportingFor(f)} onGo={goToQuery} />
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

              {/* ── Investigation evidence: the checks behind the findings ── */}
              <section className="rounded-[8px] border border-[var(--stroke)]">
                <Detail
                  title="Investigation evidence"
                  count={queriesRun(a)}
                  open={evidenceOpen}
                  onOpenChange={v => {
                    setEvidenceOpen(v);
                    if (!v) setFocus(null);
                  }}
                  preview={investigationPreview(a)}
                >
                  <InvestigationEvidence analysis={a} focus={focus} />
                </Detail>
              </section>

              {/* ── What has been done, and when ── */}
              <div className="px-4 py-3 bg-[#fbfcfc] border border-[var(--stroke)] rounded-[8px]">
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
                  </>
                )}
              </div>
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
                    <div
                      key={entity.name}
                      className="flex items-center gap-2 p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#092E3F] truncate">{entity.name}</p>
                        <p className="text-xs text-[#092E3F]/50">{entity.type}</p>
                      </div>
                      <button
                        onClick={() => copyEntity(entity.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-[4px]"
                        title="Copy entity"
                      >
                        {copiedEntity === entity.name ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#092E3F]/60" />
                        )}
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
                    <div
                      key={m.technique}
                      className="flex items-center justify-between p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-[#092E3F] text-white text-xs rounded-[4px] font-mono">{id}</span>
                        <div>
                          <p className="text-sm text-[#092E3F]">{name.join(' ')}</p>
                          <p className="text-xs text-[#092E3F]/60">{m.tactic}</p>
                        </div>
                      </div>
                      <a
                        href={`https://attack.mitre.org/techniques/${id.replace('.', '/')}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4 text-[#2A96A8]" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Alerts ── */}
          <div>
            <SectionHeader
              icon={AlertTriangle}
              title="Alerts"
              badge={<span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-[4px]">1</span>}
              open={sections.alerts}
              onToggle={() => toggle('alerts')}
            />
            {sections.alerts && (
              <div className="p-4 bg-white border border-[var(--stroke)] rounded-[8px] hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#092E3F]/60">ALT-{incident.number}</span>
                    <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY[incident.severity]}`}>{incident.severity}</span>
                  </div>
                  <span className="text-xs text-[#092E3F]/50">{incident.alert.time}</span>
                </div>
                <h4 className="text-sm text-[#092E3F] mb-1">{incident.alert.title}</h4>
                <p className="text-xs text-[#092E3F]/60 mb-2">{incident.alert.description}</p>
                <p className="text-xs text-[#2A96A8]">Microsoft Sentinel</p>
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
                const verdict = a.verdict;
                const counts: [Verdict, number][] = [
                  [verdict, sameVerdict],
                  ['Undetermined', total - sameVerdict],
                ].filter(([, n]) => n > 0) as [Verdict, number][];
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-[8px]">
                      <p className="text-[11px] font-medium text-[#092E3F]/50 uppercase tracking-wide mb-2">How they were resolved</p>
                      <p className="text-sm text-[#092E3F]">
                        <span className="font-medium">
                          {sameVerdict} of {total}
                        </span>{' '}
                        were classified <span className="font-medium">{VERDICT[verdict].label}</span>
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
                        {similarRows(incident).map(it => (
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
