// ─── SOAR / agentic SOC — design register ────────────────────────────────────
// Prototype only: all data is mocked, no backend.
//
// Model comes from the SOAR flow design workbook:
//   Flow = Trigger → nodes → conditions → gates → actions
//
// The load-bearing idea is that the TRIGGER sets authority. Its class decides
// which action classes are reachable at all (see MATRIX). Six of the seven
// triggers reach exactly two actions; only TR-01 reaches containment, and every
// containment cell is Gated — never plain Allowed.
//
// Conditions decide whether a flow is *relevant*. Gates decide whether the
// platform is *allowed to act*. Keeping them separate is what makes the
// automation auditable per tenant.

// ─── ids ──────────────────────────────────────────────────────────────────────

export type TriggerId = 'TR-01' | 'TR-02' | 'TR-03' | 'TR-04' | 'TR-05' | 'TR-06' | 'TR-07';
export type ActionId = 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05' | 'AC-06' | 'AC-07' | 'AC-08' | 'AC-09';
export type ConditionId = 'CO-01' | 'CO-02' | 'CO-03' | 'CO-04' | 'CO-05' | 'CO-06' | 'CO-07' | 'CO-08' | 'CO-09' | 'CO-10' | 'CO-11';
export type GateId = 'GA-01' | 'GA-02' | 'GA-03' | 'GA-04' | 'GA-05' | 'GA-06' | 'GA-07';

export type TriggerClass = 'alert' | 'platform' | 'schedule';
export type ActionClass = 'containment' | 'ticketing' | 'notification' | 'playbook' | 'reporting';
export type Permission = 'allowed' | 'gated' | 'blocked';
export type Owner = 'SOC automation' | 'Calibrate' | 'Cost' | 'Enrich' | 'Reporting';

// ─── triggers ─────────────────────────────────────────────────────────────────

export interface TriggerDef {
  id: TriggerId;
  block: string;     // short label used on the canvas + palette
  name: string;        // what we show
  spec: string;        // the workbook's name
  cls: TriggerClass;
  source: string;
  cadence: string;
  reach: string;       // plain-language authority summary
  triage: boolean;     // ND-01 required
  respond: boolean;    // ND-02 required
  conditions: ConditionId[];
  note: string;
}

export const TRIGGERS: TriggerDef[] = [
  {
    id: 'TR-01', block: 'TruePositive alert', name: 'Confirmed threat', spec: 'TruePositive alert', cls: 'alert',
    source: 'Triage agent verdict = TruePositive', cadence: 'Per alert, near real-time',
    reach: 'Can contain, ticket and notify', triage: true, respond: true,
    conditions: ['CO-01', 'CO-02', 'CO-03', 'CO-04', 'CO-06', 'CO-09'],
    note: 'The only trigger permitted to reach containment. Confidence is available only because the triage agent runs first.',
  },
  {
    id: 'TR-02', block: 'Undetermined alert', name: 'Uncertain alert', spec: 'Undetermined alert', cls: 'alert',
    source: 'Triage agent verdict = Undetermined', cadence: 'Per alert, near real-time',
    reach: 'Ticket and notify only', triage: true, respond: false,
    conditions: ['CO-01', 'CO-02', 'CO-03', 'CO-04', 'CO-09'],
    note: 'Human-in-the-loop path. No containment — the agent has explicitly said it does not know.',
  },
  {
    id: 'TR-03', block: 'Ingestion anomaly', name: 'Ingestion anomaly', spec: 'Ingestion anomaly', cls: 'platform',
    source: 'Calibrate — log source volume deviation', cadence: 'Hourly evaluation',
    reach: 'Ticket and notify only', triage: false, respond: false,
    conditions: ['CO-08', 'CO-09', 'CO-10'],
    note: 'Operational signal, not a security verdict.',
  },
  {
    id: 'TR-04', block: 'Budget anomaly', name: 'Budget anomaly', spec: 'Budget anomaly', cls: 'platform',
    source: 'Cost — ingestion spend deviation vs. commitment', cadence: 'Daily evaluation',
    reach: 'Ticket and notify only', triage: false, respond: false,
    conditions: ['CO-08', 'CO-09'],
    note: 'Commercial signal. Recipients are usually the account owner and the tenant IT lead, not the SOC.',
  },
  {
    id: 'TR-05', block: 'ThreatIntel alert', name: 'Threat intel match', spec: 'ThreatIntel alert (Low / Medium / High)', cls: 'alert',
    source: 'Enrich — IOC match against prioritised TI', cadence: 'Event-driven',
    reach: 'Ticket and notify only', triage: false, respond: false,
    conditions: ['CO-05', 'CO-01', 'CO-09'],
    note: 'Severity selects channel and urgency only. A TI match is an indicator, not a confirmed compromise.',
  },
  {
    id: 'TR-06', block: 'Monthly schedule', name: 'On a schedule', spec: 'Specific time (monthly)', cls: 'schedule',
    source: 'Scheduler — monthly cron', cadence: 'Monthly',
    reach: 'Report only', triage: false, respond: false,
    conditions: ['CO-09', 'CO-11'],
    note: 'No alert in context, so alert-scoped conditions are unavailable.',
  },
  {
    id: 'TR-07', block: 'Day of month', name: 'On a day of the month', spec: 'Specific day of the month', cls: 'schedule',
    source: 'Scheduler — day-of-month match', cadence: 'Monthly',
    reach: 'Report only', triage: false, respond: false,
    conditions: ['CO-07', 'CO-09', 'CO-11'],
    note: 'Same restriction as a time schedule.',
  },
];

