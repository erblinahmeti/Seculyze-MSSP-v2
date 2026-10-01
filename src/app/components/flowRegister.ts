// ─── Flow register ───────────────────────────────────────────────────────────
//
// Transcribed from "SOAR flow v0.csv" — the stakeholders' own list of what can
// trigger a flow, what it can decide on, and what it can do. This file is the
// source of truth for the rule builder; soarData.ts stays as it is for the
// older canvas, the lo-fi page and the frozen incidents backup.
//
// The sheet's shape is three groups, and the group is what governs everything:
//
//   alert      6 triggers · 8 condition types · 20 actions
//   schedule   1 trigger  · 2 condition types ·  8 actions
//   platform   2 triggers · 4 condition types ·  8 actions
//
// Within the alert group every trigger reaches every action — confirmed, and
// taken from the sheet literally rather than inferred. Authority therefore
// comes from the Approval condition, not from which trigger fired.
//
// The sheet lists six further alert triggers in red — Selected alert, Selected
// entity, Incident created, Incident closed, Device changed, User changed —
// which are out of scope for v1 and are deliberately absent here rather than
// hidden behind a flag. They come back by re-adding them to TRIGGERS and the
// TriggerId union; nothing else in this file assumes a fixed count.

export type Group = 'alert' | 'schedule' | 'platform';

export type TriggerId =
  | 'tp' | 'ti-high' | 'ti-med' | 'ti-low' | 'fp' | 'another-playbook'
  | 'schedule'
  | 'ingestion-anomaly' | 'budget-anomaly';

export type ConditionId =
  | 'tool' | 'alert-rule' | 'account-type' | 'blast-radius'
  | 'cooldown' | 'approval' | 'ml-confidence' | 'customers'
  | 'timing'
  | 'threshold' | 'ingestion-stop' | 'log-source';

export type ActionId =
  | 'revoke-session' | 'disable-user' | 'isolate-device' | 'quarantine-file'
  | 'quarantine-email' | 'reset-password' | 'create-ticket' | 'update-ticket'
  | 'add-comment' | 'assign-analyst' | 'run-playbook' | 'change-severity'
  | 'get-information' | 'search' | 'send-email' | 'send-sms'
  | 'block-ip' | 'block-domain' | 'add-tag' | 'send-incident-report'
  | 'send-monthly-report';

// ─── triggers ────────────────────────────────────────────────────────────────

export interface TriggerDef {
  id: TriggerId;
  name: string;
  group: Group;
  /** What actually raises it — shown under the picker so the choice is concrete. */
  source: string;
}

export const TRIGGERS: TriggerDef[] = [
  { id: 'tp',               name: 'True positive',        group: 'alert',    source: 'Triage verdict = TruePositive' },
  { id: 'ti-high',          name: 'Threat intel — high',  group: 'alert',    source: 'IOC match, high severity' },
  { id: 'ti-med',           name: 'Threat intel — medium',group: 'alert',    source: 'IOC match, medium severity' },
  { id: 'ti-low',           name: 'Threat intel — low',   group: 'alert',    source: 'IOC match, low severity' },
  { id: 'fp',               name: 'False positive',       group: 'alert',    source: 'Triage verdict = FalsePositive' },
  { id: 'another-playbook', name: 'Another playbook',     group: 'alert',    source: 'Chained from a playbook that has finished' },

  { id: 'schedule',         name: 'On a schedule',        group: 'schedule', source: 'Scheduler' },

  { id: 'ingestion-anomaly',name: 'Ingestion anomaly',    group: 'platform', source: 'Log source volume deviation' },
  { id: 'budget-anomaly',   name: 'Budget anomaly',       group: 'platform', source: 'Ingestion spend vs commitment' },
];

export const TRIGGER_BY_ID =
  Object.fromEntries(TRIGGERS.map(t => [t.id, t])) as Record<TriggerId, TriggerDef>;

export const GROUP_LABEL: Record<Group, string> = {
  alert: 'From an alert or incident',
  schedule: 'On a schedule',
  platform: 'From the platform',
};

/** For the chip that sits beside a trigger name, where the long label repeats it. */
export const GROUP_SHORT: Record<Group, string> = {
  alert: 'Alert / incident',
  schedule: 'Schedule',
  platform: 'Platform',
};

// ─── conditions, by group ────────────────────────────────────────────────────

export type ControlKind = 'enum' | 'multi' | 'number' | 'text' | 'toggle';

export interface ConditionDef {
  id: ConditionId;
  name: string;
  operators: string[];
  kind: ControlKind;
  options?: string[];
  placeholder?: string;
  /** Shown under the row — why this exists, or what is still undecided. */
  hint?: string;
  /** Marked as an open question in the source sheet. */
  unresolved?: boolean;
}

