// ─── AI triage test incidents ────────────────────────────────────────────────
//
// Fixtures for the Incidents (AI Triage) test page, which tries option 6b from
// the Incident Sidebar Wireframes with the review fixes applied. Three cases,
// chosen to exercise the layout rather than to look busy:
//
//   14310  true positive, confidence below the containment threshold — the
//          guardrail and the escalate path. Text is the agent's, verbatim.
//   14287  false positive below the auto-close threshold — the layout has to
//          hold up when the benign side carries the verdict.
//   14352  true positive with long indicator lists — what "Show all" is for.
//
// Every indicator carries a short `title` as well as the agent's full `text`.
// The title is what makes the lists scannable; in production the agent has to
// emit it, the layout cannot invent it.

export type Verdict = 'TruePositive' | 'FalsePositive';
export type Severity = 'High' | 'Medium' | 'Low';

export interface Indicator {
  title: string;
  text: string;
}

/** Something that would flip or harden the verdict, and the query that checks it. */
export interface VerdictCheck {
  id: string;
  question: string;
  /** What finding it would mean, said plainly. */
  effect: string;
  query: string;
  /** The simulated result of running the query. */
  result: string;
}

export interface RecommendedAction {
  kind: 'itsm' | 'close';
  label: string;
  /** Short facts about the action, shown as chips next to it. */
  chips: string[];
}

export interface TriageIncident {
  id: string;
  number: string;
  title: string;
  client: string;
  severity: Severity;
  status: 'New' | 'Active';
  type: string;
  created: string;
  entities: { name: string; type: string }[];
  mitre: { tactic: string; technique: string }[];
  alert: { title: string; description: string; time: string };
  similar: { total: number; sameVerdict: number };

  verdict: Verdict;
  /** 0–100. The one number the analyst sees; the guardrail compares against it. */
  confidence: number;
  /** The confidence the automation needs before it may act on its own. */
  threshold: number;
  /** What the automation would have done above the threshold, mid-sentence (lowercase). */
  guardedAction: string;
  summary: string;
  summaryFull: string;
  malicious: Indicator[];
  benign: Indicator[];
  conclusion: string;
  checks: VerdictCheck[];
  action: RecommendedAction;
  evidence: string[];
  changelog: string[];
}

