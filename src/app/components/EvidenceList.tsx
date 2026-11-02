import { AlertTriangle, CheckCircle2, HelpCircle, Info } from 'lucide-react';
import EvidenceText from './EvidenceText';
import type { EvidenceItem, EvidenceStatus } from './triageRedesignData';

// ─── Evidence collected ──────────────────────────────────────────────────────
//
// The source record behind the assessment: the agent's original text, in its
// order, each row marked with what it does to the verdict. Status comes from
// the data, never from reading the sentence.
//
// No summaries here on purpose. The metric tiles and key findings above
// already give the short version; a third rewording of the same facts was the
// repetition this section is meant to avoid. This layer is for checking the
// exact wording, so it shows exactly that, with the scannable tokens styled.

const STATUS: Record<EvidenceStatus, { label: string; plural: string; icon: typeof Info; cls: string }> = {
  suspicious: { label: 'Suspicious', plural: 'suspicious', icon: AlertTriangle, cls: 'text-red-600' },
  benign: { label: 'Benign', plural: 'benign', icon: CheckCircle2, cls: 'text-green-600' },
  unconfirmed: { label: 'Unconfirmed or missing', plural: 'unconfirmed', icon: HelpCircle, cls: 'text-amber-600' },
  context: { label: 'Context', plural: 'context', icon: Info, cls: 'text-[#092E3F]/45' },
};

const ORDER: EvidenceStatus[] = ['suspicious', 'unconfirmed', 'benign', 'context'];

/** "5 suspicious · 1 unconfirmed · 1 context" — also used as the collapsed preview. */
export function evidenceTally(items: EvidenceItem[]) {
  return ORDER.map(s => [s, items.filter(i => i.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${STATUS[s].plural}`)
    .join(' · ');
}

export default function EvidenceList({ items }: { items: EvidenceItem[] }) {
  return (
    <div>
      <p className="flex items-center gap-3 mb-2 text-xs text-[#092E3F]/65 tabular-nums">
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
      <ul className="rounded-[4px] border border-[var(--stroke)] divide-y divide-gray-100">
        {items.map((item, i) => {
          const s = STATUS[item.status];
          return (
            <li key={i} className="flex gap-2.5 px-3 py-2">
              <span className="mt-[3px] shrink-0" title={s.label}>
                <s.icon className={`w-4 h-4 ${s.cls}`} aria-hidden />
                <span className="sr-only">{s.label}:</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed text-[#092E3F]/80">
                  <EvidenceText text={item.text} />
                </p>
                {item.caveat && <p className="mt-0.5 text-xs text-amber-800">{item.caveat}</p>}
              </div>
              <span className="shrink-0 mt-[3px] text-[11px] text-[#092E3F]/35 tabular-nums">#{i + 1}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