export const TRIGGER_BY_ID = Object.fromEntries(TRIGGERS.map(t => [t.id, t])) as Record<TriggerId, TriggerDef>;

export const TRIGGER_CLASS_LABEL: Record<TriggerClass, string> = {
  alert: 'From an alert',
  platform: 'From the platform',
  schedule: 'On a schedule',
};

// ─── actions ──────────────────────────────────────────────────────────────────

export interface ActionDef {
  id: ActionId;
  name: string;
  cls: ActionClass;
  target: string;
  platform: string;
  destructive: boolean;
  approval: 'Required' | 'Conditional' | 'No';
  requiresEntity?: 'user' | 'device';
  note: string;
}

export const ACTIONS: ActionDef[] = [
  { id: 'AC-01', name: 'Revoke user session', cls: 'containment', target: 'User', platform: 'Microsoft Graph', destructive: true, approval: 'Conditional', requiresEntity: 'user', note: 'Lowest-blast-radius containment. Preferred first step on token or session compromise.' },
  { id: 'AC-02', name: 'Disable user', cls: 'containment', target: 'User', platform: 'Microsoft Graph', destructive: true, approval: 'Required', requiresEntity: 'user', note: 'High blast radius. Do not pair with Block user — pick one enforcement point.' },
  { id: 'AC-03', name: 'Isolate device', cls: 'containment', target: 'Device', platform: 'Defender for Endpoint', destructive: true, approval: 'Required', requiresEntity: 'device', note: 'Selective isolation by default; full isolation only on ransomware alert names.' },
  { id: 'AC-04', name: 'Reset password', cls: 'containment', target: 'User', platform: 'Microsoft Graph', destructive: true, approval: 'Required', requiresEntity: 'user', note: 'Pair with Revoke session — a reset alone does not kill live refresh tokens.' },
  { id: 'AC-05', name: 'Block user sign-in', cls: 'containment', target: 'User', platform: 'Entra ID — CA policy', destructive: true, approval: 'Required', requiresEntity: 'user', note: 'Do not pair with Disable user — pick one enforcement point.' },
  { id: 'AC-06', name: 'Send ITSM ticket', cls: 'ticketing', target: 'Incident', platform: 'ServiceNow / Jira', destructive: false, approval: 'No', note: 'Available to every trigger. Default escalation path for uncertain alerts.' },
  { id: 'AC-07', name: 'Run Sentinel playbook', cls: 'playbook', target: 'Varies', platform: 'Azure Logic Apps', destructive: true, approval: 'Required', note: 'Blast radius is whatever the playbook does — treated as containment and gated accordingly.' },
  { id: 'AC-08', name: 'Send notification', cls: 'notification', target: 'Recipient group', platform: 'Email / SMS / ITSM', destructive: false, approval: 'No', note: 'Channel is a parameter, not a separate action. SMS is reserved for High severity on a confirmed true positive.' },
  { id: 'AC-09', name: 'Send monthly report', cls: 'reporting', target: 'Tenant', platform: 'Report builder + delivery', destructive: false, approval: 'No', note: 'Reachable only from a schedule.' },
];

