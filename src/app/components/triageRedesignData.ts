import { TRIAGE_INCIDENTS, type Severity, type TriageIncident } from './triageTestData';

// ─── AI triage redesign fixtures (decision-first panel) ──────────────────────
//
// The same incidents as the first test page, reshaped around the decisions an
// analyst makes rather than around what the agent printed:
//
//   · The summary is split into what happened / what the evidence supports /
//     what is NOT confirmed, so the separate Conclusion paragraph — which
//     restated the summary — has nothing left to say and is gone.
//   · The recommendation carries its own why and what-it-does.
//   · Each finding has a title, one line, and the agent's full text as detail.
//     `key` marks the few shown before "Show all"; in production the agent
//     would have to rank these, the panel cannot.
//
// Two extra incidents cover states the first page never showed: one not yet
// analysed (and analysed with gaps once you run it), and one whose analysis
// failed. Their evidence is written for this prototype, not taken from a log.

export type Verdict = 'TruePositive' | 'FalsePositive' | 'Undetermined';
export type Tone = 'suspicious' | 'benign' | 'neutral';

export interface Metric {
  value: string;
  label: string;
  tone: Tone;
}

export interface Finding {
  title: string;
  line: string;
  detail: string;
  tone: 'suspicious' | 'benign';
  key?: boolean;
}

/**
 * Only actions the console already has: escalate opens the ITSM composer,
 * investigate opens Sentinel, dismiss is the existing close.
 */
export interface Recommendation {
  kind: 'escalate' | 'investigate' | 'dismiss';
  title: string;
  why: string;
  effect: string;
  /** Close classification, for dismiss. */
  closeAs?: string[];
}

/**
 * What an evidence item does to the assessment. In production the agent has to
 * emit this with each item; deriving it by reading the sentence would be
 * guesswork. `unconfirmed` covers both "looked and found nothing" and "could
 * not look" — neither is proof of safety, which `caveat` says in words.
 */
export type EvidenceStatus = 'suspicious' | 'benign' | 'unconfirmed' | 'context';

export interface EvidenceItem {
  /** The agent's original text, verbatim. Always reachable in the panel. */
  text: string;
  status: EvidenceStatus;
  /** Shorter wording for long items, built only from the original's words. */
  summary?: string;
  caveat?: string;
}

/**
 * Pairs the agent's evidence strings with their status, so the original text
 * is referenced rather than retyped. Throws on a count mismatch rather than
 * pairing a status with the wrong item.
 */
function withStatus(texts: string[], meta: Omit<EvidenceItem, 'text'>[]): EvidenceItem[] {
  if (texts.length !== meta.length) throw new Error(`evidence: ${texts.length} items, ${meta.length} statuses`);
  return texts.map((text, i) => ({ text, ...meta[i] }));
}

export interface Analysis {
  verdict: Verdict;
  confidence: number;
  threshold: number;
  /** What the threshold governs, mid-sentence. */
  thresholdGoverns: string;
  metrics: Metric[];
  happened: string;
  supports: string;
  unconfirmed: string;
  /** Evidence the agent could not get. Present → the panel says so up front. */
  gaps?: string[];
  findings: Finding[];
  recommendation: Recommendation;
  evidence: EvidenceItem[];
  changelog: string[];
}

export interface RedesignIncident
  extends Pick<TriageIncident, 'id' | 'number' | 'title' | 'client' | 'status' | 'type' | 'created' | 'entities' | 'mitre' | 'alert' | 'similar'> {
  severity: Severity;
  /** 'none' and 'error' reveal `analysis` only after the analyst runs it. */
  analysisState: 'done' | 'none' | 'error';
  error?: string;
  analysis: Analysis;
}

const base = (id: string) => {
  const { verdict, confidence, threshold, summary, summaryFull, malicious, benign, conclusion, checks, action, evidence, changelog, ...rest } =
    TRIAGE_INCIDENTS.find(i => i.id === id)!;
  return { context: rest, evidence, changelog, malicious, benign };
};

const b14310 = base('inc-14310');
const b14287 = base('inc-14287');
const b14352 = base('inc-14352');

