import type { Attention } from './attention';
import type { LogEntry } from './IncidentLogs';
import {
  closeFp,
  notify,
  ticket,
  type Analysis,
  type DecisionAction,
  type Finding,
  type IncidentAlert,
  type InvestigationQuery,
  type RedesignIncident,
  type Severity,
  type Verdict,
} from './triageRedesignData';

// ─── Incidents (A) → the incident panel ──────────────────────────────────────
//
// The main Incidents table holds only what a row needs: type, entities,
// severity, Seculyze's Attention. The incident panel needs more — alerts,
// MITRE, an AI assessment with findings, actions and evidence, and the raw
// logs. This writes all of it for each incident from that incident's own
// data, so nothing on screen names another incident's users or addresses.
//
// Everything is deterministic (seeded by the incident number), so reopening an
// incident shows the same content. It is prototype content, modelled on the
// AI Triage B fixtures.

export interface MainIncident {
  id: string;
  incidentNumber: string;
  client: string;
  type: string;
  /** ISO local time, e.g. 2026-11-17T08:29:00. */
  created: string;
  entities: { name: string; type: string }[];
  logs: number;
  severity: Severity;
  status: 'New' | 'Active' | 'Closed';
  attention: Attention;
  also?: Attention[];
}

const SOC = 'security-team@seculyze.com';

// ── Small deterministic helpers ──

const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T>(list: readonly T[], seed: number, salt = 0) => list[(seed + salt * 7919) % list.length];
const between = (seed: number, lo: number, hi: number, salt = 0) => lo + ((seed >>> (salt % 16)) + salt * 104729) % (hi - lo + 1);

