// ─── Configuration settings ──────────────────────────────────────────────────
//
// Transcribed from the live Seculyze configuration cards, so the prototype
// stops inventing its own vocabulary for something that already exists.
//
// Three things came out of that comparison and are modelled here rather than
// approximated:
//
//   kind — the product's own grouping (Normalization Function, Workspace
//     Configuration, Product Settings, Sku Level). The prototype had invented
//     Normalisation / Cost & retention / Health / Analytics, which is a second
//     vocabulary for the same fourteen settings.
//
//   evidence — the numbers and checks under each card. A setting is not just
//     on or off: SkuLogAnalytics carries ingestion per day against current and
//     optimal sku, UEBA carries the three tables it needs, UnhealthyItems
//     carries a breakdown by playbook, analytics rule and data connector with
//     the actual error. This is the part a table of on/off throws away, and it
//     is the part someone reads before doing anything.
//
//   remedy — "Enable manually" and "Update manually" are counted separately on
//     the score card, so they are separate kinds of outstanding work, not one
//     bucket called "not configured".

export type Kind =
  | 'Normalization Function'
  | 'Workspace Configuration'
  | 'Product Settings'
  | 'Sku Level';

export const KINDS: Kind[] = [
  'Normalization Function', 'Workspace Configuration', 'Product Settings', 'Sku Level',
];

export interface DocLink {
  /** Short enough to sit in a table cell, and says which page it is. */
  label: string;
  url: string;
}

/** A figure the setting reports — ingestion per day, current sku, optimal sku. */
export interface Metric {
  label: string;
  value: string;
  /** Set when the figure is the one that makes the setting sub-optimal. */
  bad?: boolean;
}

/** A dependency the setting needs, and whether it is there. */
export interface Check {
  label: string;
  ok: boolean;
  /** How many are failing, when a check can fail more than once. */
  count?: number;
  /** The tooltip — what this is, or what went wrong. */
  note: string;
}

export interface Observation {
  tone: 'good' | 'warn';
  text: string;
}

/** Enabling and updating are counted separately on the score card. */
export type Remedy = 'enable' | 'update' | 'triage';

export type SentinelBlade =
  | 'EntityBehavior' | 'Settings' | 'DataConnectors' | 'Analytics' | 'Workbooks' | 'Logs';

export interface ConfigItem {
  key: string;
  kind: Kind;
  /** The product's own description, kept verbatim. */
  what: string;
  /** What stops working while this is missing — the reason to care. */
  cost: string;
  /** Tenants where it is not enabled. */
  missing: string[];
  remedy: Remedy;
  /** The verb on the row's action button. */
  verb: string;
  blade: SentinelBlade;
  /**
   * Microsoft Learn. A list, because a setting can need more than one page.
   * Every URL was checked for a 200 rather than guessed from the slug.
   */
  docs: DocLink[];
  metrics?: Metric[];
  checks?: Check[];
  /** The line the product shows when a setting is fine but has something to say. */
  observation?: Observation;
  /**
   * What a tenant missing this one actually is, said as a noun — "on a
   * sub-optimal tier", "without the parser".
   *
   * The single-tenant product can print one workspace's figures because there
   * is one workspace. Across nine there is no such thing as "ingestion per
   * day": the fleet question is how many are off and which, so the evidence
   * column says that instead of showing one tenant's number as if it were
   * everyone's.
   */
  fleetUnit: string;
}

export const CLIENTS = [
  'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok',
  'New Balance', 'Asics', 'Converse', 'Vans',
];

const WT = 'WT.mc_id=Portal-Microsoft_Azure_Security_Insights';
const S = 'https://learn.microsoft.com/en-us/azure/sentinel/';
const M = 'https://learn.microsoft.com/en-us/azure/azure-monitor/logs/';