export const TOOL_NAMES = [
  'Defender for Cloud', 'Detection-Fusion', 'Microsoft Threat Intelligence Center',
  'Defender for Cloud Apps', 'Defender for Endpoint', 'Defender for Office365',
  'Entra Identity Protection', 'Defender for Identity', 'Microsoft Sentinel',
  'Sentinel Fusion', 'Microsoft ApplicationProtection',
  'Office 365 Security and Compliance', 'Microsoft Endpoint DLP',
];

export const CUSTOMERS = [
  'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok',
  'New Balance', 'Asics', 'Converse', 'Vans',
];

export const LOG_SOURCES = [
  'All log sources', 'SecurityEvent', 'Syslog', 'CommonSecurityLog',
  'SigninLogs', 'AzureActivity', 'DeviceNetworkEvents',
];

export const TIMING_OPTIONS = [
  'Every day', 'Every week', 'Every month on the 1st',
  'Every month on the 15th', 'Every month on the last day', 'Every quarter',
];

export const CONDITIONS: ConditionDef[] = [
  { id: 'tool', name: 'Tool name', operators: ['is', 'is not', 'is one of'],
    kind: 'enum', options: TOOL_NAMES,
    hint: 'Which product raised the alert.' },

  // The sheet is specific here: a picker over real alert rules, with wildcards,
  // so one rule can cover "All *Malware* alert rules" in a single line.
  { id: 'alert-rule', name: 'Alert rule', operators: ['is', 'is not', 'matches'],
    kind: 'text', placeholder: '*Malware*',
    hint: 'Sentinel shows active rules only, Defender shows all. Wildcards allowed — *Malware* matches every malware rule.' },

  { id: 'account-type', name: 'Device / account type', operators: ['excludes'],
    kind: 'enum', options: ['Service accounts', 'Servers (including AD)', 'Service accounts and servers'],
    hint: 'Excluding servers is still an open question in the source sheet.' },

  { id: 'blast-radius', name: 'Blast radius', operators: ['is at most'],
    kind: 'number', placeholder: '5',
    hint: 'How this gets measured is not settled yet.', unresolved: true },

  { id: 'cooldown', name: 'Repeat / cool-down', operators: ['at most once every'],
    kind: 'enum', options: ['15 minutes', '1 hour', '4 hours', '24 hours'],
    hint: 'Stops one misconfigured source sending a hundred thousand tickets.' },

  { id: 'approval', name: 'Approval', operators: ['required from'],
    kind: 'enum', options: ['An analyst', 'A senior analyst', 'The customer'],
    hint: 'Where authority comes from, now that every trigger can reach every action.' },

  { id: 'ml-confidence', name: 'ML confidence', operators: ['is above', 'is below'],
    kind: 'number', placeholder: '0.90',
    hint: 'The sheet notes this is enough on its own to decide whether to revoke a session immediately.' },

  { id: 'customers', name: 'Customers', operators: ['is one of', 'is not one of'],
    kind: 'multi', options: CUSTOMERS,
    hint: 'Never let a flow run tenant-agnostic.' },

  { id: 'timing', name: 'Timing', operators: ['is'],
    kind: 'enum', options: TIMING_OPTIONS },

  { id: 'threshold', name: 'Threshold', operators: ['is above', 'is below'],
    kind: 'text', placeholder: '25% over budget',
    hint: 'Pre-defined per tenant.' },

  { id: 'ingestion-stop', name: 'Ingestion stop', operators: ['is'],
    kind: 'enum', options: ['Armed', 'Not armed'],
    hint: 'Whether Seculyze may forcibly stop ingestion on this source.' },

  { id: 'log-source', name: 'Log source / table', operators: ['is', 'is one of'],
    kind: 'enum', options: LOG_SOURCES },
];

export const CONDITION_BY_ID =
  Object.fromEntries(CONDITIONS.map(c => [c.id, c])) as Record<ConditionId, ConditionDef>;

const ALERT_CONDITIONS: ConditionId[] =
  ['tool', 'alert-rule', 'account-type', 'ml-confidence', 'blast-radius', 'cooldown', 'approval', 'customers'];
const SCHEDULE_CONDITIONS: ConditionId[] = ['customers', 'timing'];
const PLATFORM_CONDITIONS: ConditionId[] = ['customers', 'threshold', 'ingestion-stop', 'log-source'];

// ─── actions, by group ───────────────────────────────────────────────────────

export interface ActionDef {
  id: ActionId;
  name: string;
  /** The "from which action system" column — FYI on the row, not a phase. */
  system: string;
  /** Changes something in the customer's estate. */
  destructive: boolean;
  param?: { kind: ControlKind; options?: string[]; placeholder?: string };
}

