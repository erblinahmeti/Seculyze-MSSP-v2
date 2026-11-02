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
//     `key` marks the few shown before "Show all". Key findings never restate
//     a metric tile: the tiles already carry those numbers, so the key slots go
//     to what the tiles don't show, including the strongest counter-evidence.
//     In production the agent would have to rank these, the panel cannot.
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

/**
 * A finding is the AI's interpretation, not a restatement of evidence:
 * `title` says what was detected, `line` the one fact that shows it, `why`
 * what it means for the verdict. `detail` keeps the agent's original
 * indicator text, verbatim.
 *
 * `inconclusive` is for absence of evidence ("no sign-in found", "no
 * threat-intel hits"): it is never benign, because not finding something is
 * not proof it didn't happen.
 */
export interface Finding {
  title: string;
  line: string;
  why: string;
  detail: string;
  tone: 'suspicious' | 'benign' | 'inconclusive';
  key?: boolean;
}

/**
 * One check the analysis ran, or meant to run. Mirrors what the earlier
 * Resolve output exposed — query name, source, ok/skipped, row count — and
 * nothing more: no purpose, time range or row data, because no output seen so
 * far carries them. The panel shows what is present and says what isn't.
 *
 * The states are deliberately distinct. `completed` with `rows: 0` means the
 * query ran and matched nothing; `skipped`, `failed` and `unavailable` mean it
 * produced no answer at all, which must never read as "nothing found".
 */