export const ITEMS: ConfigItem[] = [
  {
    key: 'ASimAuthentication', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes login events from service principals as well as other Clouds and MDE devices',
    cost: 'Sign-in detections never fire on this tenant',
    fleetUnit: 'without the parser deployed',
    missing: [], remedy: 'enable', verb: 'Enable', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-authentication?' + WT }],
  },
  {
    key: 'ASimDNS', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes DNS query events from DNS servers, firewalls, and other network devices',
    cost: 'DNS tunnelling and DGA detections return nothing',
    fleetUnit: 'without the parser deployed',
    missing: [], remedy: 'enable', verb: 'Enable', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-dns?' + WT }],
  },
  {
    key: 'ASimFileEvent', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes file activity events such as file creation, modification, and deletion',
    cost: 'File-based detections skip this tenant',
    fleetUnit: 'without the parser deployed',
    missing: [], remedy: 'enable', verb: 'Enable', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-file-event?' + WT }],
  },
  {
    key: 'ASimNetworkSession', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes network session events from firewalls, NSGs, and other network devices',
    cost: 'Lateral movement and beaconing rules cannot read this traffic',
    fleetUnit: 'without the parser deployed',
    missing: ['Vans', 'Nike'], remedy: 'enable', verb: 'Enable manually', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-network?' + WT }],
  },
  {
    key: 'ASimProcessCreate', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes process creation and termination events from Sysmon, Microsoft Defender, and other endpoint agents',
    cost: 'The largest family of endpoint detections depends on this',
    fleetUnit: 'without the parser deployed',
    missing: [], remedy: 'enable', verb: 'Enable', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-process-event?' + WT }],
  },
  {
    key: 'ASimRegistryEvent', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes Windows registry modification events from Sysmon, Microsoft Defender, and other endpoint agents',
    cost: 'Registry persistence goes undetected',
    fleetUnit: 'without the parser deployed',
    missing: ['Puma'], remedy: 'enable', verb: 'Enable manually', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-registry-event?' + WT }],
  },
  {
    key: 'ASimWebSession', kind: 'Normalization Function',
    what: 'The Advanced Security Information Model (ASIM) which normalizes web session events from proxies, web gateways, and other web traffic sources',
    cost: 'Exfiltration and C2-over-HTTP rules go blind',
    fleetUnit: 'without the parser deployed',
    missing: ['Under Armour', 'New Balance'], remedy: 'enable', verb: 'Enable manually', blade: 'Logs',
    docs: [{ label: 'Schema', url: S + 'normalization-schema-web?' + WT }],
  },

  {
    key: 'FirewallLogsDataLake', kind: 'Workspace Configuration',
    what: 'Firewall and network logs are high volume but low detection value. Moving them to the Microsoft Sentinel data lake tier keeps them searchable for a fraction of the cost; each table below can be moved in one click',
    cost: 'Firewall volume billed at analytics rates',
    fleetUnit: 'still billing firewall logs at analytics rates',
    missing: ['Adidas', 'Converse'], remedy: 'update', verb: 'Route to lake', blade: 'Settings',
    docs: [{ label: 'Data lake', url: S + 'datalake/sentinel-lake-overview?' + WT }],
    observation: { tone: 'good', text: 'No firewall or network tables are being ingested' },
  },
  {
    key: 'LogRetention', kind: 'Workspace Configuration',
    what: 'The retention of the LogAnalytics workspace is very important. The normal retention is 3 months, but often to perform security baseline more than 3 months of retention is needed',
    cost: 'Either paying to keep data nobody queries, or losing it before an investigation needs it',
    fleetUnit: 'on the default 3-month retention',
    missing: ['Adidas'], remedy: 'update', verb: 'Set retention', blade: 'Settings',
    docs: [{ label: 'Retention', url: M + 'data-retention-configure?' + WT }],
    metrics: [
      { label: 'Current retention', value: '3 months' },
      { label: 'Recommended', value: '12 months' },
    ],
  },

  {
    key: 'SentinelHealth', kind: 'Product Settings',
    what: 'To monitor the health of playbooks, log fetched via Office365 and more. This is a great datasource',
    cost: 'No signal when a connector or rule fails quietly',
    fleetUnit: 'not reporting health',
    missing: [], remedy: 'enable', verb: 'Enable', blade: 'Settings',
    docs: [{ label: 'Health', url: S + 'monitor-sentinel-health?' + WT }],
  },
  {
    key: 'UEBA', kind: 'Product Settings',
    what: 'To monitor anomalies in user entity behaviours i.e., tablename BehaviorAnalytics which can give insights into Users, actions and more',
    cost: 'No entity risk scores, and anomaly detections unavailable',
    fleetUnit: 'without entity analytics',
    missing: ['Adidas', 'New Balance', 'Asics'], remedy: 'enable', verb: 'Enable', blade: 'EntityBehavior',
    docs: [{ label: 'Enable UEBA', url: S + 'enable-entity-behavior-analytics?' + WT }],
    checks: [
      { label: 'AuditLogs', ok: true, note: 'Tracks administrative activities and policy changes' },
      { label: 'AzureActivity', ok: true, note: 'Tracks Azure resource operations and role changes' },
      { label: 'SigninLogs', ok: true, note: 'Monitors authentication patterns and login activities' },
    ],
  },
  {
    key: 'UnhealthyItems', kind: 'Product Settings',
    what: 'Playbooks and data connectors that Sentinel reports as failing. Broken automation and dead connectors quietly erode detection coverage',
    cost: 'Detections that look like they are running but see nothing',
    fleetUnit: 'with unhealthy items',
    missing: ['Asics', 'Vans'], remedy: 'triage', verb: 'Configure', blade: 'DataConnectors',
    docs: [
      { label: 'Health audit', url: S + 'health-audit?' + WT },
      { label: 'Enable monitoring', url: S + 'enable-monitoring?tabs=defender-portal&' + WT },
    ],
    checks: [
      { label: 'Playbook', ok: true, note: 'No playbook is currently failing (checked over the last 30 days)' },
      { label: 'Analytics rule', ok: true, note: 'No analytics rule is currently failing (checked over the last 30 days)' },
      { label: 'Data connector', ok: false, count: 1, note: 'Unauthorized: ApiPolling-GitHubEcAuditLogPolling' },
    ],
    observation: { tone: 'warn', text: 'Unhealthy items found' },
  },

  {
    key: 'SkuLogAnalytics', kind: 'Sku Level',
    what: 'Sometimes one can save money on both the loganalytics or sentinel workspace if you ingest enough gbs pr. day',
    cost: 'Pay-as-you-go above the commitment threshold costs materially more',
    fleetUnit: 'on a sub-optimal tier',
    missing: ['Asics'], remedy: 'update', verb: 'Set tier', blade: 'Settings',
    docs: [{ label: 'Cost', url: M + 'cost-logs?' + WT }],
    metrics: [
      { label: 'Ingestion / day', value: '0.52' },
      { label: 'Current Sku', value: 'pergb2018' },
      { label: 'Optimal Sku', value: 'pergb2018' },
    ],
    observation: { tone: 'good', text: 'skuLevel is optimized' },
  },
  {
    key: 'SkuSentinel', kind: 'Sku Level',
    what: 'Sometimes one can save money on both the loganalytics or sentinel workspace if you ingest enough gbs pr. day',
    cost: 'Paying Sentinel list price on committed volume',
    fleetUnit: 'on a sub-optimal tier',
    missing: [], remedy: 'update', verb: 'Set tier', blade: 'Settings',
    docs: [{ label: 'Billing', url: S + 'billing?' + WT }],
    metrics: [
      { label: 'Ingestion / day', value: '0.52' },
      { label: 'Current Sku', value: 'unified' },
      { label: 'Optimal Sku', value: 'unified' },
    ],
    observation: { tone: 'good', text: 'skuLevel is optimized' },
  },
];

