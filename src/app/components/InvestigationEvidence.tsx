import { useEffect, useRef, useState } from 'react';
import { Ban, ChevronDown, CircleX, SkipForward } from 'lucide-react';
import EvidenceText, { plainText } from './EvidenceText';
import type { Analysis, InvestigationQuery } from './triageRedesignData';

// ─── Evidence ────────────────────────────────────────────────────────────────
//
// "What did the system check, and what came back?" — the verification layer
// under Key findings. Closed by default: an analyst opens it to verify a
// finding, usually by following a finding's "Check it yourself" link.
//
// Each query names the findings that use it, opens to its purpose, scope,
// source, time range and a sample of the rows, and shows the KQL on request.
// Checks that produced no answer — skipped, failed, unavailable — follow the
// completed ones under their own label, so "ran and matched nothing" and
// "didn't run" never read the same.

/** A request to reveal one query, from a finding. `n` re-triggers on repeat clicks. */
export type QueryFocus = { id: string; n: number };

const isGap = (q: InvestigationQuery) => q.status !== 'completed';

const GAP = {
  skipped: { label: 'Skipped', icon: SkipForward, chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Failed', icon: CircleX, chip: 'bg-red-50 text-red-700 border-red-200' },
  unavailable: { label: 'Unavailable', icon: Ban, chip: 'bg-[#eef2f3] text-[#092E3F]/70 border-[var(--stroke)]' },
} as const;

const REASON_CODES: Record<string, string> = { requires_unmet: 'Requirements not met' };
const rowsLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'row' : 'rows'}`;

/** "12 queries, all OK." / "9 queries · 1 didn’t run." */
export function evidenceSummary(a: Analysis) {
  const all = a.queries.length;
  const gaps = a.queries.filter(isGap).length;
  return `${all} ${all === 1 ? 'query' : 'queries'}${gaps ? ` · ${gaps} didn’t run` : ', all OK'}.`;
}

function Status({ q }: { q: InvestigationQuery }) {
  if (q.status === 'completed') {
    return <span className={`shrink-0 text-xs tabular-nums ${q.rows ? 'text-[#092E3F]/60' : 'text-[#092E3F]/40'}`}>{rowsLabel(q.rows ?? 0)}</span>;
  }
  const g = GAP[q.status];
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border text-[11px] ${g.chip}`}>
      <g.icon className="w-3 h-3" aria-hidden /> {g.label}
    </span>
  );
}