export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a])) as Record<ActionId, ActionDef>;
export const ACTION_LABELS = Object.fromEntries(ACTIONS.map(a => [a.id, a.name])) as Record<ActionId, string>;

// ─── the trigger × action permission matrix ───────────────────────────────────
// Allowed = may execute · Gated = only after the applicable gates pass ·
// Blocked = mutually exclusive, must not be wired and must fail validation.

const B: Permission = 'blocked';
const A: Permission = 'allowed';
const G: Permission = 'gated';

// Only AC-06 + AC-08 reachable — the shape shared by TR-02 / TR-03 / TR-04 / TR-05.
const NOTIFY_ONLY: Record<ActionId, Permission> = {
  'AC-01': B, 'AC-02': B, 'AC-03': B, 'AC-04': B, 'AC-05': B,
  'AC-06': A, 'AC-07': B, 'AC-08': A, 'AC-09': B,
};

const REPORT_ONLY: Record<ActionId, Permission> = {
  'AC-01': B, 'AC-02': B, 'AC-03': B, 'AC-04': B, 'AC-05': B,
  'AC-06': B, 'AC-07': B, 'AC-08': B, 'AC-09': A,
};

export const MATRIX: Record<TriggerId, Record<ActionId, Permission>> = {
  'TR-01': { 'AC-01': G, 'AC-02': G, 'AC-03': G, 'AC-04': G, 'AC-05': G, 'AC-06': A, 'AC-07': G, 'AC-08': A, 'AC-09': B },
  'TR-02': NOTIFY_ONLY,
  'TR-03': NOTIFY_ONLY,
  'TR-04': NOTIFY_ONLY,
  'TR-05': NOTIFY_ONLY,
  'TR-06': REPORT_ONLY,
  'TR-07': REPORT_ONLY,
};

// Why a cell is blocked — shown to the user instead of the rule id.
export const BLOCKED_REASON: Record<TriggerId, string> = {
  'TR-01': 'Reports only come from a schedule.',
  'TR-02': "The agent has explicitly said it doesn't know — uncertainty can't authorise containment.",
  'TR-03': 'An ingestion anomaly is an operational signal, not a security verdict.',
  'TR-04': 'A budget anomaly is a commercial signal, not a security verdict.',
  'TR-05': 'A threat-intel match is an indicator, not a confirmed compromise — severity never unlocks containment.',
  'TR-06': 'A schedule fires with no alert and no entity, so there is nothing to act on or notify about.',
  'TR-07': 'A schedule fires with no alert and no entity, so there is nothing to act on or notify about.',
};

export function permissionFor(trigger: TriggerId, action: ActionId): Permission {
  return MATRIX[trigger][action];
}

// ─── conditions ───────────────────────────────────────────────────────────────

export interface ConditionDef {
  id: ConditionId;
  name: string;
  evaluatedOn: string;
  examples: string[];
  requiresTriage?: boolean; // field only exists after ND-01 has run
  mandatory?: boolean;
  note: string;
}

