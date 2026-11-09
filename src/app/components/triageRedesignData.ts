import { ALERT_QUERIES } from './triageQueries';

// ─── AI triage fixtures (Incidents · AI Triage B) ────────────────────────────
//
// An incident groups one or more alerts, and the AI analyses each alert on its
// own. So the panel reads in two levels:
//
//   incident overview   every alert on the incident, each with its verdict
//   AI triage           one alert at a time, in the order an analyst decides:
//                         what do I need to know   verdict, headline, 3 numbers
//                         what do I need to do     one card per action
//                         the rest                 what happened, how, findings,
//                                                  evidence, changelog
//
// All content is prototype mock data, modelled on the Resolve output.
//
// Text fields may carry **bold** spans for the figure an analyst scans for;
// the panel renders them, and EvidenceText still styles accounts, IPs and codes.

export type Verdict = 'TruePositive' | 'FalsePositive' | 'Undetermined';
export type Tone = 'suspicious' | 'benign' | 'neutral';
export type Severity = 'High' | 'Medium' | 'Low';

export interface Metric {
  value: string;
  label: string;
  tone: Tone;
}

/**
 * Which way a finding leans. `unclear` is for absence of evidence and checks
 * that produced no answer; it is never counted as pointing away.
 */
export type Lean = 'attack' | 'unclear' | 'away';

export interface Finding {
  id: string;
  lean: Lean;
  /** Number-led, e.g. "**603** failed sign-ins from **218** IPs in 7 days". */
  title: string;
  /** What it means for the verdict. */
  means: string;
  when?: string;
  /** Queries in this alert's evidence that back the finding. */
  queryIds?: string[];
}

/**
 * A recommended action the analyst approves or dismisses. Only actions the
 * console already has: a ticket, a notification, closing, opening Sentinel.
 */
export interface DecisionAction {
  id: string;
  kind: 'ticket' | 'notify' | 'close' | 'investigate';
  title: string;
  /** e.g. "ITSM", "Email". */
  channel: string;
  /** What happens to the incident, e.g. "incident stays open". */
  effect: string;
  target?: { label?: string; value: string };
  why: string;
  does: string;
  /** Close classification, for close. */
  closeAs?: string[];
}

/**
 * One investigation check. `completed` with `rows: 0` ran and matched nothing;
 * skipped, failed and unavailable produced no answer — never "nothing found".
 */
export interface InvestigationQuery {
  id: string;
  title: string;
  source: string;
  status: 'completed' | 'skipped' | 'failed' | 'unavailable';
  rows?: number;
  timeRange: string;
  purpose: string;
  /** A filter every row shares, shown once above the table. */
  scope?: { label: string; value: string };
  reason?: string;
  reasonText?: string;
  result?: { columns: string[]; rows: string[][] };
  kql: string;
}

export interface Analysis {
  verdict: Verdict;
  confidence: number;
  threshold: number;
  /** One sentence: what is going on and what is not. */
  headline: string;
  metrics: Metric[];
  happened: string[];
  how: string[];
  /** Evidence the agent could not get. */
  gaps?: string[];
  actions: DecisionAction[];
  /** Shown when there is nothing to decide on this alert. */
  noActionNote?: string;
  findings: Finding[];
  queries: InvestigationQuery[];
  footerNote?: string;
  changelog: string[];
}

export interface IncidentAlert {
  id: string;
  ref: string;
  title: string;
  description: string;
  time: string;
  severity: Severity;
  source: string;
  analysisState: 'done' | 'none' | 'error';
  error?: string;
  analysis: Analysis;
}

export interface RedesignIncident {
  id: string;
  number: string;
  title: string;
  client: string;
  severity: Severity;
  status: 'New' | 'Active';
  type: string;
  created: string;
  logs: number;
  entities: { name: string; type: string }[];
  mitre: { tactic: string; technique: string }[];
  similar: { total: number; sameVerdict: number };
  alerts: IncidentAlert[];
}

const SENTINEL = 'Microsoft Sentinel';
const NO_PLAYBOOK = 'No playbook is available for this scenario — install or enable a matching playbook in Microsoft Sentinel to run one from here.';

