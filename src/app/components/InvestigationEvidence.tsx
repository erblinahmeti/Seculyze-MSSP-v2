import { useState } from 'react';
import { AlertTriangle, Ban, ChevronDown, CircleCheck, CircleMinus, CircleX, SkipForward, TextSearch } from 'lucide-react';
import EvidenceList, { evidenceTally } from './EvidenceList';
import type { Analysis, InvestigationQuery } from './triageRedesignData';

// ─── Investigation evidence ──────────────────────────────────────────────────
//
// Answers "what did the system check, and what came back?" — the verification
// layer under Key findings (the reasoning) and the AI assessment (the summary).
//
//   Queries run          what executed and how many rows it returned
//   Investigation gaps   what was skipped, failed or had no data source
//   AI evidence notes    the agent's written evidence, verbatim
//
// Built only from what the analysis reports. When it doesn't report queries,
// the section says so and falls back to the written notes; it never shows an
// empty "Queries run" that would read as "nothing was checked". Purpose, time
// range and row data are not in any output seen so far, so they are named as
// not reported rather than filled in.
//
// "Ran and matched nothing" and "did not run" are kept visibly apart: a gap is
// never evidence that nothing happened.

/** Mechanical, so a query's readable name never claims more than its id. */
const ACRONYMS: Record<string, string> = { ip: 'IP', asim: 'ASIM', mfa: 'MFA', oauth: 'OAuth', aad: 'AAD', id: 'ID' };