export const CONDITIONS: ConditionDef[] = [
  { id: 'CO-01', name: 'Alert provider', evaluatedOn: 'Alert metadata', examples: ['Microsoft Defender XDR', 'Entra ID Protection', 'Defender for Endpoint', 'Defender for Office 365', 'Defender for Cloud Apps', 'Microsoft Sentinel'], note: 'Coarse scoping — keeps a flow inside one provider’s alert semantics.' },
  { id: 'CO-02', name: 'Alert type', evaluatedOn: 'Alert metadata', examples: ['Impossible travel', 'Suspicious inbox forwarding rule', 'Malware detected', 'Password spray', 'Anomalous token'], note: 'Bind to explicit alert names from the production corpus, not free text.' },
  { id: 'CO-03', name: 'Triage confidence', evaluatedOn: 'Triage agent output', examples: ['≥ 0.90 (high)', '0.70–0.90 (medium)', '< 0.70 (low)'], requiresTriage: true, note: 'Cannot be evaluated unless the triage agent has already run.' },
  { id: 'CO-04', name: 'Triage verdict', evaluatedOn: 'Triage agent output', examples: ['TruePositive', 'FalsePositive', 'Undetermined'], requiresTriage: true, note: 'Redundant with the trigger in most flows; kept explicit for auditability.' },
  { id: 'CO-05', name: 'Threat intel severity', evaluatedOn: 'TI enrichment', examples: ['Low', 'Medium', 'High'], note: 'Selects notification channel and urgency only.' },
  { id: 'CO-06', name: 'Entity present on alert', evaluatedOn: 'Alert entities', examples: ['User (UPN)', 'Device (DeviceId)', 'IP'], note: 'Hard prerequisite — no device entity means a device cannot be isolated.' },
  { id: 'CO-07', name: 'Day of month', evaluatedOn: 'Scheduler context', examples: ['1', '5', '15', 'last'], note: 'Schedule-only. Meaningless on an alert-driven flow.' },
  { id: 'CO-08', name: 'Deviation threshold', evaluatedOn: 'Calibrate / Cost metric', examples: ['+25% vs. 30-day baseline', '−50% (silent source)', '> 110% of monthly commitment'], note: 'Set per tenant — noisy thresholds are the main false-positive source on platform triggers.' },
  { id: 'CO-09', name: 'Tenants', evaluatedOn: 'Flow context', examples: [], mandatory: true, note: 'Mandatory on every flow. Never let one run tenant-agnostic.' },
  { id: 'CO-10', name: 'Log source / table', evaluatedOn: 'Calibrate metadata', examples: ['SecurityEvent', 'Syslog', 'CommonSecurityLog', 'SigninLogs'], note: 'Scopes ingestion-anomaly flows to the sources the customer actually pays for.' },
  { id: 'CO-11', name: 'Report type', evaluatedOn: 'Reporting context', examples: ['Executive monthly', 'Detection coverage', 'Cost & ingestion', 'Tuning summary'], note: 'Selects the report template.' },
];

export const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map(c => [c.id, c])) as Record<ConditionId, ConditionDef>;

// ─── gates ────────────────────────────────────────────────────────────────────
// A gate can stop *or downgrade* a flow. The on-fail behaviour is the point:
// the confidence gate failing is a downgrade path, not an error path.

export interface GateDef {
  id: GateId;
  name: string;      // plain-language label
  onFail: string;
  appliesTo: 'containment' | 'destructive' | 'all';
  alwaysOn?: boolean;  // cannot be switched off
  defaultOn: boolean;
  note: string;
}

export const GATES: GateDef[] = [
  { id: 'GA-01', name: 'Confidence is high enough', onFail: 'Skip containment — raise a ticket and notify instead', appliesTo: 'containment', alwaysOn: true, defaultOn: true, note: 'The single most important gate, and the reason triage always runs before the response plan.' },
  { id: 'GA-04', name: 'Tenant has approved this action', onFail: 'Fall back to analyst approval', appliesTo: 'containment', defaultOn: true, note: 'A contractual position per tenant, never a platform default.' },
  { id: 'GA-02', name: 'An analyst approves in time', onFail: 'Raise a ticket, take no containment', appliesTo: 'destructive', defaultOn: true, note: 'Can be waived per tenant for a named, agreed subset of actions only.' },
  { id: 'GA-05', name: 'Not a VIP or critical asset', onFail: 'Skip containment — raise a ticket and notify', appliesTo: 'containment', defaultOn: true, note: 'Disabling a break-glass or service account is worse than the incident.' },
  { id: 'GA-03', name: 'Blast radius stays small', onFail: 'Stop the flow and page on-call', appliesTo: 'containment', defaultOn: true, note: 'Protects against a bad detection fanning out across a tenant.' },
  { id: 'GA-06', name: 'Inside the automation window', onFail: 'Queue for the next window', appliesTo: 'containment', defaultOn: false, note: 'Optional per tenant. Never applied to High severity.' },
  { id: 'GA-07', name: 'Not a repeat within the cooldown', onFail: 'Suppress and annotate', appliesTo: 'all', alwaysOn: true, defaultOn: true, note: 'Storm control. Without it one misconfigured log source can page on-call a hundred times.' },
];

export const GATE_BY_ID = Object.fromEntries(GATES.map(g => [g.id, g])) as Record<GateId, GateDef>;