function Results({ q }: { q: InvestigationQuery }) {
  if (q.status !== 'completed') {
    return <p className="text-xs text-[#092E3F]/70">No results — this check didn’t produce an answer, so it can’t confirm or rule anything out.</p>;
  }
  if (!q.rows || !q.result) return <p className="text-xs text-[#092E3F]/70">The query ran and returned no rows.</p>;
  return (
    <div className="overflow-x-auto rounded-[4px] border border-[var(--stroke)] bg-white">
      <table className="w-full text-left">
        <thead className="bg-[#f6f6f6] border-b border-[var(--stroke)]">
          <tr>
            {q.result.columns.map(c => (
              <th key={c} className="px-2.5 py-1.5 text-[11px] font-medium text-[#6b828c] whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {q.result.rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-2.5 py-1.5 text-xs text-[#092E3F] whitespace-nowrap tabular-nums">
                  <EvidenceText text={cell} emphasis={false} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueryRow({ q, usedBy, focus }: { q: InvestigationQuery; usedBy: string[]; focus: QueryFocus | null }) {
  const [open, setOpen] = useState(false);
  const [kql, setKql] = useState(false);
  const [lit, setLit] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  // Arriving from a finding: open, bring into view, flash so the eye lands on it.
  useEffect(() => {
    if (!focus || focus.id !== q.id) return;
    setOpen(true);
    setLit(true);
    const scroll = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    const fade = setTimeout(() => setLit(false), 2200);
    return () => {
      clearTimeout(scroll);
      clearTimeout(fade);
    };
  }, [focus?.n]);

  const reason = q.reason && (q.reasonText ?? REASON_CODES[q.reason] ?? q.reason);
  const code = q.reason && REASON_CODES[q.reason] ? q.reason : undefined;
  const sample = q.status === 'completed' && q.rows && q.result ? q.result.rows.length : 0;

  return (
    <li ref={ref} className={`transition-[background-color,box-shadow] duration-500 ${lit ? 'bg-[#e5f2f4] shadow-[inset_3px_0_0_#2A96A8]' : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-[#092E3F]">{q.title}</span>
          <span className="block text-xs text-[#092E3F]/50 truncate">
            {usedBy.length ? `Used by: ${usedBy.map(plainText).join(' · ')}` : 'Context for the analysis'}
          </span>
        </span>
        <Status q={q} />
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#092E3F]/45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2.5">
          <p className="text-sm text-[#092E3F]/80">{q.purpose}</p>
          {q.scope && (
            <p className="text-xs text-[#092E3F]/60">
              All rows: {q.scope.label} <EvidenceText text={q.scope.value} emphasis={false} />
            </p>
          )}
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-[#6b828c]">Query</dt>
            <dd>
              <code className="font-mono text-[11px] text-[#092E3F]/70">{q.id}</code>
            </dd>
            <dt className="text-[#6b828c]">Source</dt>
            <dd className="text-[#092E3F]">{q.source}</dd>
            <dt className="text-[#6b828c]">Time range</dt>
            <dd className="text-[#092E3F]">{q.timeRange}</dd>
            <dt className="text-[#6b828c]">Status</dt>
            <dd className="text-[#092E3F]">{q.status === 'completed' ? `Completed · ${rowsLabel(q.rows ?? 0)}` : GAP[q.status].label}</dd>
            {reason && (
              <>
                <dt className="text-[#6b828c]">Reason</dt>
                <dd className="text-[#092E3F]">
                  {reason}
                  {code && <code className="ml-1.5 font-mono text-[11px] text-[#092E3F]/50">{code}</code>}
                </dd>
              </>
            )}
          </dl>
          <Results q={q} />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[#092E3F]/50 tabular-nums">
              {sample ? (sample < (q.rows ?? 0) ? `Sample: ${sample} of ${rowsLabel(q.rows!)}` : 'All rows shown') : ''}
            </span>
            <button onClick={() => setKql(!kql)} className="text-xs text-[#1e7d8f] hover:text-[#092E3F]">
              {kql ? 'Hide KQL' : 'View KQL'}
            </button>
          </div>
          {kql && <pre className="px-3 py-2.5 rounded-[4px] bg-[#092E3F] text-[11px] leading-relaxed text-white/90 font-mono whitespace-pre-wrap break-words">{q.kql}</pre>}
        </div>
      )}
    </li>
  );
}

export default function InvestigationEvidence({
  analysis: a,
  focus,
  open,
  onOpenChange,
}: {
  analysis: Analysis;
  focus: QueryFocus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ran = a.queries.filter(q => !isGap(q));
  const gaps = a.queries.filter(isGap);
  const sources = [...new Set(a.queries.map(q => q.source.split(' · ')[0]))];
  const usedBy = (id: string) => a.findings.filter(f => f.queryIds?.includes(id)).map(f => f.title);

  return (
    <section className="rounded-[8px] border border-[var(--stroke)] overflow-hidden">
      <button onClick={() => onOpenChange(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-base text-[#092E3F]">Evidence</span>
          <span className="block text-xs text-[#092E3F]/55">{evidenceSummary(a)} Open only to verify a finding.</span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#092E3F]/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--stroke)]">
          <p className="px-4 py-2 text-xs text-[#092E3F]/55 border-b border-gray-100">Ran against {sources.join(', ')}</p>
          <ul className="divide-y divide-gray-100">
            {ran.map(q => (
              <QueryRow key={q.id} q={q} usedBy={usedBy(q.id)} focus={focus} />
            ))}
          </ul>
          {gaps.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1.5 border-t border-[var(--stroke)] bg-amber-50/40">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">Didn’t run · {gaps.length}</p>
                <p className="text-xs text-[#092E3F]/60">These checks produced no answer, so they can’t confirm or rule anything out.</p>
              </div>
              <ul className="divide-y divide-amber-100 bg-amber-50/40">
                {gaps.map(q => (
                  <QueryRow key={q.id} q={q} usedBy={usedBy(q.id)} focus={focus} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