function readable(q: InvestigationQuery) {
  if (q.title) return q.title;
  const words = q.id.split('_').map(w => ACRONYMS[w] ?? w);
  return words.map((w, i) => (i === 0 && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function result(q: InvestigationQuery): { label: string; long: string; icon: typeof CircleCheck; cls: string } {
  switch (q.status) {
    case 'completed':
      if (q.rows === undefined)
        return { label: 'Completed', long: 'Completed. The row count was not reported.', icon: CircleCheck, cls: 'text-[#2A96A8]' };
      if (q.rows === 0)
        return { label: 'No matching rows', long: 'Completed and matched nothing in its window.', icon: CircleMinus, cls: 'text-[#092E3F]/40' };
      return {
        label: `${q.rows.toLocaleString()} ${q.rows === 1 ? 'row' : 'rows'}`,
        long: `Completed and returned ${q.rows.toLocaleString()} ${q.rows === 1 ? 'row' : 'rows'}.`,
        icon: CircleCheck,
        cls: 'text-[#2A96A8]',
      };
    case 'skipped':
      return {
        label: 'Skipped',
        long: q.reason === 'requires_unmet' ? 'Not run: its requirements were not met.' : 'Not run.',
        icon: SkipForward,
        cls: 'text-amber-600',
      };
    case 'failed':
      return { label: 'Failed', long: 'Attempted, but it failed to run.', icon: CircleX, cls: 'text-red-600' };
    case 'unavailable':
      return { label: 'Unavailable', long: 'Not run: the data source was unavailable.', icon: Ban, cls: 'text-amber-600' };
  }
}

const isGap = (q: InvestigationQuery) => q.status !== 'completed';

/**
 * One gap per readable title: the output sometimes reports two query ids
 * under a single skipped check, and the analyst thinks in checks.
 */
function gapGroups(queries: InvestigationQuery[] = []) {
  return Object.values(
    queries.filter(isGap).reduce<Record<string, InvestigationQuery[]>>((acc, q) => {
      (acc[readable(q)] ??= []).push(q);
      return acc;
    }, {}),
  );
}

/** How many queries completed — the section's count badge. */
export const queriesRun = (a: Analysis) => a.queries?.filter(q => !isGap(q)).length;

/** The collapsed row's preview line. */
export function investigationPreview(a: Analysis) {
  if (!a.queries) return evidenceTally(a.evidence);
  const ran = queriesRun(a)!;
  const gaps = gapGroups(a.queries).length;
  return [`${ran} ${ran === 1 ? 'query' : 'queries'} run`, gaps && `${gaps} ${gaps === 1 ? 'check' : 'checks'} not run`]
    .filter(Boolean)
    .join(' · ');
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[11px] text-[#092E3F]/60 break-all">{children}</code>;
}

/** Row-count pill: tinted when the query returned data, grey when it matched nothing. */
function RowsPill({ q }: { q: InvestigationQuery }) {
  const cls =
    q.rows === undefined
      ? 'bg-[#eef2f3] text-[#092E3F]/55'
      : q.rows === 0
        ? 'bg-[#eef2f3] text-[#092E3F]/55'
        : 'bg-green-50 text-green-700 border border-green-200';
  const label = q.rows === undefined ? 'not reported' : `${q.rows.toLocaleString()} ${q.rows === 1 ? 'row' : 'rows'}`;
  return <span className={`shrink-0 px-1.5 py-0.5 rounded-[4px] font-mono text-[11px] tabular-nums ${cls}`}>{label}</span>;
}

// Laid out like the Resolve output analysts already know: the technical query
// name is the row, the row count sits beside it, details on expand.
function QueryRow({ q, source }: { q: InvestigationQuery; source?: string }) {
  const [open, setOpen] = useState(false);
  const r = result(q);
  return (
    <li>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#fafbfb] transition-colors">
        <span className="flex-1 min-w-0 font-mono text-[13px] text-[#092E3F] break-all">{q.id}</span>
        <RowsPill q={q} />
        <ChevronDown className={`w-4 h-4 shrink-0 text-[#092E3F]/45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <dl className="mx-3 mb-2.5 px-3 py-2 rounded-[4px] bg-[#f6f6f6] grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-[#6b828c]">Query</dt>
          <dd><Mono>{q.id}</Mono></dd>
          {source && (
            <>
              <dt className="text-[#6b828c]">Source</dt>
              <dd className="text-[#092E3F]">{source}</dd>
            </>
          )}
          <dt className="text-[#6b828c]">Result</dt>
          <dd className="text-[#092E3F]">{r.long}</dd>
          <dt className="text-[#6b828c]">Not reported</dt>
          <dd className="text-[#092E3F]/60">Purpose, time range and the returned rows aren’t included in this analysis output.</dd>
        </dl>
      )}
    </li>
  );
}

export default function InvestigationEvidence({ analysis: a }: { analysis: Analysis }) {
  const queries = a.queries;
  const ran = queries?.filter(q => !isGap(q)) ?? [];
  const gaps = gapGroups(queries);
  const [notesOpen, setNotesOpen] = useState(!queries);
  const empty = ran.filter(q => q.rows === 0).length;

  return (
    <div className="space-y-4">
      {queries ? (
        ran.length > 0 && (
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2">
                <TextSearch className="w-4 h-4 mt-0.5 text-[#2A96A8]" aria-hidden />
                <div>
                  <p className="text-sm text-[#092E3F]">Queries run</p>
                  {a.querySource && <p className="text-xs text-[#092E3F]/55">ran against {a.querySource}</p>}
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs tabular-nums text-[#092E3F]/70" title={`${ran.length} completed${empty ? `, ${empty} with no matching rows` : ''}`}>
                <span className="px-1.5 py-0.5 rounded-[4px] bg-green-50 text-green-700 border border-green-200">ok</span>
                {ran.length}
              </span>
            </div>
            <ul className="rounded-[4px] border border-[var(--stroke)] divide-y divide-gray-100">
              {ran.map(q => (
                <QueryRow key={q.id} q={q} source={a.querySource} />
              ))}
            </ul>
          </div>
        )
      ) : (
        <p className="text-xs text-[#092E3F]/60">
          This analysis didn’t report which queries it ran, so only the AI’s written evidence is available.
        </p>
      )}

      {gaps.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden /> Investigation gaps · {gaps.length}
          </p>
          <p className="mb-1.5 text-xs text-[#092E3F]/60">
            These checks didn’t produce an answer, so they can’t confirm or rule anything out.
          </p>
          <ul className="rounded-[4px] border border-amber-200 bg-amber-50/40 divide-y divide-amber-100">
            {gaps.map(group => {
              const r = result(group[0]);
              return (
                <li key={readable(group[0])} className="flex items-start gap-2.5 px-3 py-2">
                  <r.icon className={`w-4 h-4 mt-0.5 shrink-0 ${r.cls}`} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#092E3F]">{readable(group[0])}</p>
                    <p className="text-xs text-[#092E3F]/65">{r.long}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2">
                      {group.map(q => (
                        <Mono key={q.id}>{q.id}</Mono>
                      ))}
                      {group[0].reason && <Mono>· {group[0].reason}</Mono>}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[#092E3F]/70">{r.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <button onClick={() => setNotesOpen(!notesOpen)} className="w-full flex items-center gap-2 mb-1.5 text-left">
          <ChevronDown className={`w-3.5 h-3.5 text-[#092E3F]/40 transition-transform ${notesOpen ? '' : '-rotate-90'}`} />
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#6b828c]">AI evidence notes · {a.evidence.length}</span>
          {!notesOpen && <span className="flex-1 text-right text-xs text-[#092E3F]/45">{evidenceTally(a.evidence)}</span>}
        </button>
        {notesOpen && <EvidenceList items={a.evidence} />}
      </div>
    </div>
  );
}