const ticket = (user: string, why: string): DecisionAction => ({
  id: 'ticket',
  kind: 'ticket',
  title: 'Create Ticket',
  channel: 'ITSM',
  effect: 'incident stays open',
  target: { label: 'user', value: user },
  why,
  does: 'Opens a ticket in the tenant’s ITSM system with this assessment, the affected entities and related alerts. The incident stays open.',
});
const notify = (to: string, why: string): DecisionAction => ({
  id: 'notify-' + to,
  kind: 'notify',
  title: 'Send Notification',
  channel: 'Email',
  effect: 'incident stays open',
  target: { value: to },
  why,
  does: `Sends a message by email to ${to}. The incident stays open.`,
});
const closeFp = (why: string): DecisionAction => ({
  id: 'close',
  kind: 'close',
  title: 'Close Incident',
  channel: 'Sentinel',
  effect: 'closes as false positive',
  target: { label: 'classification', value: 'false_positive' },
  why,
  does: 'Closes the incident as false_positive / incorrect_alert_logic. You can undo it.',
  closeAs: ['false_positive', 'incorrect_alert_logic'],
});

const q = (alertId: string) => ALERT_QUERIES[alertId];

const INCIDENTS: RedesignIncident[] = [
  // ── Password cracking: three alerts — one analysed, one failed, one not analysed ──
  {
    id: 'inc-14310',
    number: '14310',
    title: 'Distributed password cracking attempts in Microsoft Entra ID',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'CredentialAccess',
    created: '16h 51m ago',
    logs: 603,
    entities: [{ name: 'hello@seculyze.com', type: 'Account' }],
    mitre: [{ tactic: 'CredentialAccess', technique: 'T1110.003 Password Spraying' }],
    similar: { total: 20, sameVerdict: 20 },
    alerts: [
      {
        id: 'a-14310-1',
        ref: 'ALT-14310-1',
        title: 'Distributed password cracking attempts in Microsoft Entra ID',
        description: 'Identifies distributed password cracking attempts from the Microsoft Entra ID SigninLogs.',
        time: '01/11/2026, 00:32:58',
        severity: 'Medium',
        source: SENTINEL,
        analysisState: 'done',
        analysis: {
          verdict: 'TruePositive',
          confidence: 60,
          threshold: 80,
          headline: 'Distributed password guessing against hello@seculyze.com. No account takeover found in the checks performed.',
          metrics: [
            { value: '603', label: 'failed sign-ins in 7 days', tone: 'suspicious' },
            { value: '218', label: 'distinct source addresses', tone: 'suspicious' },
            { value: '0', label: 'successful interactive sign-ins', tone: 'neutral' },
          ],
          happened: [
            '**603** failed sign-ins from **218** addresses in 7 days',
            '**25 Oct 2026 → 1 Nov 2026** attack window',
            '**62** failures and **0** successes in the rule’s 24-hour window',
          ],
          how: [
            '**391** wrong-password failures (50126) and **212** lockouts (50053)',
            '**37** source addresses already on the tenant’s blocked list',
            '**Repeated** — the same rule fired on this user 46 times before',
          ],
          actions: [
            ticket('hello@seculyze.com', 'Distributed password-guessing campaign against hello@seculyze.com with repeated failures but no confirmed takeover. Open a ticket so responders can validate it and escalate containment if directory changes are found.'),
            notify('security-team@seculyze.com', 'Confidence is 60%, below the 80% threshold for automated containment, so containment did not run. Notify the SOC on-call so someone can approve it if takeover evidence appears.'),
          ],
          findings: [
            { id: 'spread', lean: 'attack', title: '**603** failed sign-ins from **218** addresses in 7 days', means: 'Failures spread across this many addresses show coordinated password guessing against hello@seculyze.com, not a user mistyping a password.', when: '2026-10-25T09:12:40 → 2026-11-01T13:29:58 UTC', queryIds: ['failed_signins_for_account'] },
            { id: 'blocked', lean: 'attack', title: '**37** source addresses already blocked in the tenant', means: 'These addresses were flagged as malicious here before, which ties the activity to known attacker infrastructure.', queryIds: ['tenant_blocked_ips'] },
            { id: 'codes', lean: 'attack', title: '**212** lockouts (50053) and **391** wrong-password failures (50126)', means: 'Wrong passwords are being tried against the real account, often enough to lock it.', queryIds: ['signin_result_codes'] },
            { id: 'subnets', lean: 'attack', title: '**41** /16 subnets in the rule window, **0** successes', means: 'One user can’t sign in from this many networks, which rules out a single misconfigured device.', when: '2026-10-31T13:30:10 → 2026-11-01T13:30:11 UTC', queryIds: ['failed_signins_by_subnet'] },
            { id: 'repeat', lean: 'unclear', title: '**46** earlier alerts from this rule on this user', means: 'A repeat target raises urgency, but repeated alerts alone don’t show a compromise.', queryIds: ['prior_alerts_for_account'] },
            { id: 'known-asn', lean: 'unclear', title: '**11** earlier successful sign-ins from one of the source networks', means: 'Not every source network is hostile, so blocking all of them could also lock the user out.', queryIds: ['asn_history_for_account'] },
            { id: 'ti', lean: 'unclear', title: '**0** threat-intel results — the lookup failed', means: 'The reputation check timed out, so nothing is known either way about these addresses.', queryIds: ['ip_threat_intel_enrichment'] },
            { id: 'no-success', lean: 'away', title: '**0** successful interactive sign-ins in before / during / after', means: 'No sign of the attack working in these logs. That is not proof the account is safe.', queryIds: ['successful_signins_for_account'] },
            { id: 'no-changes', lean: 'away', title: '**0** password, MFA or role changes since 25 Oct', means: 'An attacker who got in would usually change one of these; nothing changed.', queryIds: ['directory_changes_for_account'] },
            { id: 'env', lean: 'away', title: '**95%** of the user’s sign-ins from Windows10 on two usual subnets', means: 'The user’s own activity looks normal, which separates them from the attack traffic.', queryIds: ['user_baseline_profile'] },
          ],
          queries: q('a-14310-1'),
          footerNote: NO_PLAYBOOK,
          changelog: ['Resolve analysed this alert', 'Triage settled as true positive (0.60); below containment threshold'],
        },
      },
      {
        id: 'a-14310-2',
        ref: 'ALT-14310-2',
        title: 'Multiple account lockouts for one user',
        description: 'An account was locked out more than 10 times within an hour.',
        time: '01/11/2026, 06:14:02',
        severity: 'Medium',
        source: SENTINEL,
        analysisState: 'error',
        error: 'Analysis did not finish: the lockout query returned more rows than the limit allows.',
        analysis: {
          verdict: 'TruePositive',
          confidence: 70,
          threshold: 80,
          headline: 'hello@seculyze.com was locked out by the same password-spray campaign. The user may not be able to sign in.',
          metrics: [
            { value: '212', label: 'lockouts in 7 days', tone: 'suspicious' },
            { value: '14', label: 'lockouts in the busiest hour', tone: 'suspicious' },
            { value: '0', label: 'self-service password resets', tone: 'neutral' },
          ],
          happened: [
            '**212** lockouts (50053) in 7 days',
            '**14** lockouts between **06:00 and 07:00** on 1 Nov',
            'Same source addresses as the password-cracking alert',
          ],
          how: [
            'Failures hit the smart-lockout limit again and again',
            '**37** of the source addresses are already blocked in the tenant',
            'Lockouts reset and re-trigger within minutes',
          ],
          actions: [
            notify('hello@seculyze.com', 'The user is most likely locked out by the attack, not by their own mistakes. Tell them what is happening and how to reach the help desk.'),
          ],
          findings: [
            { id: 'burst', lean: 'attack', title: '**14** lockouts in one hour', means: 'Far beyond a user forgetting a password; this is the spray hitting the lockout limit.', when: '2026-11-01T06:00:00 → 2026-11-01T07:00:00 UTC', queryIds: ['lockout_events_for_account'] },
            { id: 'blocked', lean: 'attack', title: '**37** lockout sources already blocked in the tenant', means: 'The lockouts come from known attacker addresses.', queryIds: ['tenant_blocked_ips'] },
            { id: 'no-sspr', lean: 'unclear', title: '**0** self-service password resets', means: 'The user hasn’t tried to reset — they may not have noticed yet, or may be unable to.', queryIds: ['sspr_events_for_account'] },
            { id: 'no-success', lean: 'away', title: '**0** successful sign-ins between lockouts', means: 'No sign that a lockout window was used to get in.', queryIds: ['successful_signins_for_account'] },
          ],
          queries: q('a-14310-2'),
          changelog: ['Resolve analysed this alert', 'Triage settled as true positive (0.70); below containment threshold'],
        },
      },
      {
        id: 'a-14310-3',
        ref: 'ALT-14310-3',
        title: 'Sign-in attempts from Tor exit nodes',
        description: 'Sign-in attempts were made from known Tor exit nodes.',
        time: '01/11/2026, 09:47:30',
        severity: 'Low',
        source: SENTINEL,
        analysisState: 'none',
        analysis: {
          verdict: 'TruePositive',
          confidence: 66,
          threshold: 80,
          headline: 'Some of the failed sign-ins came from Tor exit nodes. They belong to the same campaign as the other alerts on this incident.',
          metrics: [
            { value: '9', label: 'attempts from Tor', tone: 'suspicious' },
            { value: '4', label: 'Tor exit nodes', tone: 'suspicious' },
            { value: '0', label: 'successful sign-ins from Tor', tone: 'neutral' },
          ],
          happened: ['**9** failed attempts from **4** Tor exit nodes', 'All inside the password-cracking window', 'Same user, hello@seculyze.com'],
          how: ['Tor hides the real source of the attempts', 'Exit nodes rotate, so blocking them one by one won’t hold', '**0** attempts succeeded'],
          actions: [],
          noActionNote: 'Nothing to decide here — the actions on alert ALT-14310-1 cover this campaign.',
          findings: [
            { id: 'tor', lean: 'attack', title: '**9** attempts from **4** Tor exit nodes', means: 'Part of the same spray, routed through Tor to hide the source.', queryIds: ['tor_exit_matches'] },
            { id: 'no-success', lean: 'away', title: '**0** successful sign-ins from Tor', means: 'None of the Tor attempts worked.', queryIds: ['successful_signins_for_account'] },
          ],
          queries: q('a-14310-3'),
          changelog: ['Resolve analysed this alert on request', 'Triage settled as true positive (0.66)'],
        },
      },
    ],
  },

  // ── Sign-in from a new ASN: false positive below the auto-close threshold ──
  {
    id: 'inc-14287',
    number: '14287',
    title: 'Sign-in from new ASN',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'InitialAccess',
    created: '2h 14m ago',
    logs: 14,
    entities: [
      { name: 'tomislav@seculyze.com', type: 'Account' },
      { name: '95.168.123.186', type: 'IP' },
    ],
    mitre: [{ tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' }],
    similar: { total: 12, sameVerdict: 11 },
    alerts: [
      {
        id: 'a-14287-1',
        ref: 'ALT-14287-1',
        title: 'Sign-in from new ASN',
        description: 'A user signed in from an autonomous system not seen for this account in the last 14 days.',
        time: '02/11/2026, 08:41:07',
        severity: 'Medium',
        source: SENTINEL,
        analysisState: 'done',
        analysis: {
          verdict: 'FalsePositive',
          confidence: 78,
          threshold: 80,
          headline: 'tomislav@seculyze.com signed in with MFA from a network they have used before. The “new ASN” flag doesn’t hold.',
          metrics: [
            { value: '3', label: 'earlier days with this ASN', tone: 'benign' },
            { value: '14', label: 'sign-ins in 7 days, usual pattern', tone: 'neutral' },
            { value: '1', label: 'first-seen address, unmanaged device', tone: 'suspicious' },
          ],
          happened: ['Sign-in from 95.168.123.186 (ASN 12830) at **08:41**', 'MFA satisfied under policy **MFA - All**', 'Device **not compliant** and **not managed**'],
          how: ['ASN 12830 seen on **3** earlier days (3, 5 and 11 Oct)', '**14** sign-ins from **3** addresses in the last 7 days', 'Same OS and browser as the user’s other sign-ins'],
          actions: [closeFp('The rule’s “new ASN” logic is wrong for this user. Confidence is 78%, just under the 80% threshold for automatic closing, so the close needs your approval.')],
          findings: [
            { id: 'new-ip', lean: 'attack', title: '**1** first-seen address with **30** events', means: 'The address itself is new today — the one genuinely new element, and the main reason confidence isn’t higher.', when: '2026-11-02T08:41:07 UTC', queryIds: ['ip_first_seen'] },
            { id: 'device', lean: 'unclear', title: '**1** device not compliant or managed', means: 'An unmanaged device can’t be tied to the user with certainty, which keeps some risk open.', queryIds: ['device_compliance'] },
            { id: 'ti', lean: 'unclear', title: '**0** threat-intel hits for the address', means: 'Nothing is known against the address — which only means nothing is known.', queryIds: ['ip_threat_intel_enrichment'] },
            { id: 'asn', lean: 'away', title: '**3** earlier days with ASN 12830', means: 'The “new ASN” trigger is wrong for this user, which removes the reason the alert fired.', queryIds: ['asn_history_for_account'] },
            { id: 'mfa', lean: 'away', title: '**1** Conditional Access policy passed with MFA', means: 'A stolen password alone would not have been enough.', queryIds: ['conditional_access_for_signin'] },
            { id: 'pattern', lean: 'away', title: '**14** sign-ins in 7 days, usual pattern', means: 'Volume and clients match the user’s routine, with no burst after this sign-in.', queryIds: ['signins_for_account'] },
          ],
          queries: q('a-14287-1'),
          changelog: ['Resolve analysed this alert', 'Triage settled as false positive (0.78); below auto-close threshold'],
        },
      },
    ],
  },

  // ── Data exfiltration: two alerts, neither analysed yet (Analyze all) ──
  {
    id: 'inc-14352',
    number: '14352',
    title: 'Mass download after impossible travel',
    client: 'Seculyze',
    severity: 'High',
    status: 'New',
    type: 'Exfiltration',
    created: '38m ago',
    logs: 1286,
    entities: [
      { name: 'finance-ops@seculyze.com', type: 'Account' },
      { name: '185.220.101.44', type: 'IP' },
      { name: 'FIN-LT-0231', type: 'Host' },
    ],
    mitre: [
      { tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' },
      { tactic: 'Exfiltration', technique: 'T1567 Exfiltration Over Web Service' },
    ],
    similar: { total: 7, sameVerdict: 6 },
    alerts: [
      {
        id: 'a-14352-1',
        ref: 'ALT-14352-1',
        title: 'Impossible travel followed by a token replay',
        description: 'Sign-ins from two locations too far apart for the time between them.',
        time: '02/11/2026, 10:02:15',
        severity: 'High',
        source: SENTINEL,
        analysisState: 'none',
        analysis: {
          verdict: 'TruePositive',
          confidence: 91,
          threshold: 80,
          headline: 'Someone used a stolen session for finance-ops@seculyze.com through Tor and added persistence. Sessions were revoked automatically.',
          metrics: [
            { value: '41 min', label: 'Copenhagen → Frankfurt (Tor)', tone: 'suspicious' },
            { value: '2', label: 'persistence changes made', tone: 'suspicious' },
            { value: '2', label: 'failed sign-ins after revocation', tone: 'neutral' },
          ],
          happened: ['Sign-in from 185.220.101.44 (Tor) **41 min** after a Copenhagen sign-in', 'Inbox rule **Archive** and an OAuth consent added within **4 min**', 'Sessions revoked automatically at **10:14**'],
          how: ['MFA claim replayed from another device, issued **3h 10m** earlier', 'Client was **python-requests**, never seen for this account', 'Confidence **91%**, above the 80% containment threshold'],
          actions: [
            ticket('finance-ops@seculyze.com', 'Sessions are already revoked. The inbox rule, the app consent and what data left the tenant still need a person.'),
            notify('security-team@seculyze.com', 'A finance mailbox was taken over and used to pull files; the data owner and legal may need to know inside the reporting window.'),
          ],
          findings: [
            { id: 'travel', lean: 'attack', title: '**41 min** between Copenhagen and Frankfurt sign-ins', means: 'No one covers 650 km in 41 minutes, so two different parties used this account.', when: '2026-11-02T09:21 → 2026-11-02T10:02 UTC', queryIds: ['signins_for_account'] },
            { id: 'tor', lean: 'attack', title: '**312** threat-intel reports for the source address', means: 'A Tor exit node; legitimate finance work rarely comes from one.', queryIds: ['ip_threat_intel_enrichment'] },
            { id: 'token', lean: 'attack', title: '**1** MFA claim replayed from another device', means: 'Points to a stolen session token rather than a fresh login.', queryIds: ['token_claims_for_session'] },
            { id: 'rule', lean: 'attack', title: '**1** inbox rule hiding messages with “invoice”', means: 'Keeps the attacker’s activity out of sight, and outlives revoked sessions.', queryIds: ['inbox_rules_created'] },
            { id: 'oauth', lean: 'attack', title: '**1** OAuth consent to an unverified app', means: 'Gives an outside app read access to all files — survives a password reset.', queryIds: ['oauth_consents_for_account'] },
            { id: 'shared', lean: 'unclear', title: '**4** people share this mailbox', means: 'Shared use explains some location spread, so impossible travel alone would be weaker here.' },
            { id: 'revoked', lean: 'away', title: '**2** failed sign-ins after revocation', means: 'Containment held: the attacker’s session no longer works.', queryIds: ['post_revocation_signins'] },
          ],
          queries: q('a-14352-1'),
          changelog: ['Resolve analysed this alert', 'Triage settled as true positive (0.91); above containment threshold', 'Containment ran: sessions revoked for finance-ops@seculyze.com'],
        },
      },
      {
        id: 'a-14352-2',
        ref: 'ALT-14352-2',
        title: 'Unusual volume of file downloads',
        description: 'A user downloaded far more files than usual in a short period.',
        time: '02/11/2026, 10:12:44',
        severity: 'High',
        source: 'Defender for Cloud Apps',
        analysisState: 'none',
        analysis: {
          verdict: 'TruePositive',
          confidence: 88,
          threshold: 80,
          headline: 'The stolen session downloaded 1,284 Finance files in 9 minutes. Which of them left the tenant is not confirmed.',
          metrics: [
            { value: '1,284', label: 'files downloaded in 9 min', tone: 'suspicious' },
            { value: '14', label: 'files on an average day', tone: 'neutral' },
            { value: '0', label: 'downloads after revocation', tone: 'neutral' },
          ],
          happened: ['**1,284** files from /sites/Finance between **10:03 and 10:12**', 'Client **python-requests/2.31**, from 185.220.101.44', 'Downloads stopped when sessions were revoked'],
          how: ['Same session as the impossible-travel alert', 'Scripted client pulling files back to back', 'DLP matches unknown — Purview isn’t connected'],
          actions: [],
          noActionNote: 'Nothing to decide here — the ticket on alert ALT-14352-1 covers the data loss.',
          findings: [
            { id: 'volume', lean: 'attack', title: '**1,284** files downloaded in 9 minutes', means: 'Bulk collection, not normal work — the account averages 14 a day.', when: '2026-11-02T10:03:11 → 2026-11-02T10:12:40 UTC', queryIds: ['file_downloads_for_account'] },
            { id: 'client', lean: 'attack', title: '**1** scripting client, never seen for this account', means: 'A script, not a person in a browser.', queryIds: ['file_downloads_for_account'] },
            { id: 'dlp', lean: 'unclear', title: '**0** DLP results — Purview isn’t connected', means: 'Whether sensitive data was in the files is unknown.', queryIds: ['dlp_policy_matches'] },
            { id: 'stopped', lean: 'away', title: '**0** downloads after revocation', means: 'Revoking sessions stopped the collection.', queryIds: ['post_revocation_downloads'] },
          ],
          queries: q('a-14352-2'),
          changelog: ['Resolve analysed this alert', 'Triage settled as true positive (0.88)'],
        },
      },
    ],
  },

  // ── Mail forwarding: not analysed yet, undetermined with gaps ──
  {
    id: 'inc-14360',
    number: '14360',
    title: 'Inbox forwarding rule to external address',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'Collection',
    created: '12m ago',
    logs: 3,
    entities: [{ name: 'j.berg@seculyze.com', type: 'Account' }],
    mitre: [{ tactic: 'Collection', technique: 'T1114.003 Email Forwarding Rule' }],
    similar: { total: 5, sameVerdict: 3 },
    alerts: [
      {
        id: 'a-14360-1',
        ref: 'ALT-14360-1',
        title: 'Inbox forwarding rule to external address',
        description: 'A mailbox rule was created that forwards mail to a domain outside the organisation.',
        time: '02/11/2026, 11:02:19',
        severity: 'Medium',
        source: SENTINEL,
        analysisState: 'none',
        analysis: {
          verdict: 'Undetermined',
          confidence: 45,
          threshold: 80,
          headline: 'j.berg@seculyze.com created a rule forwarding all mail to a 3-day-old external domain. Whether any mail left is unknown — the logs are missing.',
          metrics: [
            { value: '1', label: 'rule forwarding all mail externally', tone: 'suspicious' },
            { value: '3 days', label: 'age of the destination domain', tone: 'suspicious' },
            { value: 'Unknown', label: 'messages forwarded (logs missing)', tone: 'neutral' },
          ],
          happened: ['Rule **Sync** created at **10:58**, forwarding all mail', 'Destination ops@mailbox-sync.co, registered **30 Oct 2026**', 'Created from LT-0188, the user’s **managed** laptop'],
          how: ['Session signed in with an **Authenticator** push', '**MailItemsAccessed** logs missing for **30 Oct – 1 Nov**', 'Message trace **failed** (429 Too Many Requests)'],
          gaps: ['MailItemsAccessed logs are missing for 30 Oct – 1 Nov, so whether mail was forwarded is unknown.', 'No 30-day sign-in baseline: the account is 9 days old.'],
          actions: [
            {
              id: 'investigate',
              kind: 'investigate',
              title: 'Investigate in Sentinel',
              channel: 'Sentinel',
              effect: 'nothing changes on the incident',
              target: { label: 'mailbox', value: 'j.berg@seculyze.com' },
              why: 'Evidence is incomplete and confidence (45%) is too low to escalate or close. The missing mail-access logs are what would settle it.',
              does: 'Opens the incident in Microsoft Sentinel, where you can query mail activity directly.',
            },
          ],
          findings: [
            { id: 'rule', lean: 'attack', title: '**1** rule forwarding all mail externally', means: 'A classic data-theft setup, whoever created it.', when: '2026-11-02T10:58:04 UTC', queryIds: ['inbox_rules_for_mailbox'] },
            { id: 'domain', lean: 'attack', title: '**3 days** since the destination domain was registered', means: 'New domains are often attacker-run; this one has no reputation either way yet.', queryIds: ['domain_registration'] },
            { id: 'forwarded', lean: 'unclear', title: '**Unknown** messages forwarded — logs missing', means: 'Without mail-access logs there is no way to tell whether mail left.', queryIds: ['mail_items_accessed', 'mail_forwarding_events'] },
            { id: 'laptop', lean: 'away', title: '**1** managed, compliant laptop created the rule', means: 'Points to the user — knowingly or tricked — rather than an outside attacker.', queryIds: ['session_for_rule_creation'] },
            { id: 'sent', lean: 'away', title: '**0** messages delivered to the domain', means: 'No delivered mail seen — but trace and access logs are incomplete.', queryIds: ['email_events_to_domain'] },
          ],
          queries: q('a-14360-1'),
          changelog: ['Resolve analysed this alert on request', 'Triage undetermined (0.45); two evidence gaps recorded'],
        },
      },
    ],
  },

  // ── MFA fatigue on a privileged account: first analysis failed ──
  {
    id: 'inc-14371',
    number: '14371',
    title: 'Multiple failed MFA challenges followed by a successful sign-in from an anonymising VPN provider for a privileged Azure subscription owner account',
    client: 'Seculyze',
    severity: 'High',
    status: 'New',
    type: 'CredentialAccess',
    created: '6m ago',
    logs: 11,
    entities: [
      { name: 'a.nielsen-admin@seculyze.com', type: 'Account' },
      { name: '89.187.171.20', type: 'IP' },
    ],
    mitre: [
      { tactic: 'CredentialAccess', technique: 'T1621 Multi-Factor Authentication Request Generation' },
      { tactic: 'InitialAccess', technique: 'T1078.004 Cloud Accounts' },
    ],
    similar: { total: 4, sameVerdict: 3 },
    alerts: [
      {
        id: 'a-14371-1',
        ref: 'ALT-14371-1',
        title: 'MFA fatigue followed by successful sign-in',
        description: 'Repeated MFA denials for one account followed by an approved challenge.',
        time: '02/11/2026, 11:09:51',
        severity: 'High',
        source: SENTINEL,
        analysisState: 'error',
        error: 'Analysis did not finish: the SigninLogs query timed out after 10 minutes.',
        analysis: {
          verdict: 'TruePositive',
          confidence: 72,
          threshold: 80,
          headline: 'After 9 denied MFA prompts, a.nielsen-admin@seculyze.com approved one and signed in through a commercial VPN. No subscription changes so far.',
          metrics: [
            { value: '9', label: 'MFA prompts denied in 6 min', tone: 'suspicious' },
            { value: '1', label: 'successful sign-in via VPN exit', tone: 'suspicious' },
            { value: '2', label: 'subscriptions with Owner role', tone: 'neutral' },
          ],
          happened: ['**9** MFA prompts denied between **11:01 and 11:07**', 'Prompt approved, sign-in at **11:08** from 89.187.171.20', 'Device has **no device ID** and isn’t managed'],
          how: ['Push prompts repeated until one was approved — MFA fatigue', 'Sign-in through a **commercial VPN** exit the account never used', 'Confidence **72%**, below the 80% containment threshold'],
          actions: [
            ticket('a.nielsen-admin@seculyze.com', 'A privileged account may be compromised. Open a ticket now rather than wait for more evidence.'),
            notify('security-team@seculyze.com', 'Confidence is 72%, below the 80% threshold, so sessions were not revoked. Get someone on it before the account touches the subscriptions.'),
          ],
          findings: [
            { id: 'prompts', lean: 'attack', title: '**9** MFA prompts denied in 6 minutes', means: 'Someone with the password pushing prompts until one is approved.', when: '2026-11-02T11:01:12 → 2026-11-02T11:08:31 UTC', queryIds: ['mfa_challenges_for_account'] },
            { id: 'vpn', lean: 'attack', title: '**1** sign-in through a commercial VPN exit', means: 'An anonymising network this account has never used.', queryIds: ['ip_threat_intel_enrichment'] },
            { id: 'device', lean: 'attack', title: '**0** registered devices match the sign-in', means: 'The session came from a device the organisation doesn’t know.', queryIds: ['device_registration'] },
            { id: 'hours', lean: 'away', title: '**11:08** sign-in inside the user’s usual hours', means: 'The one signal pointing to the user.', queryIds: ['user_activity_hours'] },
            { id: 'no-changes', lean: 'away', title: '**0** subscription changes after the sign-in', means: 'Nothing has been done with the access yet.', queryIds: ['azure_activity_after_signin'] },
          ],
          queries: q('a-14371-1'),
          changelog: ['First analysis failed: SigninLogs query timed out', 'Triage settled as true positive (0.72); below containment threshold'],
        },
      },
    ],
  },

  // ── Credential additions: false positive, modelled on a real Resolve output ──
  {
    id: 'inc-14388',
    number: '14388',
    title: 'Credentials added to multiple applications',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'Persistence',
    created: '2d ago',
    logs: 28,
    entities: [
      { name: 'kristian@seculyze.com', type: 'Account' },
      { name: '188.179.84.12', type: 'IP' },
    ],
    mitre: [{ tactic: 'Persistence', technique: 'T1098.001 Additional Cloud Credentials' }],
    similar: { total: 16, sameVerdict: 16 },
    alerts: [
      {
        id: 'a-14388-1',
        ref: 'ALT-14388-1',
        title: 'Credentials added to multiple applications',
        description: 'A user added client secrets to several application registrations in a short window.',
        time: '31/10/2026, 10:26:19',
        severity: 'Medium',
        source: SENTINEL,
        analysisState: 'done',
        analysis: {
          verdict: 'FalsePositive',
          confidence: 76,
          threshold: 75,
          headline: 'kristian@seculyze.com added client secrets to 4 applications from their usual Danish address. They do this routinely.',
          metrics: [
            { value: '32', label: 'client secrets added in 90 days', tone: 'benign' },
            { value: '31,443', label: 'logins from 188.179.84.12 in 30 days', tone: 'neutral' },
            { value: '0', label: 'threat-intel hits for the address', tone: 'neutral' },
          ],
          happened: ['**28** application changes in the alert window', 'Secrets added to **4** applications that already had credentials', 'From 188.179.84.12 (TDC, Denmark)'],
          how: ['The user added **32** client secrets in the past **90 days**', '**97.8%** of the user’s sign-ins come from Denmark', '**2** checks skipped: requirements not met'],
          actions: [closeFp('The additions match this user’s routine, from their usual subnet, to applications that already had secrets. Two checks were skipped, so the verdict rests on baselines rather than per-application history.')],
          findings: [
            { id: 'ti', lean: 'unclear', title: '**0** threat-intel hits for the address', means: 'Nothing is known against the address — which only means nothing is known.' },
            { id: 'skipped', lean: 'unclear', title: '**2** checks skipped: requirements not met', means: 'Per-application history and device checks didn’t run, so they can’t confirm anything.', queryIds: ['app_credential_adds_by_application', 'same_hash_on_other_devices'] },
            { id: 'routine', lean: 'away', title: '**32** client secrets added in 90 days', means: 'Adding secrets is normal work for this user, so this burst is in character.', when: '2026-08-10 → 2026-10-31', queryIds: ['app_credential_adds_by_caller'] },
            { id: 'existing', lean: 'away', title: '**4** applications already had credentials', means: 'Fits rotation or maintenance, not an attacker planting a first backdoor.', queryIds: ['app_changes_in_window'] },
            { id: 'country', lean: 'away', title: '**97.8%** of the user’s sign-ins from Denmark', means: 'The change came from where this user works almost all the time.', queryIds: ['user_baseline_profile'] },
            { id: 'corp-ip', lean: 'away', title: '**31,443** logins from this address across the tenant', means: 'A shared corporate address, not a new or external one.', queryIds: ['ip_baseline', 'asim_ip_auth_baseline'] },
          ],
          queries: q('a-14388-1'),
          changelog: ['Resolve analysed this alert', 'Triage settled as false positive (0.76)'],
        },
      },
    ],
  },
];

/** Throws on a finding that points at a query its alert doesn't have. */
for (const inc of INCIDENTS)
  for (const al of inc.alerts) {
    const ids = new Set(al.analysis.queries.map(x => x.id));
    for (const f of al.analysis.findings)
      for (const id of f.queryIds ?? []) if (!ids.has(id)) throw new Error(`${al.id}/${f.id}: no query ${id}`);
  }

export const REDESIGN_INCIDENTS = INCIDENTS;