export const TRIAGE_INCIDENTS: TriageIncident[] = [
  {
    id: 'inc-14310',
    number: '14310',
    title: 'Distributed password cracking attempts in Microsoft Entra ID',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'CredentialAccess',
    created: '16h 51m ago',
    entities: [{ name: 'hello@seculyze.com', type: 'Account' }],
    mitre: [{ tactic: 'CredentialAccess', technique: 'T1110.003 Password Spraying' }],
    alert: {
      title: 'Distributed Password cracking attempts in Microsoft Entra ID',
      description: 'Identifies distributed password cracking attempts from the Microsoft Entra ID SigninLogs.',
      time: '01/11/2026, 00:32:58',
    },
    similar: { total: 20, sameVerdict: 20 },

    verdict: 'TruePositive',
    confidence: 60,
    threshold: 80,
    guardedAction: 'containment (revoke sessions, block source IPs)',
    summary:
      'True positive: distributed password-guessing against hello@seculyze.com. 603 failed sign-ins from 218 IPs in 7 days, with lockouts and tenant-blocked sources. Not a confirmed takeover.',
    summaryFull:
      'True positive: distributed password-guessing against hello@seculyze.com. 603 failed sign-ins from 218 IPs in 7 days, with lockouts and tenant-blocked sources. Not a confirmed takeover. No successful interactive sign-in and no password, MFA or role change was found, so the account is under attack but not shown to be compromised. Escalate and keep the incident open; containment is held back until confidence passes the threshold or a check below finds a successful sign-in.',
    malicious: [
      {
        title: '603 failed sign-ins from 218 IPs in 7 days',
        text: 'hello@seculyze.com — 603 failed sign-ins in the last 7 days from 218 distinct IP addresses (first seen 2026-10-25, last seen 2026-11-01)',
      },
      {
        title: '62 failures, 0 successes in the rule window',
        text: 'hello@seculyze.com — 62 failures and 0 successes in the analytic rule’s 24-hour window (2026-10-31T13:30:10 .. 2026-11-01T13:30:11)',
      },
      {
        title: 'Lockout and invalid-credential codes',
        text: 'Result codes 50053 and 50126 — account lockouts and invalid-credentials failures observed across the events',
      },
      {
        title: 'Sources already blocked in the tenant',
        text: 'Multiple source IPs labelled in the tenant as blocked/malicious (examples: 61.73.190.98 — 17 failed events; 196.216.81.126 — 17 failed events; 103.55.89.5 — 14 failed events)',
      },
      {
        title: 'Dozens of countries, many /16 subnets',
        text: 'Sign-ins distributed across dozens of countries and many /16 subnets — failures appear from many different networks rather than one single mistyped source',
      },
    ],
    benign: [
      {
        title: 'No successful interactive sign-in',
        text: 'No successful interactive sign-ins for hello@seculyze.com returned in the last 7 days (successful_signins_for_account returned empty)',
      },
      {
        title: 'Stable normal environment',
        text: 'User hello@seculyze.com — Windows10 accounts for 95% of their sign-ins in the last 30 days and two specific IP subnets and countries cover a large share of normal activity, indicating a stable normal environment different from the distributed addresses',
      },
      {
        title: 'Some IPs in a known ASN',
        text: 'Some IP activity is tied to ASN 26599 subnets that have prior successful logins by hello@seculyze.com (example: 179.84.165.242 had 11 logins in the 30-day baseline), so not every IP in the set is necessarily attacker infrastructure',
      },
      {
        title: 'Recurring targeting (46 earlier alerts)',
        text: 'This analytic rule has fired repeatedly on the same user (46 similar earlier alerts), indicating persistent targeting of this account and recurring detection',
      },
    ],
    conclusion:
      'Telemetry shows a credible, ongoing distributed password-spray/cracking campaign against hello@seculyze.com (attempts only). The alert should be treated as a real attack in progress requiring escalation and investigation; it would be upgraded to a confirmed compromise if logs show a successful interactive sign-in from these sources or an unauthorized password/MFA change for the account.',
    checks: [
      {
        id: 'signin',
        question: 'Successful interactive sign-in from an attacking IP',
        effect: 'Upgrades to confirmed compromise',
        query:
          'SigninLogs\n| where UserPrincipalName == "hello@seculyze.com"\n| where ResultType == 0 and IsInteractive\n| where IPAddress in (attack_ips)\n| where TimeGenerated > ago(7d)',
        result: 'No rows. No successful interactive sign-in from the 218 source IPs — verdict holds.',
      },
      {
        id: 'mfa',
        question: 'Password, MFA or role change on the account',
        effect: 'Upgrades to confirmed compromise',
        query:
          'AuditLogs\n| where TargetResources has "hello@seculyze.com"\n| where OperationName has_any ("password", "security info", "role")\n| where TimeGenerated > datetime(2026-10-25)',
        result: 'No rows. No password, MFA or role change since the first failure — verdict holds.',
      },
    ],
    action: { kind: 'itsm', label: 'Escalate with ITSM ticket', chips: ['Escalation', 'Leaves incident open'] },
    evidence: [
      '603 failed interactive sign-ins for user hello@seculyze.com in the last 7 days from 218 distinct IPs, with first seen 2026-10-25 and last seen 2026-11-01 — large-scale distributed attempts against this account.',
      'Inside the rule’s 24-hour window there were 62 failures and 0 successes for hello@seculyze.com, and the per-subnet counts show failures across many /16s with zero successes — many failures without any recorded successful sign-in in the alert window.',
      'Result codes include 50053 (account locked after repeated wrong password) and 50126 (invalid credentials) — the account experienced lockouts and invalid-password failures during the events.',
      'Several source IPs appear repeatedly and are labelled in tenant history as blocked for malicious activity (for example 61.73.190.98, 196.216.81.126, 103.55.89.5) and ASIM/IP baselines show these IPs produced failures over multiple days, consistent with attacker infrastructure or known malicious hosts.',
      'The sign-ins span dozens of countries and user agents (interactive and non-interactive) rather than the user’s usual Windows10 + a small set of subnets in the last 30 days — this mismatch supports the attempts being external to the user’s normal environment.',
      'No successful interactive sign-ins for hello@seculyze.com were found in the last 7 days (successful_signins_for_account returned no rows) and no directory changes (password/MFA/role changes) were reported in the current evidence — therefore there is no logged proof of credential theft or account takeover in the checked windows.',
      'The same analytic rule fired 46 times on this user in recent days (examples tied to incidents including 2773, 2750, 2750, 2743, 2732, 2720), showing persistent targeting; that increases urgency but does not by itself indicate a successful compromise.',
    ],
    changelog: ['Resolve analysed this incident on arrival', 'Triage settled as true positive at 60% confidence; below the 80% containment threshold'],
  },

  {
    id: 'inc-14287',
    number: '14287',
    title: 'Sign-in from new ASN',
    client: 'Seculyze',
    severity: 'Medium',
    status: 'New',
    type: 'InitialAccess',
    created: '2h 14m ago',
    entities: [
      { name: 'tomislav@seculyze.com', type: 'Account' },
      { name: '95.168.123.186', type: 'IP' },
    ],
    mitre: [{ tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' }],
    alert: {
      title: 'Sign-in from new ASN',
      description: 'A user signed in from an autonomous system not seen for this account in the last 14 days.',
      time: '02/11/2026, 08:41:07',
    },
    similar: { total: 12, sameVerdict: 11 },

    verdict: 'FalsePositive',
    confidence: 78,
    threshold: 80,
    guardedAction: 'auto-close as false positive',
    summary:
      'Likely a false positive: a privileged user signing in with MFA from an ASN already seen for them. The "new ASN" flag doesn’t hold.',
    summaryFull:
      'Likely a false positive: a privileged user signing in with MFA from an ASN already seen for them. The "new ASN" flag doesn’t hold — ASN 12830 appears in the user’s sign-ins on three earlier days. Two things keep confidence below the auto-close threshold: the IP itself is new today, and the device is neither compliant nor managed.',
    malicious: [
      { title: 'New IP on the day', text: '95.168.123.186 first seen today, 30 events, ActiveDays 1' },
      { title: 'Device not compliant or managed', text: 'Sign-in device is not compliant and not managed (DeviceDetail.isCompliant = false, isManaged = false)' },
    ],
    benign: [
      { title: 'Conditional Access and MFA passed', text: 'CA "MFA - All" + success; MFA satisfied by token claim' },
      { title: 'Normal account activity', text: '14 sign-ins / 7d from 3 IPs, 2031 audit events, 13 of 14 days active' },
      { title: 'ASN seen before', text: 'ASN 12830 (VIPNET-AS) seen 10-03, 10-05, 10-11' },
      { title: 'Known user environment', text: 'Windows 10, Firefox 159, 3 known IPs' },
    ],
    conclusion:
      'The alert logic is wrong for this case: the ASN is not new for this user, MFA was satisfied, and the account behaves as usual. The remaining risk is the unmanaged device on a first-seen IP. It would turn into a true positive if the account shows password, security-info or role changes, or unusual activity on tenant resources after this sign-in.',
    checks: [
      {
        id: 'changes',
        question: 'Password, security info or role changes (7d)',
        effect: 'Turns it into a true positive',
        query:
          'AuditLogs\n| where TargetResources has "tomislav@seculyze.com"\n| where OperationName has_any ("password", "security info", "role")\n| where TimeGenerated > ago(7d)',
        result: 'No rows. No account changes in the last 7 days — verdict holds.',
      },
      {
        id: 'postauth',
        question: 'Anomalous post-auth activity on tenant resources',
        effect: 'Turns it into a true positive',
        query:
          'CloudAppEvents\n| where AccountObjectId == "tomislav"\n| where IPAddress == "95.168.123.186"\n| summarize count() by ActionType',
        result: '3 actions, all reads in SharePoint and Outlook, in line with the 30-day baseline — verdict holds.',
      },
    ],
    action: { kind: 'close', label: 'Close incident', chips: ['false_positive', 'incorrect_alert_logic'] },
    evidence: [
      'Conditional Access policy "MFA - All" applied and succeeded for the sign-in; MFA requirement was satisfied by a claim in the token.',
      'Account activity over the last 7 days: 14 interactive sign-ins from 3 IPs, 2031 audit events, active on 13 of the last 14 days — consistent with regular use.',
      'ASN 12830 (VIPNET-AS) appears in this user’s sign-ins on 2026-10-03, 2026-10-05 and 2026-10-11, so the ASN is not new for the account.',
      'IP 95.168.123.186 is first seen today with 30 events; it has no threat-intel matches.',
      'Device used for the sign-in reports isCompliant = false and isManaged = false.',
      'User environment: Windows 10, Firefox 159, and the three IPs seen in the last 14 days.',
    ],
    changelog: ['Resolve analysed this incident on arrival', 'Triage settled as false positive at 78% confidence; below the 80% auto-close threshold'],
  },

  {
    id: 'inc-14352',
    number: '14352',
    title: 'Mass download after impossible travel',
    client: 'Seculyze',
    severity: 'High',
    status: 'New',
    type: 'Exfiltration',
    created: '38m ago',
    entities: [
      { name: 'finance-ops@seculyze.com', type: 'Account' },
      { name: '185.220.101.44', type: 'IP' },
      { name: 'FIN-LT-0231', type: 'Host' },
    ],
    mitre: [
      { tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' },
      { tactic: 'Exfiltration', technique: 'T1567 Exfiltration Over Web Service' },
    ],
    alert: {
      title: 'Mass download after impossible travel',
      description: 'A user downloaded an unusual volume of files shortly after an impossible-travel sign-in.',
      time: '02/11/2026, 10:12:44',
    },
    similar: { total: 7, sameVerdict: 6 },

    verdict: 'TruePositive',
    confidence: 91,
    threshold: 80,
    guardedAction: 'containment (revoke sessions, block source IP)',
    summary:
      'True positive: finance-ops@seculyze.com signed in from a Tor exit node 41 minutes after a Copenhagen sign-in, then downloaded 1,284 files from Finance SharePoint.',
    summaryFull:
      'True positive: finance-ops@seculyze.com signed in from a Tor exit node 41 minutes after a Copenhagen sign-in, then downloaded 1,284 files from Finance SharePoint. Sessions were revoked automatically because confidence is above the containment threshold. Escalate to confirm what left the tenant.',
    malicious: [
      { title: 'Impossible travel: Copenhagen → Frankfurt in 41 min', text: 'Sign-in from Copenhagen (DK) at 09:21 followed by a sign-in from Frankfurt (DE) at 10:02 — 41 minutes apart, 650 km' },
      { title: 'Source is a Tor exit node', text: '185.220.101.44 is a listed Tor exit node with 312 threat-intel reports in the last 30 days' },
      { title: '1,284 files downloaded in 9 minutes', text: '1,284 FileDownloaded events from the Finance SharePoint site between 10:03 and 10:12, against a 30-day daily average of 14' },
      { title: 'New user agent', text: 'python-requests/2.31 user agent, never seen for this account' },
      { title: 'MFA satisfied by a replayed token', text: 'MFA claim in the token predates the session by 3h 10m and originates from a different device ID' },
      { title: 'Inbox rule created', text: 'New-InboxRule "Archive" moving messages containing "invoice" to RSS Feeds, created at 10:05' },
      { title: 'OAuth consent to unknown app', text: 'Consent granted to "DocSync Pro" (unverified publisher) with Files.Read.All at 10:06' },
      { title: 'Download from unmanaged device', text: 'Downloads came from a device that is not compliant and not managed' },
    ],
    benign: [
      { title: 'Account is a shared service mailbox', text: 'finance-ops@seculyze.com is used by four people in the finance team; some location spread is normal' },
      { title: 'Month-end close', text: 'The download falls in the month-end close window, when finance downloads spike' },
    ],
    conclusion:
      'An attacker is using a stolen session token for finance-ops@seculyze.com, has set up persistence (inbox rule and OAuth consent) and has pulled a large share of Finance SharePoint. Sessions were revoked automatically. Escalate to remove the inbox rule and the app consent, rotate credentials, and assess what data left the tenant.',
    checks: [
      {
        id: 'still-active',
        question: 'Any activity from 185.220.101.44 after session revocation',
        effect: 'Means containment did not hold',
        query:
          'SigninLogs\n| where IPAddress == "185.220.101.44"\n| where TimeGenerated > datetime(2026-11-02T10:14:00)',
        result: '2 failed sign-ins after revocation (50133 session invalid) — containment holds.',
      },
    ],
    action: { kind: 'itsm', label: 'Escalate with ITSM ticket', chips: ['Escalation', 'Sessions already revoked'] },
    evidence: [
      'Sign-in at 09:21 from Copenhagen on the user’s managed laptop FIN-LT-0231, then a sign-in at 10:02 from 185.220.101.44 (Frankfurt) — 41 minutes apart.',
      '185.220.101.44 is a Tor exit node listed in three threat-intel feeds.',
      '1,284 FileDownloaded events from /sites/Finance between 10:03 and 10:12.',
      'The session token’s MFA claim was issued at 06:52 to a different device ID than the one that used it.',
      'New-InboxRule "Archive" created at 10:05 from the same session.',
      'OAuth consent to "DocSync Pro" with Files.Read.All granted at 10:06.',
    ],
    changelog: [
      'Resolve analysed this incident on arrival',
      'Triage settled as true positive at 91% confidence; above the 80% containment threshold',
      'Containment ran: sessions revoked for finance-ops@seculyze.com',
    ],
  },
];
