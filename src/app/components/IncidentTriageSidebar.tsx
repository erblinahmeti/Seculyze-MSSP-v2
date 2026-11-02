import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Users,
  Target,
  Bell,
  MessageSquare,
  Layers,
  Search,
  Play,
  Loader2,
  Check,
  Ticket,
  FileCheck,
  Calendar,
  Hash,
  Code,
} from 'lucide-react';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import imgSentinelPng from 'figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png';
import type { Indicator, TriageIncident, VerdictCheck } from './triageTestData';

// ─── Incident sidebar, AI triage test (wireframe option 6b) ──────────────────
//
// The compact layout from the Incident Sidebar Wireframes, with the fixes from
// the design review:
//
//  · One confidence number. The wireframe showed "score 0.80" on a bar and
//    "60% confidence" in a badge; with an 80% threshold the bar read as "high
//    enough to contain". Here there is a single meter with the threshold drawn
//    on it.
//  · Conclusion and "what would change this verdict" sit directly above the
//    action; evidence is supporting detail, collapsed below it.
//  · "Show all" only when it hides enough to be worth a click.
//  · One ITSM path: the toolbar button and the recommended action open the
//    same composer.

/** Up to this many indicators per side show without a "Show all". */
const INDICATORS_VISIBLE = 5;
/** When a side is longer, this many show before the toggle. */
const INDICATORS_COLLAPSED = 4;

const VERDICT_LABEL = { TruePositive: 'True positive', FalsePositive: 'False positive' } as const;
const VERDICT_STYLE = {
  TruePositive: 'bg-red-50 text-red-700 border-red-200',
  FalsePositive: 'bg-green-50 text-green-700 border-green-200',
} as const;

const SEVERITY_STYLE = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-700',
} as const;

type CheckState = { phase: 'idle' | 'running' | 'done'; showQuery: boolean };