export interface GateConfig {
  confidence: number;   // GA-01, 0–1
  maxUsers: number;     // GA-03
  maxDevices: number;   // GA-03
  approvalSla: number;  // GA-02, minutes
  cooldownMin: number;  // GA-07, minutes
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  confidence: 0.9, maxUsers: 5, maxDevices: 3, approvalSla: 15, cooldownMin: 60,
};

// Which gates are in play for a given set of actions.
export function gatesFor(actions: ActionId[]): GateDef[] {
  const defs = actions.map(a => ACTION_BY_ID[a]);
  const hasContainment = defs.some(d => d.cls === 'containment' || d.cls === 'playbook');
  const hasDestructive = defs.some(d => d.destructive);
  return GATES.filter(g =>
    g.appliesTo === 'all' ||
    (g.appliesTo === 'containment' && hasContainment) ||
    (g.appliesTo === 'destructive' && hasDestructive)
  );
}

// ─── the flow ─────────────────────────────────────────────────────────────────

export interface FlowCondition {
  key: string;
  id: ConditionId;
  value: string; // human-readable configured value
}

export interface FlowAction {
  key: string;       // instance id — an action can appear more than once (severity routing)
  action: ActionId;
  branch?: string;   // "only when …" — the workbook's Branch / applies-when column
  params?: Record<string, string>;
}

export interface SoarFlow {
  id: string;
  name: string;
  trigger: TriggerId | null;
  conditions: FlowCondition[];
  gates: Partial<Record<GateId, boolean>>;
  gateConfig: GateConfig;
  enrich: boolean;      // ND-03
  aggregate: boolean;   // ND-05
  actions: FlowAction[];
  clientScope: string[]; // CO-09 — ['all'] = every tenant
  owner: Owner;
  isPrebuilt: boolean;
  isActive: boolean;
  lastRun?: string;
  priority: number;
}

// ─── mock reference data ──────────────────────────────────────────────────────

export const PROVIDER_NAMES = [
  'Microsoft Defender XDR',
  'Entra ID Protection',
  'Defender for Identity',
  'Defender for Endpoint',
  'Defender for Office 365',
  'Defender for Cloud Apps',
  'Microsoft Sentinel',
];

export const ALERT_TYPES = [
  'Impossible travel',
  'Suspicious inbox forwarding rule',
  'Malware detected',
  'Password spray',
  'Anomalous token',
  'Mass download / data exfiltration',
  'Ransomware behaviour',
  'Anomalous admin role assignment',
];

export const TENANT_NAMES = [
  'Nike', 'Adidas', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla',
  'Meta', 'Netflix', 'Spotify', 'Adobe', 'Oracle', 'SAP', 'Salesforce',
];

export const LOG_SOURCES = ['SecurityEvent', 'Syslog', 'CommonSecurityLog', 'SigninLogs', 'AzureActivity'];
export const REPORT_TYPES = ['Executive monthly', 'Detection coverage', 'Cost & ingestion', 'Tuning summary'];
export const SENTINEL_PLAYBOOKS = [
  'Purge similar mail (O365)', 'Collect endpoint forensics', 'Snapshot VM disks',
  'Revoke OAuth consent grant', 'Enrich with threat intel', 'Quarantine mailbox',
];
export const OWNERS: Owner[] = ['SOC automation', 'Calibrate', 'Cost', 'Enrich', 'Reporting'];

export const makeKey = () => `s-${Math.random().toString(36).slice(2, 9)}`;

let k = 0;
const nk = () => `k${++k}`;
const act = (action: ActionId, branch?: string, params?: Record<string, string>): FlowAction =>
  ({ key: nk(), action, branch, params });
const cond = (id: ConditionId, value: string): FlowCondition => ({ key: nk(), id, value });

const containmentGates: Partial<Record<GateId, boolean>> = {
  'GA-01': true, 'GA-02': true, 'GA-03': true, 'GA-04': true, 'GA-05': true, 'GA-06': false, 'GA-07': true,
};
const notifyGates: Partial<Record<GateId, boolean>> = { 'GA-07': true };

// ─── the nine designed flows ──────────────────────────────────────────────────

