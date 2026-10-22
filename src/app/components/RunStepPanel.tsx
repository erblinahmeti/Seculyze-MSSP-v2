import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import SidePanel from './SidePanel';
import { ACTION_BY_ID } from './flowRegister';
import { stepIo } from './runStepIo';
import {
  STEP_LABEL, fmtClock, fmtDuration, stepName, triggerName,
  type FlowRun, type RunStep,
} from './flowRuns';

// ─── one step, opened ────────────────────────────────────────────────────────
//
// The run timeline says what each step did and how long it took. This says
// what it was asked to do and what came back — the query text, the directory,
// the playbook and its parameters on one side; the response, verbatim, on the
// other.
//
// That is the difference between a log you report from and a log you
// troubleshoot from. "Revoke session failed" is not actionable. "Graph
// returned 403 — the app registration is missing Directory.AccessAsUser.All",
// next to the exact call that got it, is.
//
// Labelled pairs first, because a person reads those; raw underneath, because
// a person comparing against the connector's own documentation needs the wire
// format and nothing helpful done to it.

const TONE: Record<string, string> = {
  succeeded: 'bg-[#e3f0e8] text-[#2f7d52]',
  failed: 'bg-[#f7e6e4] text-[#c2453d]',
  skipped: 'bg-[#eef1f3] text-[#5c707a]',
  'awaiting-approval': 'bg-[#f7efdf] text-[#c07d1e]',
  cancelled: 'bg-[#eef1f3] text-[#5c707a]',
};

export default function RunStepPanel({ run, step, onClose }: {
  run: FlowRun;
  step: RunStep | null;
  onClose: () => void;
}) {
  if (!step) return null;
  const d = ACTION_BY_ID[step.action];

  return (
    <SidePanel
      id="run-step"
      open
      onClose={onClose}
      width={520}
      header={
        <>
          <p className="text-sm font-medium text-white truncate">{stepName(step)}</p>
          <p className="text-xs text-white/60 truncate">{d.system}</p>
        </>
      }
    >
      <StepIoBody run={run} step={step} className="p-5" />
    </SidePanel>
  );
}

/**
 * Inputs, outputs and properties. Lives in a panel beside the run on the audit
 * page, where there is room for one, and inside the row in the flow's own log
 * drawer, where a second panel would simply cover the first and lose the line
 * you had just pressed.
 */
export function StepIoBody({ run, step, className = '' }: {
  run: FlowRun; step: RunStep; className?: string;
}) {
  const [rawIn, setRawIn] = useState(false);
  const [rawOut, setRawOut] = useState(false);
  const io = stepIo(run, step);

  return (
    <div className={`space-y-5 ${className}`}>

        {/* ── the call ─────────────────────────────────────────────────── */}
        <Section
          title="Inputs"
          raw={rawIn}
          onToggleRaw={() => setRawIn(v => !v)}
          rawText={io.rawInputs}
        >
          <div className="space-y-2.5">
            {io.inputs.map(([label, value]) => (
              <Field key={label} label={label} value={value} />
            ))}
          </div>
        </Section>

        {/* ── what came back ───────────────────────────────────────────── */}
        <Section
          title="Outputs"
          raw={rawOut}
          onToggleRaw={() => setRawOut(v => !v)}
          rawText={io.rawOutputs}
        >
          <Code text={io.outputs} tone={step.status === 'failed' ? 'bad' : 'plain'} />
        </Section>

        {/* ── where it sits in the run ─────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-2">Properties</p>
          <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden bg-white">
            <Row label="Status">
              <span className={`px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium ${TONE[step.status]}`}>
                {STEP_LABEL[step.status]}
              </span>
            </Row>
            <Row label="Started">{fmtClock(run.startedAt, step.at)}</Row>
            <Row label="Duration">{step.durationMs > 0 ? fmtDuration(step.durationMs) : '—'}</Row>
            {step.target && <Row label="Acted on">{step.target.value}</Row>}
            <Row label="Customer">{run.tenant}</Row>
            <Row label="Run">{run.id}</Row>
            <Row label="Started by">{triggerName(run.trigger)} · {run.sourceRef}</Row>
          </div>
      </section>
    </div>
  );
}

function Section({ title, raw, onToggleRaw, rawText, children }: {
  title: string; raw: boolean; onToggleRaw: () => void; rawText: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f]">{title}</p>
        <button
          onClick={onToggleRaw}
          className="text-[11px] text-[#2A96A8] hover:underline"
        >
          {raw ? `Show ${title.toLowerCase()}` : `Show raw ${title.toLowerCase()}`}
        </button>
      </div>
      {raw ? <Code text={rawText} tone="plain" /> : children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  // A query is the one input that is read line by line, so it keeps its
  // newlines and its monospace rather than being flattened into a box.
  const multiline = value.includes('\n');
  return (
    <div>
      <p className="text-[11px] text-[#6b828c] mb-1">{label}</p>
      <div className={`px-3 py-2 rounded-[8px] border border-[var(--stroke)] bg-white text-[#092E3F] ${
        multiline ? 'font-mono text-[11px] leading-5 whitespace-pre-wrap' : 'text-sm break-words'
      }`}>
        {value}
      </div>
    </div>
  );
}

function Code({ text, tone }: { text: string; tone: 'plain' | 'bad' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1400); },
      () => { /* clipboard blocked — the text is on screen either way */ },
    );
  };

  return (
    <div className="relative">
      <pre className={`px-3 py-2 pr-9 rounded-[8px] border overflow-x-auto font-mono text-[11px] leading-5 ${
        tone === 'bad'
          ? 'border-[#f3cfcc] bg-[#fdeceb] text-[#c2453d]'
          : 'border-[var(--stroke)] bg-[#fafbfb] text-[#092E3F]'
      }`}>
        {text}
      </pre>
      <button
        onClick={copy}
        title="Copy"
        className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-[8px]
                   text-[#87999f] hover:text-[#092E3F] hover:bg-white transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-[#2f7d52]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-[11px] text-[#87999f] w-[86px] shrink-0">{label}</span>
      <span className="text-sm text-[#092E3F] min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
}