export interface InvestigationQuery {
  /** The technical query name, shown as-is for L2 analysts. */
  id: string;
  /** A readable name, only when the output provides one. */
  title?: string;
  status: 'completed' | 'skipped' | 'failed' | 'unavailable';
  /** Rows returned, when reported. */
  rows?: number;
  /** The raw reason the output gave, e.g. requires_unmet. */
  reason?: string;
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
  /** Absent when the analysis didn't report which queries ran. */
  queries?: InvestigationQuery[];
  /** Where the queries ran, when reported. */
  querySource?: string;
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
        { tone: 'suspicious', title: 'Distributed authentication attack', line: '603 failed sign-ins from 218 IPs over 7 days', why: 'Failures spread across this many addresses point to coordinated password guessing, not a user mistyping a password.', detail: b14310.malicious[0].text },
        { tone: 'suspicious', key: true, title: 'Sources already blocked in the tenant', line: '61.73.190.98, 196.216.81.126, 103.55.89.5 and others', why: 'These IPs were already flagged as malicious in this tenant, which ties the activity to known attacker infrastructure.', detail: b14310.malicious[3].text },
        { tone: 'inconclusive', title: 'No successful interactive sign-in', line: 'None found in the last 7 days', why: 'There is no evidence of a takeover — but finding nothing in these logs is not proof the account is safe.', detail: b14310.benign[0].text },
        { tone: 'suspicious', title: '62 failures, 0 successes in the rule window', line: 'The analytic rule’s 24-hour window', why: 'The burst that triggered the rule produced no successful sign-in: consistent with an attack that has not worked so far.', detail: b14310.malicious[1].text },
        { tone: 'suspicious', key: true, title: 'Lockout and invalid-credential codes', line: 'Result codes 50053 and 50126', why: 'Lockouts show wrong passwords being tried against the real account, which also disrupts the user.', detail: b14310.malicious[2].text },
        { tone: 'suspicious', title: 'Dozens of countries, many /16 subnets', line: 'Not one mistyped source', why: 'One user cannot sign in from this many networks, which rules out a single misconfigured device as the source.', detail: b14310.malicious[4].text },
        { tone: 'benign', key: true, title: 'Stable normal environment', line: 'Windows10 for 95% of sign-ins, two usual subnets', why: 'The user’s own sign-ins look normal, which separates them from the attack traffic rather than implicating them.', detail: b14310.benign[1].text },
        { tone: 'benign', title: 'Some IPs in a known ASN', line: 'ASN 26599 has earlier successful logins by this user', why: 'Not every source IP is necessarily hostile, so blocking all of them could also block the user.', detail: b14310.benign[2].text },
        { tone: 'benign', title: 'Recurring targeting', line: '46 earlier alerts from this rule on this user', why: 'This account is a repeat target, which raises urgency; repeated alerts alone do not show a compromise.', detail: b14310.benign[3].text },
      ],
      recommendation: {
        kind: 'escalate',
        title: 'Escalate for investigation',
        why: 'The attack is real and ongoing, but nothing shows the account was taken over. Confidence is 60%, below the 80% threshold for automated containment, so containment did not run and is a call for a person.',
        effect: 'Opens an ITSM ticket prefilled with this assessment. The incident stays open.',
      },
      evidence: withStatus(b14310.evidence, [
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        { status: 'suspicious' },
        {
          status: 'unconfirmed',
          caveat: 'Not found in the checked windows — this is not proof the account is safe.',
        },
        { status: 'context' },
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
        { tone: 'benign', title: 'ASN seen before', line: 'ASN 12830 on 3, 5 and 11 Oct', why: 'The rule’s “new ASN” trigger is wrong for this user, which removes the main reason the alert fired.', detail: b14287.benign[2].text },
        { tone: 'benign', key: true, title: 'Conditional Access and MFA passed', line: 'Policy “MFA - All”, satisfied by token claim', why: 'The sign-in passed the tenant’s MFA policy, so a stolen password alone would not have been enough.', detail: b14287.benign[0].text },
        { tone: 'suspicious', title: 'New IP on the day', line: '95.168.123.186, first seen today, 30 events', why: 'The first-seen IP is the one genuinely new element, and the main reason confidence is not higher.', detail: b14287.malicious[0].text },
        { tone: 'suspicious', key: true, title: 'Device not compliant or managed', line: 'isCompliant and isManaged are both false', why: 'An unmanaged device cannot be tied to the user with certainty, which keeps some risk open.', detail: b14287.malicious[1].text },
        { tone: 'benign', title: 'Normal account activity', line: '14 sign-ins from 3 IPs, active 13 of 14 days', why: 'Volume and pattern match the user’s routine, with no burst after this sign-in.', detail: b14287.benign[1].text },
        { tone: 'benign', key: true, title: 'Known user environment', line: 'Windows 10, Firefox 159, 3 known IPs', why: 'Same OS and browser as the user’s other sign-ins, consistent with the user themself.', detail: b14287.benign[3].text },
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
        { tone: 'suspicious', title: 'Impossible travel', line: 'Copenhagen 09:21 → Frankfurt 10:02, 650 km', why: 'No one covers 650 km in 41 minutes, so two different parties used this account.', detail: b14352.malicious[0].text },
        { tone: 'suspicious', title: '1,284 files downloaded in 9 minutes', line: 'Against a 30-day daily average of 14', why: 'Far above the account’s daily average, in minutes rather than a working day: consistent with bulk collection.', detail: b14352.malicious[2].text },
        { tone: 'suspicious', title: 'OAuth consent to an unverified app', line: '“DocSync Pro” with Files.Read.All', why: 'Gives an outside app ongoing read access to all files, which survives a password reset.', detail: b14352.malicious[6].text },
        { tone: 'suspicious', key: true, title: 'Source is a Tor exit node', line: '185.220.101.44, 312 threat-intel reports', why: 'Tor hides who is behind the sign-in; legitimate finance work rarely comes from it.', detail: b14352.malicious[1].text },
        { tone: 'suspicious', title: 'New user agent', line: 'python-requests/2.31, never seen for this account', why: 'A scripting library rather than a browser suggests automated downloading.', detail: b14352.malicious[3].text },
        { tone: 'suspicious', key: true, title: 'MFA satisfied by a replayed token', line: 'Claim is 3h 10m older than the session', why: 'The MFA claim came from another device at an earlier time, pointing to a stolen session token rather than a fresh login.', detail: b14352.malicious[4].text },
        { tone: 'suspicious', title: 'Inbox rule created', line: '“Archive” hides messages containing “invoice”', why: 'Hiding invoice emails keeps an attacker’s activity out of sight, and the rule outlives revoked sessions.', detail: b14352.malicious[5].text },
        { tone: 'suspicious', title: 'Download from unmanaged device', line: 'Not compliant, not managed', why: 'The files went to a device the organisation does not control.', detail: b14352.malicious[7].text },
        { tone: 'benign', key: true, title: 'Shared service mailbox', line: 'Four people use it; some location spread is normal', why: 'Shared use explains some location spread, so impossible travel alone would be weaker here.', detail: b14352.benign[0].text },
        { tone: 'benign', title: 'Month-end close', line: 'Finance downloads spike in this window', why: 'Explains a download spike in general, but not one through Tor from a scripting client.', detail: b14352.benign[1].text },
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
        { tone: 'suspicious', title: 'New external forwarding rule', line: 'Forwards all mail to ops@mailbox-sync.co', why: 'Forwarding all mail outside the organisation is a classic data-theft setup, whoever created it.', detail: 'New-InboxRule "Sync" created at 10:58 with ForwardTo ops@mailbox-sync.co and no conditions, so it applies to every incoming message.' },
        { tone: 'suspicious', title: 'Destination domain is 3 days old', line: 'mailbox-sync.co registered 30 Oct 2026', why: 'Newly registered domains are often attacker-run; this one has no reputation either way yet.', detail: 'WHOIS for mailbox-sync.co shows a registration date of 2026-10-30 through a privacy-protected registrar; no threat-intel matches yet.' },
        { tone: 'benign', key: true, title: 'Created from the user’s usual laptop', line: 'LT-0188, compliant and managed', why: 'The rule came from the user’s own managed device, pointing to the user — knowingly or tricked — rather than an outside attacker.', detail: 'The rule was created in a session from LT-0188, the user’s Intune-managed, compliant laptop, from the office IP range.' },
        { tone: 'benign', key: true, title: 'Sign-in passed MFA', line: 'Authenticator push, approved on the registered phone', why: 'The session behind the rule was properly authenticated, which weakens a stolen-credentials explanation.', detail: 'The session that created the rule began with an MFA-satisfied sign-in using the Authenticator app on the user’s registered device.' },
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
        { tone: 'suspicious', title: '9 MFA challenges denied in 6 minutes', line: '11:01–11:07, then one approved', why: 'Prompts the user keeps denying, then one approval, is the pattern of MFA fatigue: someone with the password pushing until it works.', detail: 'SigninLogs show 9 sign-in attempts with result 500121 (MFA denied by user) between 11:01 and 11:07, followed by a success at 11:08 after an approved push.' },
        { tone: 'suspicious', title: 'Success came through a VPN exit', line: '89.187.171.20, commercial VPN range', why: 'The approved sign-in came from an anonymising network this account has never used.', detail: '89.187.171.20 belongs to a commercial VPN provider’s exit range; the account has no earlier sign-ins from VPN ranges.' },
        { tone: 'benign', key: true, title: 'Sign-in time matches the user’s pattern', line: '11:08, user is usually active 07:00–17:00', why: 'Fits the user’s working hours — the only signal pointing to the user.', detail: 'The successful sign-in at 11:08 falls inside the account’s usual working hours over the last 30 days.' },
        { tone: 'suspicious', key: true, title: 'Unregistered device', line: 'Windows device not known to Intune', why: 'The successful session came from a device the organisation does not know.', detail: 'DeviceDetail.deviceId is empty and the device is neither compliant nor managed.' },
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

  // Transcribed from a real Resolve output (the earlier AI analysis prototype):
  // evidence, indicators, gaps, query names and row counts are as shown there.
  // Incident number, severity, created time, MITRE and the 75% threshold are
  // placeholders — that output didn't show them. user_baseline_profile's row
  // count was cut off in the source, so it is left unreported.
  {
    id: 'inc-14388',
    number: '14388',
    title: 'Credentials added to multiple applications',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'Persistence',
    created: '2d ago',
    entities: [
      { name: 'kristian@seculyze.com', type: 'Account' },
      { name: '188.179.84.12', type: 'IP' },
    ],
    mitre: [{ tactic: 'Persistence', technique: 'T1098.001 Additional Cloud Credentials' }],
    alert: {
      title: 'Credentials added to multiple applications',
      description: 'A user added client secrets to several application registrations in a short window.',
      time: '31/10/2026, 10:26:19',
    },
    similar: { total: 16, sameVerdict: 16 },
    analysisState: 'done',
    analysis: {
      verdict: 'FalsePositive',
      confidence: 76,
      threshold: 75,
      thresholdGoverns: 'automatic closing',
      metrics: [
        { value: '32', label: 'client secrets this user added in 90 days', tone: 'benign' },
        { value: '31,443', label: 'logins from 188.179.84.12 in 30 days', tone: 'benign' },
        { value: '0', label: 'threat-intel hits for the IP', tone: 'neutral' },
      ],
      happened: 'kristian@seculyze.com added client secrets to multiple applications from 188.179.84.12.',
      supports: 'Routine administrative work: the user adds credentials regularly, from their usual Danish subnet, to applications that already had credentials.',
      unconfirmed: 'Per-application credential history, device and process baselines, and whether the same secret appears on other devices — those checks were skipped.',
      findings: [
        { tone: 'benign', title: 'Routine credential additions', line: '32 client secrets in the past 90 days', why: 'Adding secrets is normal work for this user, so this burst is in character.', detail: 'User kristian@seculyze.com routinely added credentials: 32 client secrets in the past 90 days' },
        { tone: 'benign', key: true, title: 'Applications already had credentials', line: 'oldValue lists were non-empty before the adds', why: 'Adding to apps that already had secrets fits rotation or maintenance, not an attacker planting a first backdoor.', detail: 'Target applications already had Verify credentials before this add (oldValue lists non-empty)' },
        { tone: 'benign', key: true, title: 'Usual country and subnet', line: 'Denmark 97.8%, 188.179.84.0/24 87.4% of sign-ins', why: 'The change came from where this user works almost all the time.', detail: 'User kristian’s sign-ins come almost exclusively from Denmark and subnet 188.179.84.0/24 in the 30 days up to the check (Country 97.8%, Subnet 87.4%)' },
        { tone: 'benign', title: 'Corporate IP, heavily used by the tenant', line: 'ASN 3292 (TDC, DK)', why: 'A shared corporate address rather than a new or external one.', detail: 'The initiating IP 188.179.84.12 is in ASN 3292 (TDC, DK) and is heavily used by the tenant (31,443 logins in the 30 days up to the check)' },
        { tone: 'inconclusive', title: 'No threat-intel hits for the IP', line: 'Lookups for 188.179.84.12 returned nothing', why: 'No match in threat intel only means nothing is known against the IP — not that it is clean.', detail: 'Threat intelligence lookups for the observed IP returned no hits' },
      ],
      recommendation: {
        kind: 'dismiss',
        title: 'Close as false positive',
        why: 'The credential additions match this user’s routine and came from their usual subnet. Three checks were skipped, so the verdict rests on baselines rather than per-application history.',
        effect: 'Closes the incident as false_positive / incorrect_alert_logic. You can undo it.',
        closeAs: ['false_positive', 'incorrect_alert_logic'],
      },
      evidence: withStatus(
        [
          'Credentials added by actor (90 days): Actor kristian@seculyze.com added 32 credentials (32 client secrets), across 4 applications, with MaxPriorCreds 5 and FirstCredAdds 0; IPs used: 185.168.245.46 and 188.179.84.12; ActiveDays: 5; FirstSeen: 2026-08-10T13:40:05.7183004Z; LastSeen: 2026-10-31T11:09:13.0124478Z (90 days up to the check (ago(90d) .. check))',
          'Audit events in alert window: Multiple successful Update application / Certificates and secrets management events by user kristian@seculyze.com from 188.179.84.12 targeting SentinelDev.KeyVault.Test and SentinelDev.Sub_Dev.Role_SentinelContributor_LogAnalyticsReader; key names in window include sdsads and kvtest01 (alert window (2026-10-31T10:26:19 .. 2026-10-31T11:26:20))',
          'Application had existing credentials: Target applications’ oldKey lists were non-empty before the adds (oldValue arrays present for KeyDescription), showing prior Verify credentials already existed (alert window (2026-10-31T10:26:19 .. 2026-10-31T11:26:20))',
          'Sign-ins from the initiating IP (7 days): 188.179.84.12 had 89 sign-in events in the 7 days up to the check: 81 successes, 8 failures, DistinctUsers 1 (7 days up to the check)',
          'User environment baseline (30 days): User kristian@seculyze.com: Country DK accounted for 97.8% of their sign-ins, subnet 188.179.84.0/24 accounted for 87.4% of their sign-ins, operating system Windows10 72% (30 days up to the check)',
          'IP authentication baseline (30 days): Address 188.179.84.12 recorded 31,443 logins in the 30 days up to the check and was used by users including kristian@seculyze.com and admin@seculyze.onmicrosoft.com; first seen 2026-10-03T08:16:15.9914456Z, last seen 2026-11-02T08:13:36.006398Z (30 days up to the check)',
          'IP activity across authentication sources (14 days): 188.179.84.12 had 16,841 authentication events and 84 distinct users in the 14 days up to the check; many service principals and apps used this IP (14 days up to the check)',
          'User authentication activity (14 days): User kristian@seculyze.com had 16,863 authentication events and 54 distinct source IPs in the 14 days up to the check (14 days up to the check)',
          'Platform model and threat intel: Platform ML leaned false positive and threat-intel lookups returned no hits for the observed IP; platform applied a FalsePositive attention tag',
          'Prior similar alerts: 16 earlier similar alerts involving the same user or IP were recorded and were tagged FalsePositive by the platform; examples include incidents 2779, 2769, 2758 (examples dated between 2026-10-28 and 2026-11-01)',
        ],
        [
          { status: 'benign' },
          { status: 'context' },
          { status: 'benign' },
          { status: 'benign' },
          { status: 'benign' },
          { status: 'benign' },
          { status: 'context' },
          { status: 'context' },
          { status: 'context' },
          { status: 'context' },
        ],
      ),
      querySource: 'Log Analytics',
      queries: [
        { id: 'app_changes_in_window', status: 'completed', rows: 28 },
        { id: 'app_credential_adds_by_caller', status: 'completed', rows: 1 },
        { id: 'asim_ip_auth_baseline', status: 'completed', rows: 1 },
        { id: 'asim_user_auth_baseline', status: 'completed', rows: 1 },
        { id: 'device_connections_for_ip', status: 'completed', rows: 0 },
        { id: 'directory_changes_for_account', status: 'completed', rows: 0 },
        { id: 'ip_baseline', status: 'completed', rows: 27 },
        { id: 'signins_for_ip', status: 'completed', rows: 1 },
        { id: 'user_baseline_profile', status: 'completed' },
        { id: 'app_credential_adds_by_application', title: 'Per-application credential history query', status: 'skipped', reason: 'requires_unmet' },
        { id: 'device_profile', title: 'Device profile and process baseline on hosts', status: 'skipped', reason: 'requires_unmet' },
        { id: 'process_baseline_on_host', title: 'Device profile and process baseline on hosts', status: 'skipped', reason: 'requires_unmet' },
        { id: 'same_hash_on_other_devices', title: 'Same secret hash on other devices', status: 'skipped', reason: 'requires_unmet' },
      ],
      changelog: [
        'Triage settled the alert as a confident false positive (confidence 0.76): User kristian@seculyze.com routinely added credentials: 32 client secrets in the past 90 days',
      ],
    },
  },
];