export const MOCK_FLOWS: SoarFlow[] = [
  {
    id: 'FL-01', name: 'Confirmed identity compromise — session containment',
    trigger: 'TR-01', owner: 'SOC automation', isPrebuilt: true, isActive: true, priority: 1, lastRun: '12m ago',
    conditions: [
      cond('CO-01', 'Entra ID Protection, Defender for Identity, Defender for Cloud Apps'),
      cond('CO-02', 'Agreed identity alert set'),
      cond('CO-03', '≥ 0.90'),
      cond('CO-06', 'User entity exists'),
    ],
    gates: containmentGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: true, aggregate: false, clientScope: ['all'],
    actions: [
      act('AC-04', undefined, { forceChange: 'Force change at next sign-in' }),
      act('AC-01'),
      act('AC-06', undefined, { detail: 'Ticket with full triage rationale' }),
      act('AC-08', undefined, { channel: 'Email', to: 'SOC + tenant contact' }),
    ],
  },
  {
    id: 'FL-02', name: 'Confirmed endpoint compromise — device isolation',
    trigger: 'TR-01', owner: 'SOC automation', isPrebuilt: true, isActive: true, priority: 2, lastRun: '43m ago',
    conditions: [
      cond('CO-01', 'Defender for Endpoint'),
      cond('CO-03', '≥ 0.90'),
      cond('CO-06', 'Device entity exists'),
    ],
    gates: containmentGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [
      act('AC-03', undefined, { mode: 'Selective isolation; full on ransomware names' }),
      act('AC-06'),
      act('AC-08', undefined, { channel: 'Email' }),
    ],
  },
  {
    id: 'FL-03', name: 'Confirmed but medium confidence — escalate only',
    trigger: 'TR-01', owner: 'SOC automation', isPrebuilt: true, isActive: true, priority: 3, lastRun: '2h ago',
    conditions: [cond('CO-03', '0.70 – 0.90')],
    gates: { 'GA-01': true, 'GA-07': true }, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [
      act('AC-06', undefined, { detail: 'Ticket with proposed actions for analyst review' }),
      act('AC-08', undefined, { channel: 'Email', to: 'SOC queue' }),
    ],
  },
  {
    id: 'FL-04', name: 'Uncertain alert — analyst escalation',
    trigger: 'TR-02', owner: 'SOC automation', isPrebuilt: true, isActive: true, priority: 4, lastRun: '1h ago',
    conditions: [cond('CO-04', 'Undetermined')],
    gates: notifyGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [
      act('AC-06', undefined, { detail: 'Priority by alert severity' }),
      act('AC-08', undefined, { channel: 'Email', to: 'SOC queue' }),
    ],
  },
  {
    id: 'FL-05', name: 'Ingestion anomaly — customer notification',
    trigger: 'TR-03', owner: 'Calibrate', isPrebuilt: true, isActive: true, priority: 5, lastRun: '6h ago',
    conditions: [
      cond('CO-10', 'Billed source list'),
      cond('CO-08', '≥ +25% or ≤ −50%'),
    ],
    gates: notifyGates, gateConfig: { ...DEFAULT_GATE_CONFIG, cooldownMin: 1440 },
    enrich: false, aggregate: true, clientScope: ['all'],
    actions: [
      act('AC-08', undefined, { channel: 'Email', to: 'Tenant IT + CSM' }),
      act('AC-06', 'Deviation sustained 3 days', { detail: 'Ticket for investigation' }),
    ],
  },
  {
    id: 'FL-06', name: 'Budget anomaly — commercial alert',
    trigger: 'TR-04', owner: 'Cost', isPrebuilt: true, isActive: true, priority: 6, lastRun: '1d ago',
    conditions: [cond('CO-08', 'Projected spend > 110% of commitment')],
    gates: notifyGates, gateConfig: { ...DEFAULT_GATE_CONFIG, cooldownMin: 10080 },
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [
      act('AC-08', undefined, { channel: 'Email', to: 'Account owner + tenant IT lead' }),
      act('AC-06', 'Overrun > 130%', { detail: 'Ticket for cost review' }),
    ],
  },
  {
    id: 'FL-07', name: 'Threat intel match — severity-routed notification',
    trigger: 'TR-05', owner: 'Enrich', isPrebuilt: true, isActive: true, priority: 7, lastRun: '4h ago',
    conditions: [cond('CO-05', 'High / Medium / Low')],
    gates: notifyGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: true, clientScope: ['all'],
    actions: [
      act('AC-08', 'Severity is High', { channel: 'SMS + email', to: 'On-call' }),
      act('AC-06', 'Severity is High'),
      act('AC-08', 'Severity is Medium', { channel: 'Email', to: 'SOC queue' }),
      act('AC-08', 'Severity is Low', { channel: 'Weekly digest' }),
    ],
  },
  {
    id: 'FL-08', name: 'Monthly report on day of month',
    trigger: 'TR-07', owner: 'Reporting', isPrebuilt: true, isActive: true, priority: 8, lastRun: '9d ago',
    conditions: [
      cond('CO-07', 'Day 1'),
      cond('CO-11', 'Detection coverage'),
    ],
    gates: notifyGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [act('AC-09', undefined, { to: 'Tenant distribution list' })],
  },
  {
    id: 'FL-09', name: 'Monthly scheduled executive report',
    trigger: 'TR-06', owner: 'Reporting', isPrebuilt: false, isActive: false, priority: 9,
    conditions: [cond('CO-11', 'Executive monthly')],
    gates: notifyGates, gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false, aggregate: false, clientScope: ['all'],
    actions: [act('AC-09', undefined, { schedule: 'Monthly 06:00 CET' })],
  },
];

