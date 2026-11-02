import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, CircleX, SkipForward, TextSearch } from 'lucide-react';
import type { Analysis, InvestigationQuery } from './triageRedesignData';

// ─── Investigation evidence ──────────────────────────────────────────────────
//
// Answers "what did the system check, and what came back?" — the verification
// layer under Key findings (the reasoning) and the AI assessment (the summary).
//
//   Queries run          checks that completed, with their row counts
//   Investigation gaps   checks that were skipped, failed or had no data
//
// Each row opens to its purpose, source, time range and a sample of the
// results. A key finding can send the analyst straight to a row: the section
// opens, the row expands, scrolls into view and is briefly highlighted.
//
// "Ran and matched nothing" and "produced no answer" are kept visibly apart:
// a gap is never evidence that nothing happened.

/** A request to show one query, from a key finding. `n` re-triggers on repeat clicks. */
export type QueryFocus = { id: string; n: number };

const isGap = (q: InvestigationQuery) => q.status !== 'completed';

const GAP = {
  skipped: { label: 'Skipped', icon: SkipForward, chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Failed', icon: CircleX, chip: 'bg-red-50 text-red-700 border-red-200' },
  unavailable: { label: 'Unavailable', icon: Ban, chip: 'bg-[#eef2f3] text-[#092E3F]/70 border-[var(--stroke)]' },
} as const;

/** Plain language for the raw reason codes the analysis emits. */
const REASON_CODES: Record<string, string> = { requires_unmet: 'Requirements not met' };

/** How many queries completed — the section's count badge. */
export const queriesRun = (a: Analysis) => a.queries?.filter(q => !isGap(q)).length;

/** The collapsed row's preview line. */
export function investigationPreview(a: Analysis) {
  if (!a.queries) return undefined;
  const ran = queriesRun(a)!;
  const gaps = a.queries.length - ran;
  return [`${ran} ${ran === 1 ? 'query' : 'queries'} run`, gaps && `${gaps} ${gaps === 1 ? 'gap' : 'gaps'}`].filter(Boolean).join(' · ');
}

const rowsLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'row' : 'rows'}`;

/** The right-hand status: a row count for completed queries, a state chip for gaps. */
function StatusPill({ q }: { q: InvestigationQuery }) {
  if (q.status === 'completed') {
    const cls = q.rows ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[#eef2f3] text-[#092E3F]/55 border-[var(--stroke)]';
    return <span className={`shrink-0 px-1.5 py-0.5 rounded-[4px] border font-mono text-[11px] tabular-nums ${cls}`}>{rowsLabel(q.rows ?? 0)}</span>;
  }
  const g = GAP[q.status];
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border text-[11px] ${g.chip}`}>
      <g.icon className="w-3 h-3" aria-hidden /> {g.label}
    </span>
  );
}

function ResultTable({ q }: { q: InvestigationQuery }) {
  if (q.status !== 'completed') {
    return <p className="text-xs text-[#092E3F]/70">No results — this check didn’t produce an answer, so it can’t confirm or rule anything out.</p>;
  }
  if (!q.rows || !q.result) {
    return <p className="text-xs text-[#092E3F]/70">The query ran and returned no rows.</p>;
  }
  const { columns, rows } = q.result;
  return (
    <div>
      <div className="overflow-x-auto rounded-[4px] border border-[var(--stroke)] bg-white">
        <table className="w-full text-left">
          <thead className="bg-[#f6f6f6] border-b border-[var(--stroke)]">
            <tr>
              {columns.map(c => (
                <th key={c} className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#6b828c] whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className="px-2.5 py-1.5 font-mono text-[11px] text-[#092E3F] whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-[#092E3F]/50 tabular-nums">
        {rows.length < q.rows ? `Sample: ${rows.length} of ${rowsLabel(q.rows)}` : `All ${rowsLabel(q.rows)}`}
      </p>
    </div>
  );
}

function QueryRow({ q, focus }: { q: InvestigationQuery; focus: QueryFocus | null }) {
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  // Arriving from a key finding: open, bring into view, flash so the eye lands on it.
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

  const plain = q.reason && (q.reasonText ?? REASON_CODES[q.reason] ?? q.reason);
  const code = q.reason && REASON_CODES[q.reason] ? q.reason : undefined;

  return (
    <li ref={ref} className={`transition-[background-color,box-shadow] duration-500 ${lit ? 'bg-[#e5f2f4] shadow-[inset_3px_0_0_#2A96A8]' : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02] transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-[#092E3F]">{q.title}</span>
          <code className="block font-mono text-[11px] text-[#092E3F]/55 break-all">{q.id}</code>
        </span>
        <StatusPill q={q} />
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#092E3F]/45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-sm text-[#092E3F]/80">{q.purpose}</p>
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-[#6b828c]">Source</dt>
            <dd className="text-[#092E3F]">{q.source}</dd>
            <dt className="text-[#6b828c]">Time range</dt>
            <dd className="text-[#092E3F]">{q.timeRange}</dd>
            <dt className="text-[#6b828c]">Status</dt>
            <dd className="text-[#092E3F]">{q.status === 'completed' ? `Completed · ${rowsLabel(q.rows ?? 0)}` : GAP[q.status].label}</dd>
            {plain && (
              <>
                <dt className="text-[#6b828c]">Reason</dt>
                <dd className="text-[#092E3F]">
                  {plain}
                  {code && <code className="ml-1.5 font-mono text-[11px] text-[#092E3F]/50">{code}</code>}
                </dd>
              </>
            )}
          </dl>
          <ResultTable q={q} />
        </div>
      )}
    </li>
  );
}

export default function InvestigationEvidence({ analysis: a, focus }: { analysis: Analysis; focus: QueryFocus | null }) {
  const queries = a.queries;
  if (!queries) {
    return <p className="text-xs text-[#092E3F]/60">This analysis didn’t report which queries it ran.</p>;
  }
  const ran = queries.filter(q => !isGap(q));
  const gaps = queries.filter(isGap);
  const sources = [...new Set(queries.map(q => q.source.split(' · ')[0]))];

  return (
    <div className="space-y-4">
      {ran.length > 0 && (
        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2 min-w-0">
              <TextSearch className="w-4 h-4 mt-0.5 shrink-0 text-[#2A96A8]" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm text-[#092E3F]">Queries run</p>
                <p className="text-xs text-[#092E3F]/55">ran against {sources.join(', ')}</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1.5 text-xs tabular-nums text-[#092E3F]/70">
              <span className="px-1.5 py-0.5 rounded-[4px] bg-green-50 text-green-700 border border-green-200">ok</span>
              {ran.length}
            </span>
          </div>
          <ul className="rounded-[4px] border border-[var(--stroke)] divide-y divide-gray-100">
            {ran.map(q => (
              <QueryRow key={q.id} q={q} focus={focus} />
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-sm text-[#092E3F]">
            <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden /> Investigation gaps
            <span className="px-1.5 rounded-[4px] bg-amber-50 border border-amber-200 text-xs text-amber-800 tabular-nums">{gaps.length}</span>
          </p>
          <p className="mt-0.5 mb-2 ml-[22px] text-xs text-[#092E3F]/60">
            These checks didn’t produce an answer, so they can’t confirm or rule anything out.
          </p>
          <ul className="rounded-[4px] border border-amber-200 bg-amber-50/30 divide-y divide-amber-100">
            {gaps.map(q => (
              <QueryRow key={q.id} q={q} focus={focus} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