/**
 * Stand-in workspace resource ids. A real deployment reads these from the
 * tenant record; the shape of the portal link is what matters here.
 */
export const WORKSPACE: Record<string, string> = Object.fromEntries(
  CLIENTS.map(c => [
    c,
    `/subscriptions/${c.toLowerCase().replace(/\s/g, '-')}-sub/resourceGroups/sentinel-prod` +
    `/providers/Microsoft.OperationalInsights/workspaces/${c.toLowerCase().replace(/\s/g, '-')}-euw`,
  ]));

export const sentinelUrl = (blade: SentinelBlade, client: string) =>
  `https://portal.azure.com/#view/Microsoft_Azure_Security_Insights/MainMenuBlade/~/${blade}` +
  `/id/${encodeURIComponent(WORKSPACE[client] ?? '')}`;

/**
 * The Configuration Score, out of 20.
 *
 * Worked back from the live card: 17.14 / 20 against fourteen settings is
 * (12 / 14) × 20 exactly, so the score is the share enabled scaled to 20 —
 * not a weighting we would have had to invent. Two of the fourteen were off,
 * which is also what that card's "Enable manually 1" plus one unhealthy
 * setting accounts for.
 */
export const SCORE_MAX = 20;

export function scoreFor(client: string): number {
  const enabled = ITEMS.filter(i => !i.missing.includes(client)).length;
  return (enabled / ITEMS.length) * SCORE_MAX;
}

export const scoreTone = (score: number) =>
  score >= 17 ? 'good' : score >= 13 ? 'warn' : 'bad';

/** The bar a tenant is expected to clear. */
export const SCORE_BAR = 17;

/**
 * The fleet picture. An average of nine scores hides the shape — eight perfect
 * tenants and one broken one averages well — so the MSSP view reports the
 * weakest tenant and how many sit below the bar instead.
 */
export function fleetScore() {
  const scored = CLIENTS.map(c => ({ client: c, score: scoreFor(c) }))
    .sort((a, b) => a.score - b.score);
  return {
    lowest: scored[0],
    below: scored.filter(s => s.score < SCORE_BAR).length,
    average: scored.reduce((n, s) => n + s.score, 0) / scored.length,
  };
}

/** Outstanding work across the fleet, counted as tenant x setting, not setting. */
export function fleetJobs() {
  let enable = 0, update = 0;
  for (const i of ITEMS) {
    if (i.remedy === 'enable') enable += i.missing.length;
    else update += i.missing.length;
  }
  return { enable, update };
}