export const REDESIGN_INCIDENTS: RedesignIncident[] = [
  {
    ...b14310.context,
    analysisState: 'done',
    analysis: {
      verdict: 'TruePositive',
      confidence: 60,
      threshold: 80,
      thresholdGoverns: 'automated containment',
      metrics: [
        { value: '603', label: 'failed sign-ins in 7 days', tone: 'suspicious' },
        { value: '218', label: 'distinct source IPs', tone: 'suspicious' },
        { value: '0', label: 'successful interactive sign-ins', tone: 'benign' },
      ],
      happened: 'Distributed password guessing against hello@seculyze.com, with account lockouts, from 25 Oct to 1 Nov.',
      supports: 'An external password-spray campaign, partly from IPs the tenant has already blocked.',
      unconfirmed: 'Account takeover. No successful interactive sign-in and no password, MFA or role change was found.',
      findings: [
        { tone: 'suspicious', key: true, title: '603 failed sign-ins from 218 IPs', line: '7 days, first seen 25 Oct, last seen 1 Nov', detail: b14310.malicious[0].text },
        { tone: 'suspicious', key: true, title: 'Sources already blocked in the tenant', line: '61.73.190.98, 196.216.81.126, 103.55.89.5 and others', detail: b14310.malicious[3].text },
        { tone: 'benign', key: true, title: 'No successful interactive sign-in', line: 'None returned for the last 7 days', detail: b14310.benign[0].text },
        { tone: 'suspicious', title: '62 failures, 0 successes in the rule window', line: 'The analytic rule’s 24-hour window', detail: b14310.malicious[1].text },
        { tone: 'suspicious', title: 'Lockout and invalid-credential codes', line: 'Result codes 50053 and 50126', detail: b14310.malicious[2].text },
        { tone: 'suspicious', title: 'Dozens of countries, many /16 subnets', line: 'Not one mistyped source', detail: b14310.malicious[4].text },
        { tone: 'benign', title: 'Stable normal environment', line: 'Windows10 for 95% of sign-ins, two usual subnets', detail: b14310.benign[1].text },
        { tone: 'benign', title: 'Some IPs in a known ASN', line: 'ASN 26599 has earlier successful logins by this user', detail: b14310.benign[2].text },
        { tone: 'benign', title: 'Recurring targeting', line: '46 earlier alerts from this rule on this user', detail: b14310.benign[3].text },
      ],
      recommendation: {
        kind: 'escalate',
        title: 'Escalate for investigation',
        why: 'The attack is real and ongoing, but nothing shows the account was taken over. Confidence is 60%, below the 80% threshold for automated containment, so containment did not run and is a call for a person.',
        effect: 'Opens an ITSM ticket prefilled with this assessment. The incident stays open.',
      },
      evidence: withStatus(b14310.evidence, [
        { status: 'suspicious', summary: '603 failed interactive sign-ins for hello@seculyze.com in the last 7 days from 218 distinct IPs' },
        { status: 'suspicious', summary: '62 failures and 0 successes for hello@seculyze.com inside the rule’s 24-hour window, across many /16s' },
        { status: 'suspicious', summary: 'Result codes 50053 (account locked after repeated wrong password) and 50126 (invalid credentials)' },
        { status: 'suspicious', summary: 'Source IPs 61.73.190.98, 196.216.81.126, 103.55.89.5 are labelled in tenant history as blocked for malicious activity' },
        { status: 'suspicious', summary: 'Sign-ins span dozens of countries and user agents, unlike the user’s usual Windows10 + a small set of subnets' },
        {
          status: 'unconfirmed',
          summary: 'No successful interactive sign-ins (last 7 days) and no password/MFA/role changes found for hello@seculyze.com',
          caveat: 'Not found in the checked windows — this is not proof the account is safe.',
        },
        { status: 'context', summary: 'The same analytic rule fired 46 times on this user in recent days' },
      ]),
      changelog: b14310.changelog,
    },
  },

  {
    ...b14287.context,
    analysisState: 'done',
    analysis: {
      verdict: 'FalsePositive',
      confidence: 78,
      threshold: 80,
      thresholdGoverns: 'automatic closing',
      metrics: [
        { value: '3', label: 'earlier days with this ASN', tone: 'benign' },
        { value: '14', label: 'sign-ins in 7 days, usual pattern', tone: 'benign' },
        { value: '1', label: 'first-seen IP, unmanaged device', tone: 'suspicious' },
      ],
      happened: 'tomislav@seculyze.com signed in with MFA from ASN 12830, which the rule flagged as new.',
      supports: 'A false positive: the ASN appears on three earlier days and the account behaves as usual.',
      unconfirmed: 'Whether the unmanaged device on the first-seen IP belongs to the user.',
      findings: [
        { tone: 'benign', key: true, title: 'ASN seen before', line: 'ASN 12830 on 3, 5 and 11 Oct', detail: b14287.benign[2].text },
        { tone: 'benign', key: true, title: 'Conditional Access and MFA passed', line: 'Policy “MFA - All”, satisfied by token claim', detail: b14287.benign[0].text },
        { tone: 'suspicious', key: true, title: 'New IP on the day', line: '95.168.123.186, first seen today, 30 events', detail: b14287.malicious[0].text },
        { tone: 'suspicious', title: 'Device not compliant or managed', line: 'isCompliant and isManaged are both false', detail: b14287.malicious[1].text },
        { tone: 'benign', title: 'Normal account activity', line: '14 sign-ins from 3 IPs, active 13 of 14 days', detail: b14287.benign[1].text },
        { tone: 'benign', title: 'Known user environment', line: 'Windows 10, Firefox 159, 3 known IPs', detail: b14287.benign[3].text },
      ],
      recommendation: {
        kind: 'dismiss',
        title: 'Close as false positive',
        why: 'The rule’s “new ASN” logic is wrong for this user. Confidence is 78%, just under the 80% threshold for automatic closing, so the close needs your confirmation.',
        effect: 'Closes the incident as false_positive / incorrect_alert_logic. You can undo it.',
        closeAs: ['false_positive', 'incorrect_alert_logic'],
      },
      evidence: withStatus(b14287.evidence, [
        { status: 'benign' },
        { status: 'benign' },
        { status: 'benign' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'context' },
      ]),
      changelog: b14287.changelog,
    },
  },

  {
    ...b14352.context,
    analysisState: 'done',
    analysis: {
      verdict: 'TruePositive',
      confidence: 91,
      threshold: 80,
      thresholdGoverns: 'automated containment',
      metrics: [
        { value: '1,284', label: 'Finance files downloaded in 9 min', tone: 'suspicious' },
        { value: '41 min', label: 'Copenhagen → Frankfurt (Tor exit)', tone: 'suspicious' },
        { value: '2', label: 'persistence changes made', tone: 'suspicious' },
      ],
      happened: 'finance-ops@seculyze.com signed in from a Tor exit node 41 minutes after a Copenhagen sign-in, then downloaded 1,284 Finance files.',
      supports: 'A stolen session token used for data theft, with persistence added: an inbox rule and an OAuth app consent.',
      unconfirmed: 'Which of the downloaded files left the tenant.',
      findings: [
        { tone: 'suspicious', key: true, title: 'Impossible travel', line: 'Copenhagen 09:21 → Frankfurt 10:02, 650 km', detail: b14352.malicious[0].text },
        { tone: 'suspicious', key: true, title: '1,284 files downloaded in 9 minutes', line: 'Against a 30-day daily average of 14', detail: b14352.malicious[2].text },
        { tone: 'suspicious', key: true, title: 'OAuth consent to an unverified app', line: '“DocSync Pro” with Files.Read.All', detail: b14352.malicious[6].text },
        { tone: 'suspicious', title: 'Source is a Tor exit node', line: '185.220.101.44, 312 threat-intel reports', detail: b14352.malicious[1].text },
        { tone: 'suspicious', title: 'New user agent', line: 'python-requests/2.31, never seen for this account', detail: b14352.malicious[3].text },
        { tone: 'suspicious', title: 'MFA satisfied by a replayed token', line: 'Claim is 3h 10m older than the session', detail: b14352.malicious[4].text },
        { tone: 'suspicious', title: 'Inbox rule created', line: '“Archive” hides messages containing “invoice”', detail: b14352.malicious[5].text },
        { tone: 'suspicious', title: 'Download from unmanaged device', line: 'Not compliant, not managed', detail: b14352.malicious[7].text },
        { tone: 'benign', title: 'Shared service mailbox', line: 'Four people use it; some location spread is normal', detail: b14352.benign[0].text },
        { tone: 'benign', title: 'Month-end close', line: 'Finance downloads spike in this window', detail: b14352.benign[1].text },
      ],
      recommendation: {
        kind: 'escalate',
        title: 'Escalate to remove persistence and assess data loss',
        why: 'Confidence is 91%, above the 80% threshold, so sessions were already revoked automatically. The inbox rule, the app consent and what data left the tenant still need a person.',
        effect: 'Opens an ITSM ticket prefilled with this assessment. The incident stays open.',
      },
      evidence: withStatus(b14352.evidence, [
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
      ]),
      changelog: b14352.changelog,
    },
  },

  {
    id: 'inc-14360',
    number: '14360',
    title: 'Inbox forwarding rule to external address',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'Collection',
    created: '12m ago',
    entities: [{ name: 'j.berg@seculyze.com', type: 'Account' }],
    mitre: [{ tactic: 'Collection', technique: 'T1114.003 Email Forwarding Rule' }],
    alert: {
      title: 'Inbox forwarding rule to external address',
      description: 'A mailbox rule was created that forwards mail to a domain outside the organisation.',
      time: '02/11/2026, 11:02:19',
    },
    similar: { total: 5, sameVerdict: 3 },
    analysisState: 'none',
    analysis: {
      verdict: 'Undetermined',
      confidence: 45,
      threshold: 80,
      thresholdGoverns: 'any automated action',
      metrics: [
        { value: '1', label: 'rule forwarding all mail externally', tone: 'suspicious' },
        { value: '3 days', label: 'age of the destination domain', tone: 'suspicious' },
        { value: 'Unknown', label: 'messages forwarded (logs missing)', tone: 'neutral' },
      ],
      happened: 'j.berg@seculyze.com created a rule forwarding all mail to ops@mailbox-sync.co.',
      supports: 'Possibly malicious: the destination domain was registered 3 days ago. The rule came from the user’s usual, managed laptop.',
      unconfirmed: 'Whether any mail was forwarded, and whether the user created the rule knowingly.',
      gaps: [
        'MailItemsAccessed logs are missing for 30 Oct – 1 Nov, so whether mail was forwarded is unknown.',
        'No 30-day sign-in baseline: the account is 9 days old.',
      ],
      findings: [
        { tone: 'suspicious', key: true, title: 'New external forwarding rule', line: 'Forwards all mail to ops@mailbox-sync.co', detail: 'New-InboxRule "Sync" created at 10:58 with ForwardTo ops@mailbox-sync.co and no conditions, so it applies to every incoming message.' },
        { tone: 'suspicious', key: true, title: 'Destination domain is 3 days old', line: 'mailbox-sync.co registered 30 Oct 2026', detail: 'WHOIS for mailbox-sync.co shows a registration date of 2026-10-30 through a privacy-protected registrar; no threat-intel matches yet.' },
        { tone: 'benign', key: true, title: 'Created from the user’s usual laptop', line: 'LT-0188, compliant and managed', detail: 'The rule was created in a session from LT-0188, the user’s Intune-managed, compliant laptop, from the office IP range.' },
        { tone: 'benign', title: 'Sign-in passed MFA', line: 'Authenticator push, approved on the registered phone', detail: 'The session that created the rule began with an MFA-satisfied sign-in using the Authenticator app on the user’s registered device.' },
      ],
      recommendation: {
        kind: 'investigate',
        title: 'Investigate before deciding',
        why: 'Evidence is incomplete and confidence (45%) is too low to escalate or close. The missing mail-access logs are what would settle it.',
        effect: 'Opens the incident in Microsoft Sentinel, where you can query mail activity directly.',
      },
      evidence: withStatus([
        'New-InboxRule "Sync" created at 10:58 on j.berg@seculyze.com, ForwardTo ops@mailbox-sync.co, no conditions.',
        'mailbox-sync.co registered 2026-10-30, privacy-protected registrar, no threat-intel matches.',
        'Creating session from LT-0188 (Intune-managed, compliant) on the office IP range, MFA satisfied by Authenticator push.',
        'MailItemsAccessed returned no data for 2026-10-30 to 2026-11-01 (ingestion gap on the connector).',
      ], [
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'benign' },
        { status: 'unconfirmed', caveat: 'Missing data — it is unknown whether mail was forwarded, not that none was.' },
      ]),
      changelog: ['Resolve analysed this incident on request', 'Triage undetermined at 45% confidence; two evidence gaps recorded'],
    },
  },

  {
    id: 'inc-14371',
    number: '14371',
    title:
      'Multiple failed MFA challenges followed by a successful sign-in from an anonymising VPN provider for a privileged Azure subscription owner account',
    client: 'Seculyze',
    severity: 'High',
    status: 'New',
    type: 'CredentialAccess',
    created: '6m ago',
    entities: [
      { name: 'a.nielsen-admin@seculyze.com', type: 'Account' },
      { name: '89.187.171.20', type: 'IP' },
    ],
    mitre: [
      { tactic: 'CredentialAccess', technique: 'T1621 Multi-Factor Authentication Request Generation' },
      { tactic: 'InitialAccess', technique: 'T1078.004 Cloud Accounts' },
    ],
    alert: {
      title: 'MFA fatigue followed by successful sign-in',
      description: 'Repeated MFA denials for one account followed by an approved challenge.',
      time: '02/11/2026, 11:09:51',
    },
    similar: { total: 4, sameVerdict: 3 },
    analysisState: 'error',
    error: 'Analysis did not finish: the SigninLogs query timed out after 10 minutes.',
    analysis: {
      verdict: 'TruePositive',
      confidence: 72,
      threshold: 80,
      thresholdGoverns: 'automated containment',
      metrics: [
        { value: '9', label: 'MFA challenges denied in 6 min', tone: 'suspicious' },
        { value: '1', label: 'successful sign-in via VPN exit', tone: 'suspicious' },
        { value: '2', label: 'subscriptions with Owner role', tone: 'neutral' },
      ],
      happened: 'After 9 denied MFA challenges, a.nielsen-admin@seculyze.com signed in successfully through a commercial VPN exit.',
      supports: 'MFA fatigue that ended in a successful sign-in on a privileged account.',
      unconfirmed: 'Whether the user approved the last prompt knowingly, and what was done in the subscriptions after sign-in.',
      findings: [
        { tone: 'suspicious', key: true, title: '9 MFA challenges denied in 6 minutes', line: '11:01–11:07, then one approved', detail: 'SigninLogs show 9 sign-in attempts with result 500121 (MFA denied by user) between 11:01 and 11:07, followed by a success at 11:08 after an approved push.' },
        { tone: 'suspicious', key: true, title: 'Success came through a VPN exit', line: '89.187.171.20, commercial VPN range', detail: '89.187.171.20 belongs to a commercial VPN provider’s exit range; the account has no earlier sign-ins from VPN ranges.' },
        { tone: 'benign', key: true, title: 'Sign-in time matches the user’s pattern', line: '11:08, user is usually active 07:00–17:00', detail: 'The successful sign-in at 11:08 falls inside the account’s usual working hours over the last 30 days.' },
        { tone: 'suspicious', title: 'Unregistered device', line: 'Windows device not known to Intune', detail: 'DeviceDetail.deviceId is empty and the device is neither compliant nor managed.' },
      ],
      recommendation: {
        kind: 'escalate',
        title: 'Escalate now',
        why: 'A privileged account may be compromised. Confidence is 72%, below the 80% threshold for automated containment, so containment did not run; waiting for more evidence costs more than escalating.',
        effect: 'Opens an ITSM ticket prefilled with this assessment. The incident stays open.',
      },
      evidence: withStatus([
        '9 sign-in attempts with result 500121 between 11:01 and 11:07 for a.nielsen-admin@seculyze.com.',
        'Successful sign-in at 11:08 from 89.187.171.20 (commercial VPN exit) after an approved Authenticator push.',
        'Device for the successful sign-in has no device ID and is not compliant or managed.',
        'The account holds the Owner role on two subscriptions (prod-core, prod-data).',
      ], [
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'context' },
      ]),
      changelog: ['First analysis failed: SigninLogs query timed out', 'Triage settled as true positive at 72% confidence; below the 80% containment threshold'],
    },
  },
];