// ─── Building blocks ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#2A96A8]" />
          <h3 className="text-base text-[#092E3F]">{title}</h3>
          {count !== undefined && (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-[#e5f2f4] text-[#1e7d8f] text-xs">{count}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#092E3F]/60" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/60" />}
      </button>
      {open && children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">{children}</p>;
}

/**
 * The single confidence number, with the automation's threshold drawn on the
 * same scale — so "60%" and "needs 80%" can't be read as two unrelated scores.
 */
function ConfidenceMeter({ confidence, threshold }: { confidence: number; threshold: number }) {
  const above = confidence >= threshold;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-[#092E3F]/60">Confidence</span>
        <span className="text-sm text-[#092E3F] tabular-nums">
          {confidence}%
        </span>
      </div>
      <div className="relative h-2 rounded-[2px] bg-[#e8eef0]">
        <div
          className={`h-full rounded-[2px] ${above ? 'bg-[#2A96A8]' : 'bg-amber-500'}`}
          style={{ width: `${confidence}%` }}
        />
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-[#092E3F]"
          style={{ left: `calc(${threshold}% - 1px)` }}
          title={`Threshold ${threshold}%`}
        />
      </div>
      <div className="relative h-4 mt-1 text-[10px] text-[#092E3F]/50 tabular-nums">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${threshold}%` }}>
          {threshold}%
        </span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}

function IndicatorList({ tone, items }: { tone: 'malicious' | 'benign'; items: Indicator[] }) {
  const [showAll, setShowAll] = useState(false);
  const collapsible = items.length > INDICATORS_VISIBLE;
  const visible = collapsible && !showAll ? items.slice(0, INDICATORS_COLLAPSED) : items;
  const hidden = items.length - INDICATORS_COLLAPSED;
  const bar = tone === 'malicious' ? 'border-l-red-400 bg-red-50/60' : 'border-l-green-500 bg-green-50/60';

  return (
    <div className="min-w-0">
      <p
        className={`text-[11px] font-medium uppercase tracking-wide mb-2 ${
          tone === 'malicious' ? 'text-red-700' : 'text-green-700'
        }`}
      >
        {tone === 'malicious' ? 'Malicious indicators' : 'Benign indicators'} · {items.length}
      </p>
      <div className="space-y-1.5">
        {visible.map((it, i) => (
          <div key={i} className={`border-l-2 rounded-[4px] px-3 py-2 ${bar}`}>
            <p className="text-sm text-[#092E3F]">{it.title}</p>
            <p className="text-xs text-[#092E3F]/65 mt-0.5 break-words">{it.text}</p>
          </div>
        ))}
      </div>
      {collapsible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-[#1e7d8f] hover:text-[#092E3F] transition-colors"
        >
          {showAll ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function CheckRow({
  check,
  state,
  onRun,
  onToggleQuery,
}: {
  check: VerdictCheck;
  state: CheckState;
  onRun: () => void;
  onToggleQuery: () => void;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#092E3F]">{check.question}</p>
          <p className="text-xs text-[#092E3F]/55 mt-0.5">{check.effect}</p>
        </div>
        <button
          onClick={onToggleQuery}
          className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-[#092E3F]/60 hover:text-[#092E3F] transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          Query
        </button>
        <button
          onClick={onRun}
          disabled={state.phase === 'running'}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--stroke)] bg-white text-xs text-[#092E3F] hover:bg-[#092E3F] hover:text-white hover:border-[#092E3F] transition-colors disabled:opacity-60 disabled:hover:bg-white disabled:hover:text-[#092E3F]"
        >
          {state.phase === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {state.phase === 'done' ? 'Run again' : state.phase === 'running' ? 'Running' : 'Run check'}
        </button>
      </div>
      {state.showQuery && (
        <pre className="mt-2 px-3 py-2 rounded-[4px] bg-[#f6f6f6] text-[11px] text-[#092E3F]/80 whitespace-pre-wrap font-mono">
          {check.query}
        </pre>
      )}
      {state.phase === 'done' && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[#092E3F]/75">
          <Check className="w-3.5 h-3.5 text-[#2A96A8] mt-px shrink-0" />
          {check.result}
        </p>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function IncidentTriageSidebar({
  incident,
  onClose,
}: {
  incident: TriageIncident;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullSummary, setFullSummary] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [showITSM, setShowITSM] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closed, setClosed] = useState(false);
  const [changelog, setChangelog] = useState(incident.changelog);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});

  const below = incident.confidence < incident.threshold;
  const checkState = (id: string): CheckState => checks[id] ?? { phase: 'idle', showQuery: false };
  const setCheck = (id: string, patch: Partial<CheckState>) =>
    setChecks(c => ({ ...c, [id]: { ...checkState(id), ...c[id], ...patch } }));

  const runCheck = (check: VerdictCheck) => {
    setCheck(check.id, { phase: 'running' });
    setTimeout(() => {
      setCheck(check.id, { phase: 'done' });
      setChangelog(l => [...l, `Check run (${check.question}): no change to verdict`]);
    }, 1400);
  };

  const closeIncident = () => {
    setConfirmClose(false);
    setClosed(true);
    const line = `Closed as ${incident.action.chips.join(' / ')} by analyst at ${incident.confidence}% confidence`;
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

  const ticketDescription = [
    `Incident ${incident.number} — ${incident.title}`,
    `Verdict: ${VERDICT_LABEL[incident.verdict]} (${incident.confidence}% confidence)`,
    '',
    incident.summaryFull,
    '',
    `Conclusion: ${incident.conclusion}`,
  ].join('\n');

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200" onClick={onClose} />

      <div
        className={`fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col ${
          expanded ? 'max-w-[95vw]' : 'max-w-3xl'
        }`}
      >
        {/* Header */}
        <div className="bg-[#092E3F] px-8 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-xl text-white">{incident.title}</h2>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-[8px] hover:bg-white/10 transition-colors"
                title={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                {expanded ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
              </button>
              <button onClick={onClose} className="p-2 rounded-[8px] hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-[4px] text-xs ${closed ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
              {closed ? 'Closed' : incident.status}
            </span>
            <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY_STYLE[incident.severity]}`}>{incident.severity}</span>
            <span className="px-2 py-0.5 rounded-[4px] text-xs bg-white/15 text-white">{incident.client}</span>
          </div>
        </div>

        {/* Toolbar. The ITSM button opens the same composer as the AI card's
            escalate action — one path to a ticket, not two. */}
        <div className="px-8 py-3 border-b border-[var(--stroke)] flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toast('Opening incident in Microsoft Sentinel…')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[4px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <img src={imgSentinelPng} alt="" className="h-4 w-auto object-contain shrink-0" />
            Open in Sentinel
          </button>
          <button
            onClick={() => toast.success('Report generated')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[4px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <FileCheck className="w-4 h-4 text-[#092E3F]/40" />
            Generate report
          </button>
          <button
            onClick={() => setShowITSM(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[4px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <Ticket className="w-4 h-4 text-[#092E3F]/40" />
            ITSM ticket
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Metadata */}
          <div className="bg-gray-50 rounded-[8px] px-5 py-4 grid grid-cols-4 gap-4">
            {[
              { icon: Hash, label: 'Incident', value: incident.number },
              { icon: Calendar, label: 'Created', value: incident.created },
              { icon: Target, label: 'Type', value: incident.type },
              { icon: AlertTriangle, label: 'Alerts', value: '1' },
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

          <Section icon={Users} title="Entities" count={incident.entities.length}>
            <div className="flex flex-wrap gap-2">
              {incident.entities.map(e => (
                <div key={e.name} className="px-3 py-2 border border-[var(--stroke)] rounded-[4px]">
                  <p className="text-sm text-[#092E3F]">{e.name}</p>
                  <p className="text-xs text-[#092E3F]/50">{e.type}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Target} title="MITRE ATT&CK Mapping" count={incident.mitre.length}>
            <div className="border border-[var(--stroke)] rounded-[4px] divide-y divide-gray-100">
              {incident.mitre.map(m => (
                <div key={m.technique} className="px-3 py-2">
                  <p className="text-sm text-[#092E3F]">{m.tactic}</p>
                  <p className="text-xs text-[#092E3F]/50">{m.technique}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Bell} title="Alerts" count={1}>
            <div className="border border-[var(--stroke)] rounded-[4px] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY_STYLE[incident.severity]}`}>{incident.severity}</span>
                <span className="text-xs text-[#092E3F]/50">{incident.alert.time}</span>
              </div>
              <p className="text-sm text-[#092E3F]">{incident.alert.title}</p>
              <p className="text-xs text-[#092E3F]/60">{incident.alert.description}</p>
            </div>
          </Section>

          {/* ── AI Analysis & Recommendations ── */}
          <div className="border-t-2 border-[#2A96A8] pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#2A96A8]" />
              <h3 className="text-lg text-[#092E3F]">AI Analysis & Recommendations</h3>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-[4px]">Complete</span>
            </div>

            <div className="border border-[var(--stroke)] rounded-[8px] divide-y divide-[var(--stroke)]">
              {/* 1. Verdict and how sure */}
              <div className="px-5 py-4">
                <Label>Triage assessment</Label>
                <div className="flex items-start gap-5">
                  <span className={`shrink-0 mt-4 px-2.5 py-1 rounded-[4px] border text-sm ${VERDICT_STYLE[incident.verdict]}`}>
                    {VERDICT_LABEL[incident.verdict]}
                  </span>
                  <ConfidenceMeter confidence={incident.confidence} threshold={incident.threshold} />
                </div>
              </div>

              {/* 2. Why, in two sentences */}
              <div className="px-5 py-4">
                <Label>Executive summary</Label>
                <p className="text-sm text-[#092E3F] leading-relaxed">
                  {fullSummary ? incident.summaryFull : incident.summary}
                </p>
                <button
                  onClick={() => setFullSummary(!fullSummary)}
                  className="mt-1.5 text-xs text-[#1e7d8f] hover:text-[#092E3F] transition-colors"
                >
                  {fullSummary ? 'Show short summary' : 'Read full summary'}
                </button>
              </div>

              {/* 3. The signals, both sides */}
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                <IndicatorList tone="malicious" items={incident.malicious} />
                <IndicatorList tone="benign" items={incident.benign} />
              </div>

              {/* 4. Conclusion — what justifies the action, so it sits right above it */}
              <div className="px-5 py-4">
                <Label>Conclusion</Label>
                <p className="text-sm text-[#092E3F] leading-relaxed">{incident.conclusion}</p>
              </div>

              {/* 5. What would change the verdict, each runnable */}
              <div className="px-5 py-4">
                <Label>What would change this verdict</Label>
                <div className="border border-[var(--stroke)] rounded-[4px] divide-y divide-gray-100">
                  {incident.checks.map(c => (
                    <CheckRow
                      key={c.id}
                      check={c}
                      state={checkState(c.id)}
                      onRun={() => runCheck(c)}
                      onToggleQuery={() => setCheck(c.id, { showQuery: !checkState(c.id).showQuery })}
                    />
                  ))}
                </div>
              </div>

              {/* 6. The action */}
              <div className="px-5 py-4 bg-[#fafbfb]">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-[#092E3F]">{incident.action.label}</p>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                    {incident.action.chips.map(chip => (
                      <span key={chip} className="px-2 py-0.5 rounded-[4px] border border-[var(--stroke)] bg-white text-xs text-[#092E3F]/70">
                        {chip}
                      </span>
                    ))}
                  </div>
                  {incident.action.kind === 'itsm' ? (
                    <button
                      onClick={() => setShowITSM(true)}
                      className="shrink-0 px-4 py-1.5 bg-[#092E3F] text-white rounded-[4px] text-sm hover:bg-[#2A96A8] transition-colors"
                    >
                      Create ticket
                    </button>
                  ) : closed ? (
                    <span className="shrink-0 flex items-center gap-1.5 text-sm text-[#2A96A8]">
                      <Check className="w-4 h-4" /> Closed
                    </span>
                  ) : (
                    <button
                      onClick={() => (below ? setConfirmClose(true) : closeIncident())}
                      className="shrink-0 px-4 py-1.5 bg-[#092E3F] text-white rounded-[4px] text-sm hover:bg-[#2A96A8] transition-colors"
                    >
                      Close incident
                    </button>
                  )}
                </div>

                {confirmClose && (
                  <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-[4px] border border-[var(--stroke)] bg-white">
                    <p className="flex-1 text-xs text-[#092E3F]">
                      Close as <span className="font-medium">{incident.action.chips.join(' / ')}</span>? You are confirming a verdict
                      the automation would not close on its own.
                    </p>
                    <button
                      onClick={() => setConfirmClose(false)}
                      className="px-3 py-1 rounded-[4px] border border-[var(--stroke)] text-xs text-[#092E3F] hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={closeIncident}
                      className="px-3 py-1 rounded-[4px] bg-[#092E3F] text-white text-xs hover:bg-[#2A96A8]"
                    >
                      Confirm close
                    </button>
                  </div>
                )}
              </div>

              {/* 7. Evidence — supporting detail, one toggle for the whole list */}
              <div>
                <button
                  onClick={() => setEvidenceOpen(!evidenceOpen)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#fafbfb] transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm text-[#092E3F]">
                    <Search className="w-4 h-4 text-[#092E3F]/50" />
                    Evidence collected
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-[#e5f2f4] text-[#1e7d8f] text-xs">{incident.evidence.length}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#1e7d8f]">
                    {evidenceOpen ? 'Collapse' : 'Expand'}
                    {evidenceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {evidenceOpen && (
                  <div className="px-5 pb-4 space-y-1.5">
                    {incident.evidence.map((e, i) => (
                      <div key={i} className="flex gap-2 px-3 py-2 border border-[var(--stroke)] rounded-[4px] text-sm text-[#092E3F]/85">
                        <span className="text-[#092E3F]/35">•</span>
                        <span>{e}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 8. What has happened so far */}
              <div className="px-5 py-3">
                <Label>Changelog</Label>
                <ol className="space-y-1">
                  {changelog.map((line, i) => (
                    <li key={i} className="flex gap-3 text-xs text-[#092E3F]/75">
                      <span className="font-mono text-[#092E3F]/40">{String(i + 1).padStart(2, '0')}</span>
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <Section icon={MessageSquare} title="Comments & Notes" count={0} defaultOpen={false}>
            <textarea
              placeholder="Add a comment or note…"
              className="w-full h-20 px-3 py-2 border border-[var(--stroke)] rounded-[4px] text-sm text-[#092E3F] resize-none focus:outline-none focus:border-[#2A96A8]"
            />
          </Section>

          <Section icon={Layers} title="Similar Incidents" count={incident.similar.total}>
            <p className="text-sm text-[#092E3F] mb-2">
              {incident.similar.sameVerdict} of {incident.similar.total} similar incidents were closed as{' '}
              {VERDICT_LABEL[incident.verdict].toLowerCase()}.
            </p>
            <div className="h-1.5 rounded-[2px] bg-[#e8eef0] overflow-hidden">
              <div
                className={incident.verdict === 'TruePositive' ? 'h-full bg-red-400' : 'h-full bg-green-500'}
                style={{ width: `${(incident.similar.sameVerdict / incident.similar.total) * 100}%` }}
              />
            </div>
          </Section>
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
