import { useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info } from 'lucide-react';
import EvidenceText from './EvidenceText';
import type { EvidenceItem, EvidenceStatus } from './triageRedesignData';

// ─── Evidence collected ──────────────────────────────────────────────────────
//
// Compact rows in the agent's order, each marked with what it does to the
// assessment. Status comes from the data, never from reading the sentence.
//
// Long items may carry a summary; the original text is always one click away
// and "Show all original text" swaps every row at once for L2 review. A
// summary is only shown if every number, IP and account in it also appears in
// the original — otherwise the original is shown instead, so a summary can
// never introduce a figure the agent didn't report.

const STATUS: Record<EvidenceStatus, { label: string; plural: string; icon: typeof Info; cls: string }> = {
  suspicious: { label: 'Suspicious', plural: 'suspicious', icon: AlertTriangle, cls: 'text-red-600' },
  benign: { label: 'Benign', plural: 'benign', icon: CheckCircle2, cls: 'text-green-600' },
  unconfirmed: { label: 'Unconfirmed or missing', plural: 'unconfirmed', icon: HelpCircle, cls: 'text-amber-600' },
  context: { label: 'Context', plural: 'context', icon: Info, cls: 'text-[#092E3F]/45' },
};

const ORDER: EvidenceStatus[] = ['suspicious', 'unconfirmed', 'benign', 'context'];

/** Numbers, IPs and accounts — the tokens a summary must not invent. */
const FACT = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b\d[\d.,:/-]*\d\b|\b\d\b/g;

function faithful(summary: string, original: string) {
  const invented = (summary.match(FACT) ?? []).filter(tok => !original.includes(tok));
  if (invented.length && import.meta.env.DEV) {
    console.warn('Evidence summary dropped, not in original:', invented, summary);
  }
  return invented.length === 0;
}

/** "5 suspicious · 1 unconfirmed · 1 context" — also used as the collapsed preview. */
export function evidenceTally(items: EvidenceItem[]) {
  return ORDER.map(s => [s, items.filter(i => i.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${STATUS[s].plural}`)
    .join(' · ');
}

function Row({ item, n, showOriginal }: { item: EvidenceItem; n: number; showOriginal: boolean }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[item.status];
  const summary = item.summary && faithful(item.summary, item.text) ? item.summary : undefined;
  const original = showOriginal || !summary;

  return (
    <li className="flex gap-2.5 px-3 py-2">
      <span className="mt-[3px] shrink-0" title={s.label}>
        <s.icon className={`w-4 h-4 ${s.cls}`} aria-hidden />
        <span className="sr-only">{s.label}:</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed text-[#092E3F]/80">
          <EvidenceText text={original ? item.text : summary} />
        </p>
        {item.caveat && <p className="mt-0.5 text-xs text-amber-800">{item.caveat}</p>}
        {summary && !showOriginal && (
          <>
            {/* Muted: one per row, so at full teal they'd outshout the evidence. */}
            <button onClick={() => setOpen(!open)} className="mt-0.5 text-xs text-[#092E3F]/45 hover:text-[#1e7d8f] focus:text-[#1e7d8f]">
              {open ? 'Hide original evidence' : 'Original evidence'}
            </button>
            {open && (
              <p className="mt-1 px-2.5 py-1.5 rounded-[4px] bg-[#f6f6f6] text-xs leading-relaxed text-[#092E3F]/75">
                <EvidenceText text={item.text} />
              </p>
            )}
          </>
        )}
      </div>
      <span className="shrink-0 mt-[3px] text-[11px] text-[#092E3F]/35 tabular-nums">#{n}</span>
    </li>
  );
}

export default function EvidenceList({ items }: { items: EvidenceItem[] }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasSummaries = items.some(i => i.summary);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="flex items-center gap-3 text-xs text-[#092E3F]/65 tabular-nums">
          {ORDER.map(st => {
            const n = items.filter(i => i.status === st).length;
            if (!n) return null;
            const s = STATUS[st];
            return (
              <span key={st} className="inline-flex items-center gap-1">
                <s.icon className={`w-3.5 h-3.5 ${s.cls}`} aria-hidden />
                {n} {s.plural}
              </span>
            );
          })}
        </p>
        {hasSummaries && (
          <button onClick={() => setShowOriginal(!showOriginal)} className="shrink-0 text-xs text-[#1e7d8f] hover:text-[#092E3F]">
            {showOriginal ? 'Show summaries' : 'Show all original text'}
          </button>
        )}
      </div>
      <ul className="rounded-[4px] border border-[var(--stroke)] divide-y divide-gray-100">
        {items.map((item, i) => (
          <Row key={i} item={item} n={i + 1} showOriginal={showOriginal} />
        ))}
      </ul>
    </div>
  );
}