// ─── validation ───────────────────────────────────────────────────────────────
// The workbook's "Blocked steps" column, live. Everything the register marks
// High severity is enforced here rather than left to whoever draws the flow.

export interface Violation {
  severity: 'blocked' | 'warning';
  message: string;
  actionKey?: string;
}

export function validateFlow(flow: SoarFlow): Violation[] {
  const out: Violation[] = [];
  if (!flow.trigger) {
    return [{ severity: 'warning', message: 'Start by adding a trigger — it decides what this flow is allowed to do.' }];
  }
  const trigger = flow.trigger;
  const def = TRIGGER_BY_ID[trigger];
  const ids = flow.actions.map(a => a.action);

  // Matrix — an action the trigger cannot reach at all.
  for (const a of flow.actions) {
    if (permissionFor(trigger, a.action) === 'blocked') {
      out.push({
        severity: 'blocked',
        actionKey: a.key,
        message: `${ACTION_BY_ID[a.action].name} can't run from “${def.name}”. ${BLOCKED_REASON[trigger]}`,
      });
    }
  }

  // Entity prerequisites — an action with no target fails mid-flow and leaves
  // partial containment behind.
  const entityCond = flow.conditions.find(c => c.id === 'CO-06');
  const needsUser = flow.actions.some(a => ACTION_BY_ID[a.action].requiresEntity === 'user');
  const needsDevice = flow.actions.some(a => ACTION_BY_ID[a.action].requiresEntity === 'device');
  if (needsUser && !entityCond?.value.toLowerCase().includes('user')) {
    out.push({ severity: 'blocked', message: 'These actions target a user, but the flow never checks a user is on the alert. Add the entity condition.' });
  }
  if (needsDevice && !entityCond?.value.toLowerCase().includes('device')) {
    out.push({ severity: 'blocked', message: 'Isolate device needs a device on the alert, but the flow never checks for one. Add the entity condition.' });
  }

  // Two enforcement points for the same outcome.
  if (ids.includes('AC-02') && ids.includes('AC-05')) {
    out.push({ severity: 'warning', message: 'Disable user and Block user sign-in do the same job — pick one enforcement point.' });
  }
  if (ids.includes('AC-02') && ids.includes('AC-04')) {
    out.push({ severity: 'warning', message: 'Resetting the password on an account you are disabling is wasted work and a confusing signal to the service desk.' });
  }

  // Confidence has no source without triage.
  if (flow.conditions.some(c => CONDITION_BY_ID[c.id].requiresTriage) && !def.triage) {
    out.push({ severity: 'blocked', message: 'This flow reads the triage confidence or verdict, but its trigger never runs the triage agent.' });
  }

  // Conditions that make no sense for this trigger.
  for (const c of flow.conditions) {
    if (c.id !== 'CO-09' && !def.conditions.includes(c.id)) {
      out.push({ severity: 'blocked', message: `“${CONDITION_BY_ID[c.id].name}” isn't available on ${def.name.toLowerCase()} flows — there's no value to read.` });
    }
  }

  // Tenant scope is mandatory on every flow.
  if (flow.clientScope.length === 0) {
    out.push({ severity: 'blocked', message: 'No tenants selected. A flow that runs tenant-agnostic is a cross-tenant incident waiting to happen.' });
  }

  if (flow.actions.length === 0) {
    out.push({ severity: 'warning', message: 'This flow does nothing yet — add at least one action.' });
  }

  return out;
}