export const ACTIONS: ActionDef[] = [
  { id: 'revoke-session',      name: 'Revoke user session',   system: 'Sentinel Playbook → Entra ID', destructive: true },
  { id: 'disable-user',        name: 'Disable user in Entra ID', system: 'Sentinel Playbook → Entra ID', destructive: true },
  { id: 'isolate-device',      name: 'Isolate device',        system: 'Sentinel Playbook → Defender for Endpoint', destructive: true },
  { id: 'quarantine-file',     name: 'Quarantine file',       system: 'Sentinel Playbook → Defender for Endpoint', destructive: true },
  { id: 'quarantine-email',    name: 'Quarantine e-mail',     system: 'Sentinel Playbook → Defender for Endpoint', destructive: true },
  { id: 'reset-password',      name: 'Reset password',        system: 'Sentinel Playbook → Entra ID', destructive: true },
  { id: 'block-ip',            name: 'Block IP',              system: 'Sentinel Playbook', destructive: true },
  { id: 'block-domain',        name: 'Block domain',          system: 'Sentinel Playbook', destructive: true },
  { id: 'run-playbook',        name: 'Run Sentinel playbook', system: 'Whatever playbook you need', destructive: true,
    param: { kind: 'text', placeholder: 'Playbook name' } },

  { id: 'create-ticket',       name: 'Create ticket',         system: 'Seculyze Playbook', destructive: false },
  { id: 'update-ticket',       name: 'Update ticket',         system: 'Seculyze Playbook', destructive: false },
  { id: 'add-comment',         name: 'Add comment',           system: 'Seculyze Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Comment' } },
  { id: 'assign-analyst',      name: 'Assign analyst',        system: 'Sentinel Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Analyst or queue' } },
  { id: 'change-severity',     name: 'Change severity',       system: 'Seculyze Playbook', destructive: false,
    param: { kind: 'enum', options: ['High', 'Medium', 'Low', 'Informational'] } },
  { id: 'add-tag',             name: 'Add tag',               system: 'Seculyze Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Tag' } },
  { id: 'get-information',     name: 'Get information',       system: 'Seculyze Playbook', destructive: false },
  { id: 'search',              name: 'Search',                system: 'Sentinel Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Query' } },
  { id: 'send-email',          name: 'Send e-mail',           system: 'Sentinel Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Enter email address' } },
  { id: 'send-sms',            name: 'Send SMS / text',       system: 'Seculyze Playbook', destructive: false,
    param: { kind: 'text', placeholder: 'Enter number' } },
  { id: 'send-incident-report',name: 'Send incident report',  system: 'Seculyze Playbook', destructive: false },
  { id: 'send-monthly-report', name: 'Send monthly report',   system: 'Seculyze Playbook', destructive: false },
];

export const ACTION_BY_ID =
  Object.fromEntries(ACTIONS.map(a => [a.id, a])) as Record<ActionId, ActionDef>;

const ALERT_ACTIONS: ActionId[] = [
  'revoke-session', 'disable-user', 'isolate-device', 'quarantine-file', 'quarantine-email',
  'reset-password', 'block-ip', 'block-domain', 'run-playbook', 'change-severity',
  'create-ticket', 'update-ticket', 'add-comment', 'assign-analyst', 'add-tag',
  'get-information', 'search', 'send-email', 'send-sms', 'send-incident-report',
];
const SCHEDULE_ACTIONS: ActionId[] = [
  'send-monthly-report', 'send-email', 'send-sms',
  'create-ticket', 'update-ticket', 'add-comment', 'assign-analyst', 'add-tag',
];
const PLATFORM_ACTIONS: ActionId[] = [
  'run-playbook', 'send-email', 'send-sms',
  'create-ticket', 'update-ticket', 'add-comment', 'assign-analyst', 'add-tag',
];

// ─── what a given trigger reaches ────────────────────────────────────────────
// The two functions the rule builder is built around. A condition or action
// missing from these lists is never rendered — not greyed, absent.

export function conditionsFor(trigger: TriggerId | null): ConditionId[] {
  if (!trigger) return [];
  const g = TRIGGER_BY_ID[trigger].group;
  return g === 'alert' ? ALERT_CONDITIONS : g === 'schedule' ? SCHEDULE_CONDITIONS : PLATFORM_CONDITIONS;
}

export function actionsFor(trigger: TriggerId | null): ActionId[] {
  if (!trigger) return [];
  const g = TRIGGER_BY_ID[trigger].group;
  return g === 'alert' ? ALERT_ACTIONS : g === 'schedule' ? SCHEDULE_ACTIONS : PLATFORM_ACTIONS;
}

/** Why the rest are not offered — shown under the list, not on a dead option. */
export const GROUP_LIMIT_REASON: Record<Group, string> = {
  alert: 'Monthly reports come from a schedule.',
  schedule: 'A schedule fires with no alert and no entity, so there is nothing to contain.',
  platform: 'An ingestion or budget anomaly is an operational signal, not a security verdict.',
};