const guid = (seed: number) => {
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const a = seed,
    b = Math.imul(seed, 2654435761),
    c = Math.imul(seed ^ 0x5bd1e995, 40503),
    d = Math.imul(seed + 977, 69069);
  return `${hex(a, 8)}-${hex(b, 4)}-4${hex(c, 3)}-${hex((d & 0x3fff) | 0x8000, 4)}-${hex(b, 8)}${hex(c, 4)}`;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** `2026-11-17T08:29:00` shifted by minutes → ISO with Z. */
const shift = (created: string, minutes: number) => {
  const d = new Date(`${created}Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().replace('.000', '');
};
/** ISO → the alert card's "17/11/2026, 08:29:00". */
const alertTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};
const hhmm = (iso: string) => iso.slice(11, 16);

const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip);

/** The table's entity type names → the panel's (Sentinel's) names. */
const ENTITY_TYPE: Record<string, string> = { FileHash: 'File Hash' };

// ── What kind of incident it is ──

type Family = 'identity' | 'endpoint' | 'data' | 'network';

interface Profile {
  family: Family;
  mitre: { tactic: string; technique: string };
  source: string;
  description: string;
}

const PROFILES: [RegExp, Profile][] = [
  [/password|brute|failed login/i, { family: 'identity', mitre: { tactic: 'CredentialAccess', technique: 'T1110 Brute Force' }, source: 'Microsoft Entra ID Protection', description: 'Repeated failed sign-ins against one or more accounts from many addresses.' }],
  [/guest/i, { family: 'identity', mitre: { tactic: 'Persistence', technique: 'T1136.003 Create Account: Cloud Account' }, source: 'Microsoft Sentinel', description: 'Guest users were invited to the tenant by accounts that have not invited guests before.' }],
  [/credential added/i, { family: 'identity', mitre: { tactic: 'Persistence', technique: 'T1098.001 Additional Cloud Credentials' }, source: 'Microsoft Sentinel', description: 'A new secret or certificate was added to an application or service principal.' }],
  [/privilege/i, { family: 'identity', mitre: { tactic: 'PrivilegeEscalation', technique: 'T1078.004 Valid Accounts: Cloud Accounts' }, source: 'Microsoft Entra ID', description: 'An account gained a privileged role outside the usual approval path.' }],
  [/api access/i, { family: 'identity', mitre: { tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' }, source: 'Defender for Cloud Apps', description: 'An API was called with credentials that are not normally used from this source.' }],
  [/ransomware/i, { family: 'endpoint', mitre: { tactic: 'Impact', technique: 'T1486 Data Encrypted for Impact' }, source: 'Microsoft Defender for Endpoint', description: 'File activity on the host matches known ransomware behaviour.' }],
  [/cryptomining/i, { family: 'endpoint', mitre: { tactic: 'Impact', technique: 'T1496 Resource Hijacking' }, source: 'Microsoft Defender for Endpoint', description: 'A process on the host is using compute in a pattern typical of coin mining.' }],
  [/lateral/i, { family: 'endpoint', mitre: { tactic: 'LateralMovement', technique: 'T1021 Remote Services' }, source: 'Microsoft Defender for Endpoint', description: 'An account authenticated to several hosts in quick succession using remote services.' }],
  [/zero-day|sql injection/i, { family: 'network', mitre: { tactic: 'InitialAccess', technique: 'T1190 Exploit Public-Facing Application' }, source: 'Microsoft Defender for Cloud', description: 'Requests to a public-facing service carried an exploit payload.' }],
  [/phishing|email attachment/i, { family: 'endpoint', mitre: { tactic: 'InitialAccess', technique: 'T1566.001 Spearphishing Attachment' }, source: 'Microsoft Defender for Office 365', description: 'A user received or opened an attachment flagged as malicious.' }],
  [/malware/i, { family: 'endpoint', mitre: { tactic: 'Execution', technique: 'T1204 User Execution' }, source: 'Microsoft Defender for Endpoint', description: 'A file on the host matched a known malware signature.' }],
  [/exfiltration/i, { family: 'data', mitre: { tactic: 'Exfiltration', technique: 'T1567 Exfiltration Over Web Service' }, source: 'Defender for Cloud Apps', description: 'An unusual amount of data was sent to an external destination.' }],
  [/deletion/i, { family: 'data', mitre: { tactic: 'Impact', technique: 'T1485 Data Destruction' }, source: 'Defender for Cloud Apps', description: 'A user deleted far more files than usual in a short period.' }],
  [/insider/i, { family: 'data', mitre: { tactic: 'Collection', technique: 'T1530 Data from Cloud Storage' }, source: 'Microsoft Purview Insider Risk', description: 'A user accessed and collected data outside their usual pattern.' }],
  [/network traffic/i, { family: 'network', mitre: { tactic: 'CommandAndControl', technique: 'T1071 Application Layer Protocol' }, source: 'Microsoft Defender for Endpoint', description: 'Outbound traffic from the host follows a beaconing pattern.' }],
  [/resource deployment/i, { family: 'network', mitre: { tactic: 'DefenseEvasion', technique: 'T1578 Modify Cloud Compute Infrastructure' }, source: 'Microsoft Defender for Cloud', description: 'Cloud resources were deployed by an identity that does not usually deploy them.' }],
];
const FALLBACK: Profile = { family: 'identity', mitre: { tactic: 'InitialAccess', technique: 'T1078 Valid Accounts' }, source: 'Microsoft Sentinel', description: 'Activity matched an analytics rule in Microsoft Sentinel.' };
const profileFor = (type: string) => PROFILES.find(([re]) => re.test(type))?.[1] ?? FALLBACK;

// ── The verdict follows Seculyze's own triage ──

const VERDICT_OF: Record<Attention, { verdict: Verdict; confidence: number }> = {
  'True Positive Detected': { verdict: 'TruePositive', confidence: 86 },
  'Threat Intel: High Risk': { verdict: 'TruePositive', confidence: 72 },
  'Threat Intel: Medium Risk': { verdict: 'Undetermined', confidence: 58 },
  'Threat Intel: Low Risk': { verdict: 'Undetermined', confidence: 51 },
  'Tuning: False Positive': { verdict: 'FalsePositive', confidence: 78 },
  'No Attention': { verdict: 'Undetermined', confidence: 47 },
};

/** Reputation score for a public address, in line with the incident's intel. */
const SCORE_OF: Record<Attention, number> = {
  'True Positive Detected': 81,
  'Threat Intel: High Risk': 88,
  'Threat Intel: Medium Risk': 61,
  'Threat Intel: Low Risk': 34,
  'Tuning: False Positive': 6,
  'No Attention': 14,
};

const ASNS = ['AS9009 - M247 Europe SRL, RO', 'AS16276 - OVH SAS, FR', 'AS14061 - DigitalOcean LLC, NL', 'AS24940 - Hetzner Online GmbH, DE', 'AS60068 - CDN77 - DataCamp Limited, GB'];

// ── Builders ──

const kqlFor = (table: string, where: string, project: string) => [table, '| where TimeGenerated > ago(7d)', `| where ${where}`, `| project ${project}`].join('\n');

function buildQueries(p: Profile, acct: string, host: string | undefined, ip: string | undefined, seed: number, n: { events: number; base: number; prior: number }): InvestigationQuery[] {
  const who = acct || host || 'the entity';
  const table = { identity: 'SigninLogs', endpoint: 'DeviceProcessEvents', data: 'OfficeActivity', network: 'CommonSecurityLog' }[p.family];
  const activity: InvestigationQuery = {
    id: 'activity',
    title: `Activity for ${who} around the alert`,
    source: `Log Analytics · ${table}`,
    status: 'completed',
    rows: n.events,
    timeRange: '24h before and after the alert',
    purpose: `Lists what ${who} did in the hours around the alert.`,
    scope: acct ? { label: 'Account', value: acct } : host ? { label: 'Host', value: host } : undefined,
    result: {
      columns: ['TimeGenerated', 'Operation', 'Result'],
      rows: [
        ['−00:42', p.family === 'identity' ? 'Sign-in' : p.family === 'data' ? 'FileAccessed' : 'ProcessCreated', p.family === 'identity' ? 'Failure' : 'Success'],
        ['−00:17', p.family === 'identity' ? 'Sign-in' : p.family === 'data' ? 'FileDownloaded' : 'NetworkConnection', 'Success'],
        ['+00:03', 'Alert raised', '—'],
      ],
    },
    kql: kqlFor(table, acct ? `UserPrincipalName =~ "${acct}"` : `DeviceName =~ "${host}"`, 'TimeGenerated, OperationName, ResultType'),
  };
  const baseline: InvestigationQuery = {
    id: 'baseline',
    title: `Usual behaviour for ${who} (30 days)`,
    source: `Log Analytics · ${table}`,
    status: 'completed',
    rows: n.base,
    timeRange: 'Last 30 days',
    purpose: 'Compares the alert activity with this entity’s normal pattern.',
    kql: kqlFor(table, acct ? `UserPrincipalName =~ "${acct}"` : `DeviceName =~ "${host}"`, 'TimeGenerated, AppDisplayName, Location'),
  };
  const intel: InvestigationQuery = ip
    ? {
        id: 'ip_threat_intel_enrichment',
        title: 'Threat intel for the source address',
        source: 'Threat intelligence',
        status: 'completed',
        rows: 1,
        timeRange: 'Current',
        purpose: 'Looks up the address’s reputation across the connected intel feeds.',
        result: { columns: ['IPAddress', 'Score', 'Feeds'], rows: [[ip, String(between(seed, 5, 95, 3)), String(between(seed, 1, 6, 5))]] },
        kql: ['ThreatIntelligenceIndicator', `| where NetworkIP == "${ip}"`, '| summarize Feeds = dcount(SourceSystem), Score = max(ConfidenceScore)'].join('\n'),
      }
    : {
        id: 'ip_threat_intel_enrichment',
        title: 'Threat intel for related indicators',
        source: 'Threat intelligence',
        status: 'skipped',
        reason: 'requires_unmet',
        reasonText: 'The incident has no public address or hash to look up.',
        timeRange: 'Current',
        purpose: 'Looks up the incident’s indicators across the connected intel feeds.',
        kql: 'ThreatIntelligenceIndicator | take 0',
      };
  const prior: InvestigationQuery =
    seed % 3 === 0
      ? {
          id: 'prior_incidents',
          title: 'Earlier incidents for the same entities',
          source: 'Microsoft Sentinel · SecurityIncident',
          status: 'failed',
          reason: 'The query timed out after 120 seconds.',
          timeRange: 'Last 90 days',
          purpose: 'Finds earlier incidents that involved the same account, host or address.',
          kql: ['SecurityIncident', '| where TimeGenerated > ago(90d)', `| where Entities has "${who}"`].join('\n'),
        }
      : {
          id: 'prior_incidents',
          title: 'Earlier incidents for the same entities',
          source: 'Microsoft Sentinel · SecurityIncident',
          status: 'completed',
          rows: n.prior,
          timeRange: 'Last 90 days',
          purpose: 'Finds earlier incidents that involved the same account, host or address.',
          kql: ['SecurityIncident', '| where TimeGenerated > ago(90d)', `| where Entities has "${who}"`].join('\n'),
        };
  return [activity, baseline, intel, prior];
}

function buildAnalysis(i: MainIncident, p: Profile, acct: string, host: string | undefined, ip: string | undefined, seed: number): { analysis: Analysis; summary: string } {
  const { verdict, confidence } = VERDICT_OF[i.attention];
  const n = { events: between(seed, 14, 240, 1), base: between(seed, 40, 900, 2), prior: between(seed, 0, 6, 4) };
  const who = acct || host || 'the affected entity';
  const where = ip ? ` from **${ip}**` : '';
  const queries = buildQueries(p, acct, host, ip, seed, n);
  const priorFailed = queries[3].status === 'failed';

  const attack: Finding[] = [
    { id: 'events', lean: 'attack', title: `**${n.events}** events tied to the alert for ${who}`, means: 'Activity around the alert follows the rule’s pattern, not routine use.', queryIds: ['activity'] },
  ];
  const away: Finding[] = [
    { id: 'baseline', lean: 'away', title: `**${n.base}** events in 30 days match ${who}’s usual pattern`, means: 'Most of this entity’s activity looks normal, which narrows the concern to the alert window.', queryIds: ['baseline'] },
  ];
  const unclear: Finding[] = [
    priorFailed
      ? { id: 'prior', lean: 'unclear', title: '**0** results for earlier incidents — the query failed', means: 'Whether this entity was involved before is unknown, not ruled out.', queryIds: ['prior_incidents'] }
      : { id: 'prior', lean: n.prior > 1 ? 'attack' : 'unclear', title: `**${n.prior}** earlier incidents with the same entities`, means: n.prior > 1 ? 'A repeat target raises urgency.' : 'Little history either way for these entities.', queryIds: ['prior_incidents'] },
  ];
  if (ip) {
    const s = SCORE_OF[i.attention];
    (s >= 50 ? attack : s >= 30 ? unclear : away).push({
      id: 'ip',
      lean: s >= 50 ? 'attack' : s >= 30 ? 'unclear' : 'away',
      title: `**${s}/100** reputation for ${ip}`,
      means: s >= 50 ? 'The address is known for malicious activity.' : s >= 30 ? 'Some feeds flag the address; not conclusive.' : 'Nothing known against the address — which only means nothing is known.',
      queryIds: ['ip_threat_intel_enrichment'],
    });
  }
  if (verdict === 'TruePositive') attack.push({ id: 'spread', lean: 'attack', title: `**${between(seed, 2, 9, 6)}** related entities in the same window`, means: 'The activity reaches beyond one account or device.', queryIds: ['activity'] });
  if (verdict === 'FalsePositive') away.push({ id: 'routine', lean: 'away', title: '**1** known admin workflow matches the activity', means: 'The trigger fits routine work for this entity, which removes the reason the alert fired.', queryIds: ['baseline'] });

  const actions: DecisionAction[] =
    verdict === 'TruePositive'
      ? [
          ticket(acct || host || i.type, 'The activity is malicious and needs an owner. A ticket gets responders to contain it and confirm the scope.'),
          notify(SOC, `Confidence is ${confidence}%. Let the SOC on-call know so someone can act before the next window.`),
        ]
      : verdict === 'FalsePositive'
        ? [closeFp(`The activity matches ${who}’s usual pattern and a known workflow. Confidence is ${confidence}%, under the 80% threshold for automatic closing, so the close needs your approval.`)]
        : [
            {
              id: 'investigate',
              kind: 'investigate',
              title: 'Investigate in Sentinel',
              channel: 'Sentinel',
              target: { label: 'Start with', value: acct || host || ip || i.type },
              why: `Confidence is ${confidence}%, too low to escalate or close. The checks that didn’t answer are what would settle it.`,
            },
          ];

  const verdictLine =
    verdict === 'TruePositive'
      ? `Likely malicious: “${i.type}”, involving ${who}${where}.`
      : verdict === 'FalsePositive'
        ? `“${i.type}” for ${who} matches their usual activity — likely a false positive.`
        : `“${i.type}” for ${who}${where} — the evidence doesn’t settle it either way.`;
  const summary = `${verdictLine} The checks found **${n.events}** related events around the alert${verdict === 'TruePositive' ? ` and **${between(seed, 2, 9, 6)}** related entities` : ''}, against **${n.base}** events in the last 30 days.`;

  const analysis: Analysis = {
    verdict,
    confidence,
    threshold: 80,
    headline: verdictLine,
    metrics: [],
    happened: [
      `${i.type} at **${hhmm(shift(i.created, 0))}**`,
      acct ? `Account involved: ${acct}` : host ? `Host involved: ${host}` : 'No account involved',
      ip ? `Source address ${ip}` : `Raised by ${p.source}`,
    ],
    how: [`**${n.events}** events in the 24 hours around the alert`, `**${n.base}** events in the last 30 days for comparison`, `Detected by ${p.source}`],
    gaps: verdict === 'Undetermined' ? [priorFailed ? 'The search for earlier incidents failed, so this entity’s history is unknown.' : 'No baseline beyond 30 days, so long-term patterns aren’t known.'] : undefined,
    actions,
    findings: [...attack, ...unclear, ...away],
    queries,
    footerNote: 'No playbook is available for this scenario — install or enable a matching playbook in Microsoft Sentinel to run one from here.',
    changelog: ['Resolve analysed this incident', `Triage settled as ${verdict === 'TruePositive' ? 'true positive' : verdict === 'FalsePositive' ? 'false positive' : 'undetermined'} (${(confidence / 100).toFixed(2)})`],
  };
  return { analysis, summary };
}

function buildLogs(i: MainIncident, p: Profile, acct: string, host: string | undefined, ip: string | undefined, proc: string | undefined): LogEntry[] {
  const t = (m: number) => shift(i.created, m);
  const who = acct || 'SYSTEM';
  const src = ip ?? '10.0.4.21';
  const out: LogEntry[] = [];
  const add = (m: number, table: string, summary: string, raw: LogEntry['raw']) => out.push({ id: `l${out.length + 1}`, time: t(m), table, summary, raw: { TimeGenerated: t(m), ...raw } });

  if (p.family === 'identity') {
    add(-34, 'SigninLogs', `Invalid username or password (50126) — ${who} from ${src}`, { UserPrincipalName: who, IPAddress: src, ResultType: 50126, ResultDescription: 'Invalid username or password', AppDisplayName: 'Microsoft Office 365 Portal' });
    add(-21, 'SigninLogs', `Invalid username or password (50126) — ${who} from ${src}`, { UserPrincipalName: who, IPAddress: src, ResultType: 50126, ResultDescription: 'Invalid username or password', AppDisplayName: 'Microsoft Office 365 Portal' });
    add(-9, 'SigninLogs', `Successful sign-in by ${who} from ${src}`, { UserPrincipalName: who, IPAddress: src, ResultType: 0, ResultDescription: 'Success', AppDisplayName: 'Azure Portal', ConditionalAccessStatus: 'success' });
    add(-2, 'AuditLogs', `${i.type} — initiated by ${who}`, { OperationName: i.type, Result: 'success', InitiatedBy: who, IPAddress: src });
  } else if (p.family === 'endpoint') {
    const dev = host ?? 'WS-0042';
    const exe = proc ?? 'powershell.exe';
    add(-26, 'DeviceProcessEvents', `${exe} started on ${dev}`, { DeviceName: dev, FileName: exe, ProcessCommandLine: `${exe} -nop -w hidden`, AccountName: who, InitiatingProcessFileName: 'explorer.exe' });
    add(-18, 'DeviceNetworkEvents', `${dev} connected to ${src}:443`, { DeviceName: dev, RemoteIP: src, RemotePort: 443, Protocol: 'Tcp', InitiatingProcessFileName: exe, ActionType: 'ConnectionSuccess' });
    add(-7, 'DeviceFileEvents', `File created by ${exe} on ${dev}`, { DeviceName: dev, ActionType: 'FileCreated', FileName: 'update.tmp', FolderPath: 'C:\\Users\\Public\\', InitiatingProcessFileName: exe });
    add(-1, 'SecurityAlert', `${i.type} on ${dev}`, { AlertName: i.type, ProviderName: p.source, CompromisedEntity: dev, Severity: i.severity });
  } else if (p.family === 'data') {
    add(-40, 'OfficeActivity', `Files accessed by ${who} on SharePoint`, { Operation: 'FileAccessed', UserId: who, ClientIP: src, ItemCount: 212 });
    add(-24, 'OfficeActivity', `Bulk ${/deletion/i.test(i.type) ? 'delete' : 'download'} by ${who}`, { Operation: /deletion/i.test(i.type) ? 'FileDeleted' : 'FileDownloaded', UserId: who, ClientIP: src, ItemCount: 1184 });
    add(-11, 'CloudAppEvents', `Unusual volume flagged for ${who}`, { ActionType: 'MassActivity', AccountUpn: who, IPAddress: src, Application: 'Microsoft SharePoint Online' });
    add(-3, 'SigninLogs', `Successful sign-in by ${who} from ${src}`, { UserPrincipalName: who, IPAddress: src, ResultType: 0, ResultDescription: 'Success', AppDisplayName: 'Microsoft SharePoint Online' });
  } else {
    add(-31, 'CommonSecurityLog', `Inbound request from ${src} blocked by the WAF`, { DeviceVendor: 'Microsoft', Activity: 'WAF rule match', SourceIP: src, DestinationPort: 443, DeviceAction: 'Blocked' });
    add(-19, 'CommonSecurityLog', `Inbound request from ${src} allowed`, { DeviceVendor: 'Microsoft', Activity: 'Request', SourceIP: src, DestinationPort: 443, DeviceAction: 'Allowed' });
    add(-8, 'AzureActivity', `${i.type} — caller ${who}`, { OperationNameValue: i.type, Caller: who, CallerIpAddress: src, ActivityStatusValue: 'Succeeded' });
    add(-2, 'SecurityAlert', `${i.type}`, { AlertName: i.type, ProviderName: p.source, Severity: i.severity });
  }
  return out;
}

/** The panel's incident for a row of the main Incidents table. */
export function toPanelIncident(i: MainIncident): RedesignIncident & { logEntries: LogEntry[] } {
  const seed = seedOf(i.incidentNumber);
  const p = profileFor(i.type);
  const acct = i.entities.find(e => e.type === 'Account' || e.type === 'Mailbox')?.name ?? '';
  const host = i.entities.find(e => e.type === 'Host')?.name;
  const proc = i.entities.find(e => e.type === 'Process')?.name;
  // Only a public address has a reputation or counts as the source; an
  // internal one still shows up in the logs.
  const ip = i.entities.find(e => e.type === 'IP' && !isPrivate(e.name))?.name;
  const anyIp = ip ?? i.entities.find(e => e.type === 'IP')?.name;

  const entities = i.entities.map(e => {
    const type = ENTITY_TYPE[e.type] ?? e.type;
    if (e.type !== 'IP' || isPrivate(e.name)) return { name: e.name, type };
    return { name: e.name, type, score: SCORE_OF[i.attention], asn: pick(ASNS, seed) };
  });

  const { analysis, summary } = buildAnalysis(i, p, acct, host, ip, seed);
  const alertAt = shift(i.created, 0);
  const alerts: IncidentAlert[] = [
    { id: `${i.id}-1`, alertId: guid(seed), title: i.type, description: p.description, time: alertTime(alertAt), severity: i.severity, source: p.source, analysisState: 'done', analysis },
  ];
  if (i.entities.length >= 4) {
    alerts.push({
      id: `${i.id}-2`,
      alertId: guid(seed ^ 0x9e3779b9),
      title: p.family === 'identity' ? 'Sign-in from an unfamiliar location' : p.family === 'endpoint' ? 'Suspicious process launched' : p.family === 'data' ? 'Unusual file activity' : 'Suspicious inbound traffic',
      description: 'Raised by the same activity and grouped into this incident.',
      time: alertTime(shift(i.created, -12)),
      severity: i.severity === 'High' ? 'Medium' : 'Low',
      source: p.source,
      analysisState: 'done',
      analysis,
    });
  }

  return {
    id: i.id,
    number: i.incidentNumber,
    title: i.type,
    client: i.client,
    severity: i.severity,
    status: i.status as RedesignIncident['status'],
    attention: i.attention,
    type: p.mitre.tactic,
    created: i.created,
    logs: Math.max(i.logs, 4),
    entities,
    mitre: [p.mitre],
    similar: { total: 8, sameVerdict: 6 },
    summary,
    alerts,
    logEntries: buildLogs(i, p, acct, host, anyIp, proc),
  };
}
