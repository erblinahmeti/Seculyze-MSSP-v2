import type { RedesignIncident, Severity, Verdict } from './triageRedesignData';

// ─── Similar incidents (mock) ────────────────────────────────────────────────
//
// Past incidents that match this one, each with what it was, whose it was, why
// it matched, how it was closed and what was done. Generated from a small spec
// per incident so every scenario gets its own believable history; the counts
// per outcome are fixed in the spec and never depend on today's AI verdict.

export interface SimilarIncident {
  number: string;
  title: string;
  tenant: string;
  severity: Severity;
  age: string;
  /** How it was closed. */
  closedAs: Verdict;
  /** What was done, and how long it took. */
  outcome: string;
  /** Why it matched: "Same account", "9 shared IPs", "Same rule"… */
  matches: string[];
}

export interface SimilarSet {
  windowDays: number;
  items: SimilarIncident[];
}

interface Spec {
  /** How many past incidents closed each way. */
  mix: Partial<Record<Verdict, number>>;
  titles: string[];
  /** Match reasons for the incident's own tenant, cycled. */
  own: string[][];
  /** Another tenant hit by the same campaign: the tenants, a title and match reasons. */
  cross: { tenants: string[]; title: string; matches: string[][] };
}

const OUTCOMES: Record<Verdict, string[]> = {
  TruePositive: ['Ticket raised · password reset forced', 'Ticket raised · source IPs blocked', 'Escalated to client · account disabled'],
  FalsePositive: ['Closed by automation · known pattern', 'Closed by analyst · expected activity'],
  Undetermined: ['Closed · not enough evidence'],
};
const TOOK = ['in 2h', 'in 5h', 'in 40m', 'in 1d', 'in 3h'];

const SPECS: Record<string, Spec> = {
  '14310': {
    mix: { TruePositive: 20 },
    titles: ['Distributed password cracking attempts in Microsoft Entra ID', 'Multiple account lockouts for one user', 'Sign-in attempts from Tor exit nodes'],
    own: [['Same account', 'Same rule'], ['Same rule', '9 shared IPs'], ['Same account', 'Same technique T1110.003']],
    cross: { tenants: ['Adidas', 'Puma'], title: 'Password spray against Microsoft Entra ID accounts', matches: [['6 shared IPs', 'Same technique T1110.003'], ['4 shared IPs', 'Same rule']] },
  },
  '14287': {
    mix: { FalsePositive: 11, Undetermined: 1 },
    titles: ['Sign-in from new ASN'],
    own: [['Same account', 'Same ASN 12830'], ['Same rule', 'Same ASN 12830'], ['Same account', 'Same rule']],
    cross: { tenants: ['Nike'], title: 'Sign-in from new ASN', matches: [['Same rule']] },
  },
  '14352': {
    mix: { TruePositive: 6, Undetermined: 1 },
    titles: ['Mass download after impossible travel', 'Impossible travel followed by a token replay', 'Unusual volume of file downloads'],
    own: [['Same account', 'Same rule'], ['Same Tor exit 185.220.101.44'], ['Same technique T1567']],
    cross: { tenants: ['Nike'], title: 'Sign-in from a Tor exit node', matches: [['Same Tor exit 185.220.101.44']] },
  },
  '14360': {
    mix: { Undetermined: 3, FalsePositive: 2 },
    titles: ['Inbox forwarding rule to external address'],
    own: [['Same account', 'Same rule'], ['Same forwarding domain']],
    cross: { tenants: ['Puma'], title: 'Inbox rule forwarding to an external domain', matches: [['Same forwarding domain']] },
  },
  '14371': {
    mix: { TruePositive: 3, Undetermined: 1 },
    titles: ['Multiple failed MFA challenges followed by a successful sign-in'],
    own: [['Same account', 'Same rule'], ['Same VPN provider DataCamp']],
    cross: { tenants: ['Puma'], title: 'MFA push spam followed by an approval', matches: [['Same VPN exit 89.187.171.20', 'Same technique T1621']] },
  },
  '14388': {
    mix: { FalsePositive: 16 },
    titles: ['Credentials added to multiple applications'],
    own: [['Same app registration', 'Same rule'], ['Same rule']],
    cross: { tenants: ['Adidas'], title: 'Credentials added to multiple applications', matches: [['Same rule']] },
  },
};

const WINDOW_DAYS = 90;
const OTHER_SEVERITY: Record<Severity, Severity> = { High: 'Medium', Medium: 'High', Low: 'Medium', Informational: 'Low' };

const ago = (days: number) => (days < 14 ? `${days} days ago` : `${Math.round(days / 7)} weeks ago`);

/** Every past incident similar to this one in the last 90 days, newest first. */
export function similarFor(incident: RedesignIncident): SimilarSet {
  const spec = SPECS[incident.number];
  if (!spec) return { windowDays: WINDOW_DAYS, items: [] };
  // Outcomes in a fixed, mixed order so the list isn't sorted by verdict.
  const outcomes = (Object.entries(spec.mix) as [Verdict, number][]).flatMap(([v, n]) => Array.from({ length: n }, () => v));
  const order = outcomes.map((v, i) => ({ v, k: (i * 7) % outcomes.length })).sort((a, b) => a.k - b.k).map(x => x.v);
  const total = order.length;
  let crossSeen = 0;
  const items = order.map((closedAs, i): SimilarIncident => {
    const cross = i % 4 === 3;
    const tenant = cross ? spec.cross.tenants[crossSeen % spec.cross.tenants.length] : incident.client;
    const matches = cross ? spec.cross.matches[crossSeen % spec.cross.matches.length] : spec.own[i % spec.own.length];
    if (cross) crossSeen++;
    const days = Math.max(1, Math.round(2 + (i * (WINDOW_DAYS - 6)) / Math.max(1, total - 1)));
    const outs = OUTCOMES[closedAs];
    return {
      // Well below today's numbers, so a past incident never shares a number with a current test incident.
      number: String(Number(incident.number) - 300 - i * 17 - (i % 3) * 4),
      title: cross ? spec.cross.title : spec.titles[i % spec.titles.length],
      tenant,
      severity: i % 5 === 2 ? OTHER_SEVERITY[incident.severity] : incident.severity,
      age: ago(days),
      closedAs,
      outcome: `${outs[i % outs.length]} · ${TOOK[i % TOOK.length]}`,
      matches,
    };
  });
  return { windowDays: WINDOW_DAYS, items };
}