export const blockedCount = (flow: SoarFlow) =>
  validateFlow(flow).filter(v => v.severity === 'blocked').length;

// Reset password must execute before revoke session, otherwise live refresh
// tokens survive the reset. Applied for the user rather than asked about.
export function orderActions(actions: FlowAction[]): FlowAction[] {
  const out = [...actions];
  const reset = out.findIndex(a => a.action === 'AC-04');
  const revoke = out.findIndex(a => a.action === 'AC-01');
  if (reset > -1 && revoke > -1 && revoke < reset) {
    const [moved] = out.splice(revoke, 1);
    out.splice(reset, 0, moved);
  }
  return out;
}

export const wasReordered = (actions: FlowAction[]) => {
  const reset = actions.findIndex(a => a.action === 'AC-04');
  const revoke = actions.findIndex(a => a.action === 'AC-01');
  return reset > -1 && revoke > -1 && revoke === reset + 1;
};

// Steps, the way the workbook counts them: trigger + nodes + conditions + gates + actions.
export function stepCount(flow: SoarFlow): number {
  if (!flow.trigger) return 0;
  const def = TRIGGER_BY_ID[flow.trigger];
  const nodes = (def.triage ? 1 : 0) + (def.respond ? 1 : 0) + (flow.enrich ? 1 : 0) +
    (flow.aggregate ? 1 : 0) + (def.cls === 'schedule' ? 1 : 0);
  const gates = gatesFor(flow.actions.map(a => a.action)).filter(g => flow.gates[g.id] !== false).length;
  return 1 + nodes + flow.conditions.length + 1 /* tenant scope */ + gates + flow.actions.length;
}

// Copying a flow — as a template or a duplicate — needs fresh block keys so the
// two copies can't share canvas identity.
export function cloneFlow(flow: SoarFlow, name?: string): SoarFlow {
  const copy: SoarFlow = JSON.parse(JSON.stringify(flow));
  return {
    ...copy,
    id: `FL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name: name ?? `${flow.name} (copy)`,
    conditions: copy.conditions.map(c => ({ ...c, key: makeKey() })),
    actions: copy.actions.map(a => ({ ...a, key: makeKey() })),
    isPrebuilt: false,
    isActive: false,
    lastRun: undefined,
  };
}

export function ownerFor(trigger: TriggerId): Owner {
  const def = TRIGGER_BY_ID[trigger];
  if (def.cls === 'schedule') return 'Reporting';
  return trigger === 'TR-03' ? 'Calibrate' : trigger === 'TR-04' ? 'Cost' : trigger === 'TR-05' ? 'Enrich' : 'SOC automation';
}

export function emptyFlow(): SoarFlow {
  return {
    id: `FL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name: 'Untitled flow',
    trigger: null,
    conditions: [],
    gates: { 'GA-01': true, 'GA-02': true, 'GA-03': true, 'GA-04': true, 'GA-05': true, 'GA-06': false, 'GA-07': true },
    gateConfig: DEFAULT_GATE_CONFIG,
    enrich: false,
    aggregate: false,
    actions: [],
    clientScope: ['all'],
    owner: 'SOC automation',
    isPrebuilt: false,
    isActive: false,
    priority: 99,
  };
}

// Deterministic mock dry-run for "Test / simulate".
export function simulateFlow(flow: SoarFlow): {
  matched: number; downgraded: number; actionsFired: { label: string; count: number }[]; minutesSaved: number;
} {
  const seed = flow.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const matched = 14 + (seed % 41);
  const hasConfidenceGate = gatesFor(flow.actions.map(a => a.action)).some(g => g.id === 'GA-01');
  const downgraded = hasConfidenceGate ? Math.round(matched * 0.18) : 0;
  const reached = matched - downgraded;
  const actionsFired = flow.actions.map((a, i) => ({
    label: ACTION_BY_ID[a.action].name + (a.branch ? ` · ${a.branch}` : ''),
    count: Math.max(1, reached - i),
  }));
  return { matched, downgraded, actionsFired, minutesSaved: matched * 14 };
}
