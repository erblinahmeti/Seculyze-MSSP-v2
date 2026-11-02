import type { ReactNode } from 'react';
import { User } from 'lucide-react';

// ─── Evidence text with semantic highlighting ────────────────────────────────
//
// Evidence arrives as the agent's plain sentences, every word the same weight.
// This picks out the tokens an analyst scans for and styles each kind
// differently — by shape and type, not only colour:
//
//   accounts      icon + teal            hello@seculyze.com
//   IPs           monospace, grey chip   61.73.190.98
//   result codes  monospace, outlined    50053
//   field names   monospace, grey        successful_signins_for_account
//   counts        bold                   603 failed, 218 distinct IPs
//   time windows  bold                   last 7 days, 24-hour
//   dates         kept on one line       2026-10-25
//
// The text itself is never changed, only wrapped, so nothing the agent said is
// lost or reworded. Patterns are deliberately narrow: a missed highlight costs
// little, a wrong one (an ASN styled as an error code) misleads.

const PATTERNS = [
  ['email', String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`],
  ['ip', String.raw`\b(?:\d{1,3}\.){3}\d{1,3}\b`],
  ['date', String.raw`\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?\b`],
  // Entra ID result codes all start with 50 (50053, 50126, 500121, 50133).
  ['code', String.raw`\b50\d{3,4}\b`],
  ['field', String.raw`\b[a-z]+(?:_[a-z]+)+\b|\bis[A-Z][a-z]+\b`],
  ['window', String.raw`\b(?:last\s+)?\d+(?:-hour|\s+(?:days?|hours?|minutes?))\b`],
  [
    'count',
    String.raw`\b\d[\d,]*(?=\s+(?:failed|failures?|successes|distinct|times|events|interactive|sign-ins|audit|FileDownloaded|similar|IPs|actions|countries)\b)`,
  ],
] as const;

type Kind = (typeof PATTERNS)[number][0];

const MATCHER = new RegExp(PATTERNS.map(([name, re]) => `(?<${name}>${re})`).join('|'), 'g');

const CHIP = 'font-mono text-[12px] leading-none px-1 py-[3px] rounded-[4px] whitespace-nowrap';

function render(kind: Kind, text: string, key: number): ReactNode {
  switch (kind) {
    case 'email':
      return (
        <span key={key} className="inline-flex items-baseline gap-1 text-[#1e7d8f] font-medium whitespace-nowrap">
          <User className="w-3 h-3 self-center shrink-0" aria-hidden />
          {text}
        </span>
      );
    case 'ip':
      return (
        <span key={key} className={`${CHIP} bg-[#eef2f3] text-[#092E3F]`}>
          {text}
        </span>
      );
    case 'code':
      return (
        <code key={key} className={`${CHIP} border border-[var(--stroke)] bg-white text-[#092E3F]`}>
          {text}
        </code>
      );
    case 'field':
      return (
        <code key={key} className={`${CHIP} bg-[#f6f6f6] text-[#092E3F]/75`}>
          {text}
        </code>
      );
    case 'date':
      return (
        <span key={key} className="whitespace-nowrap tabular-nums">
          {text}
        </span>
      );
    case 'window':
    case 'count':
      return (
        <strong key={key} className="font-semibold text-[#092E3F] tabular-nums whitespace-nowrap">
          {text}
        </strong>
      );
  }
}

export default function EvidenceText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MATCHER)) {
    const kind = (Object.keys(m.groups!) as Kind[]).find(k => m.groups![k] !== undefined)!;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(render(kind, m[0], m.index!));
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