// ─── the flow ────────────────────────────────────────────────────────────────

export interface FlowCondition { key: string; id: ConditionId; operator: string; value: string }
export interface FlowAction { key: string; action: ActionId; param?: string }

export interface Flow {
  id: string;
  name: string;
  trigger: TriggerId | null;
  triggerParam?: string;
  matchAll: boolean;
  conditions: FlowCondition[];
  actions: FlowAction[];
  isActive: boolean;
  isPrebuilt: boolean;
  lastRun?: string;
  runs30d?: number;
}

export const makeKey = () => `k-${Math.random().toString(36).slice(2, 9)}`;

export const emptyFlow = (): Flow => ({
  id: makeKey(), name: '', trigger: null, matchAll: true,
  conditions: [], actions: [], isActive: false, isPrebuilt: false,
});

export const cloneFlow = (f: Flow, name: string): Flow => ({
  ...f, id: makeKey(), name, isPrebuilt: false, isActive: false,
  conditions: f.conditions.map(c => ({ ...c, key: makeKey() })),
  actions: f.actions.map(a => ({ ...a, key: makeKey() })),
});

/** The sentence a flow reads as — built once here, shown in the list and the builder. */
export function describe(f: Flow): string {
  if (!f.trigger) return 'No trigger set.';
  const t = TRIGGER_BY_ID[f.trigger];
  const when = t.name.toLowerCase() + (f.triggerParam ? ` (${f.triggerParam})` : '');
  const cs = f.conditions
    .filter(c => c.value)
    .map(c => `${CONDITION_BY_ID[c.id].name.toLowerCase()} ${c.operator} ${c.value}`);
  const joined = cs.length ? ` and ${cs.join(f.matchAll ? ' and ' : ' or ')}` : '';
  const acts = f.actions.map(a => ACTION_BY_ID[a.action].name.toLowerCase());
  const then = acts.length ? ` → ${acts.join(', then ')}` : ' → nothing yet';
  return `When ${when}${joined}${then}`;
}

const c = (id: ConditionId, operator: string, value: string): FlowCondition =>
  ({ key: makeKey(), id, operator, value });
const a = (action: ActionId, param?: string): FlowAction => ({ key: makeKey(), action, param });

export const MOCK_FLOWS: Flow[] = [
  { id: makeKey(), name: 'Auto-close Defender malware', trigger: 'fp', matchAll: true,
    conditions: [c('tool', 'is', 'Defender for Endpoint'), c('alert-rule', 'matches', '*Malware*'), c('customers', 'is one of', 'All 9')],
    actions: [a('add-comment', 'Closed automatically — known benign malware rule'), a('add-tag', 'auto-closed')],
    isActive: true, isPrebuilt: true, lastRun: '12 min ago', runs30d: 214 },

  { id: makeKey(), name: 'Contain a compromised user', trigger: 'tp', matchAll: true,
    conditions: [c('ml-confidence', 'is above', '0.90'), c('approval', 'required from', 'An analyst'), c('customers', 'is one of', 'Nike, Adidas')],
    actions: [a('revoke-session'), a('reset-password'), a('create-ticket')],
    isActive: true, isPrebuilt: true, lastRun: '2 h ago', runs30d: 11 },

  { id: makeKey(), name: 'Monthly customer report', trigger: 'schedule', triggerParam: 'Every month on the 1st', matchAll: true,
    conditions: [c('customers', 'is one of', 'All 9'), c('timing', 'is', 'Every month on the 1st')],
    actions: [a('send-monthly-report'), a('send-email', 'reports@seculyze.com')],
    isActive: true, isPrebuilt: true, lastRun: '1 Sep', runs30d: 1 },

  { id: makeKey(), name: 'Ingestion spike — notify', trigger: 'ingestion-anomaly', matchAll: true,
    conditions: [c('threshold', 'is above', '450% of expected'), c('log-source', 'is one of', 'All log sources'), c('customers', 'is one of', 'All 9')],
    actions: [a('create-ticket'), a('send-email', 'soc@seculyze.com')],
    isActive: true, isPrebuilt: false, lastRun: '4 h ago', runs30d: 6 },

  { id: makeKey(), name: 'Isolate on ransomware behaviour', trigger: 'tp', matchAll: true,
    conditions: [c('alert-rule', 'matches', '*Ransomware*'), c('approval', 'required from', 'A senior analyst'), c('blast-radius', 'is at most', '3')],
    actions: [a('isolate-device'), a('create-ticket'), a('send-sms', '+45 …')],
    isActive: false, isPrebuilt: false, runs30d: 0 },
];
