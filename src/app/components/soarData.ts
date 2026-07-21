// ─── SOAR Flow Builder — types, block palette, and mock data ─────────────────
// Prototype only: all data is mocked, no backend. Types deliberately echo the
// AlertRule / NoiseReductionRule patterns (alertType + clientNames scoping).

export type ImpactTier = 'low' | 'medium' | 'high';
export type ExecutionMode = 'auto' | 'staged' | 'recommend';
export type RiskLevel = 'Low' | 'Medium' | 'High';

export type SoarAction =
  | 'isolate_device'
  | 'block_user'
  | 'revoke_sessions'
  | 'reset_password'
  | 'send_itsm_ticket'
  | 'run_sentinel_playbook';

// Mirrors NotificationChannel in Notifications.tsx
export type NotificationChannel = {
  id: string;
  type: 'email' | 'phone' | 'itsm';
  value: string;
  itsmType?: 'ServiceNow' | 'Jira' | 'PagerDuty' | 'Slack';
};

export type FlowNode =
  | { id: string; kind: 'trigger'; alertTypes: string[]; providerNames: string[] }
  | { id: string; kind: 'triage'; minConfidence: number; minRisk: RiskLevel }
  | { id: string; kind: 'respond' }
  | { id: string; kind: 'condition'; expr: string }
  | { id: string; kind: 'action'; action: SoarAction; params?: Record<string, unknown>; tier: ImpactTier }
  | { id: string; kind: 'notify'; channels: NotificationChannel[]; template: string };

export type NodeKind = FlowNode['kind'];

export interface SoarFlow {
  id: string;
  name: string;
  scenarioId?: string;
  isPrebuilt: boolean;
  alertTypes: string[];
  providerNames: string[];
  clientScope: string[]; // ['all'] = every tenant
  clientLevels?: ('Level 1' | 'Level 2' | 'Level 3' | 'Level 4')[];
  severityScope?: RiskLevel[];
  confidenceThreshold: number;
  minRisk: RiskLevel;
  executionMode: ExecutionMode;
  nodes: FlowNode[];
  isActive: boolean;
  author: 'Seculyze' | 'Custom';
  lastRun?: string; // human readable, mocked
  priority: number; // first-match-wins ordering
}

export interface ScheduledReport {
  id: string;
  name: string;
  cadence: 'weekly' | 'monthly' | 'quarterly';
  clientScope: string[];
  channels: NotificationChannel[];
  format: 'email_html' | 'pdf' | 'dashboard_link';
  sections: ('actions' | 'time_saved' | 'top_scenarios' | 'approvals')[];
  isActive: boolean;
  nextRun: string;
}

// ─── palette metadata ─────────────────────────────────────────────────────────

export interface BlockDef {
  key: string;
  kind: NodeKind;
  action?: SoarAction;
  label: string;
  group: 'Trigger & agents' | 'Logic & control' | 'Actions' | 'Notify';
  tier?: ImpactTier;
  description: string;
  source?: string; // which product executes it
}

// Impact colours — semantic, separate from the brand accent
export const TIER_COLORS: Record<ImpactTier, { rail: string; bg: string; text: string; border: string }> = {
  high:   { rail: 'bg-[#c2453d]', bg: 'bg-[#f7e6e4]', text: 'text-[#c2453d]', border: 'border-[#c2453d]/40' },
  medium: { rail: 'bg-[#c07d1e]', bg: 'bg-[#f7efdf]', text: 'text-[#c07d1e]', border: 'border-[#c07d1e]/40' },
  low:    { rail: 'bg-[#2f7d52]', bg: 'bg-[#e3f0e8]', text: 'text-[#2f7d52]', border: 'border-[#2f7d52]/40' },
};

export const NODE_STYLE: Record<NodeKind, { rail: string; bg: string; border: string }> = {
  trigger:   { rail: 'bg-[#092E3F]', bg: 'bg-white', border: 'border-[#092E3F]/50' },
  triage:    { rail: 'bg-[#2A96A8]', bg: 'bg-[#e5f2f4]', border: 'border-[#2A96A8]/50' },
  respond:   { rail: 'bg-[#2A96A8]', bg: 'bg-[#e5f2f4]', border: 'border-[#2A96A8]/50' },
  condition: { rail: 'bg-[#87999f]', bg: 'bg-white', border: 'border-[#c4d2d6]' },
  action:    { rail: 'bg-[#87999f]', bg: 'bg-white', border: 'border-[#c4d2d6]' }, // overridden per tier
  notify:    { rail: 'bg-[#2f7d52]', bg: 'bg-[#e3f0e8]', border: 'border-[#2f7d52]/40' },
};

export const BLOCK_DEFS: BlockDef[] = [
  { key: 'trigger', kind: 'trigger', label: 'Trigger / scope', group: 'Trigger & agents', description: 'Fires when an alert matches the flow scope — alert type + ProviderName.' },
  { key: 'triage', kind: 'triage', label: 'Triage agent', group: 'Trigger & agents', description: 'Classifies the incident and emits confidence + risk score.' },
  { key: 'respond', kind: 'respond', label: 'Respond agent', group: 'Trigger & agents', description: 'Builds the recommended action plan for the incident.' },
  { key: 'condition', kind: 'condition', label: 'Condition / threshold', group: 'Logic & control', description: '"If confidence ≥ X and risk ≥ Y" — a configurable gate.' },
  { key: 'isolate_device', kind: 'action', action: 'isolate_device', tier: 'high', label: 'Isolate device', group: 'Actions', source: 'Defender for Endpoint', description: 'Network-isolate a host. Reversible but highly disruptive.' },
  { key: 'reset_password', kind: 'action', action: 'reset_password', tier: 'high', label: 'Reset password', group: 'Actions', source: 'Entra ID', description: 'Force credential reset. High user impact.' },
  { key: 'block_user', kind: 'action', action: 'block_user', tier: 'medium', label: 'Block user', group: 'Actions', source: 'Entra ID', description: 'Disable / block the account sign-in.' },
  { key: 'revoke_sessions', kind: 'action', action: 'revoke_sessions', tier: 'medium', label: 'Revoke sessions', group: 'Actions', source: 'Entra ID', description: 'Invalidate active tokens — sign the user out everywhere.' },
  { key: 'send_itsm_ticket', kind: 'action', action: 'send_itsm_ticket', tier: 'low', label: 'Send ITSM ticket', group: 'Actions', source: 'ServiceNow / Jira / PagerDuty', description: 'Raise a tracked ticket. Non-destructive.' },
  { key: 'run_sentinel_playbook', kind: 'action', action: 'run_sentinel_playbook', tier: 'low', label: 'Run Sentinel playbook', group: 'Actions', source: 'Sentinel / Logic Apps', description: 'Invoke an existing playbook. Impact depends on the playbook — set tier per node.' },
  { key: 'notify', kind: 'notify', label: 'Send notification', group: 'Notify', description: 'Email / Teams / Slack / SMS / ITSM — templated from the incident + actions taken.' },
];

export const ACTION_LABELS: Record<SoarAction, string> = {
  isolate_device: 'Isolate device',
  block_user: 'Block user',
  revoke_sessions: 'Revoke sessions',
  reset_password: 'Reset password',
  send_itsm_ticket: 'Send ITSM ticket',
  run_sentinel_playbook: 'Run Sentinel playbook',
};

export const EXECUTION_MODE_META: Record<ExecutionMode, { label: string; description: string; pillClass: string }> = {
  auto:      { label: 'Auto',      description: 'Execute above threshold, no gate.', pillClass: 'bg-[#e3f0e8] text-[#2f7d52]' },
  staged:    { label: 'Staged',    description: 'Never auto-fires — stages the full response for one-click analyst execution.', pillClass: 'bg-[#f7efdf] text-[#c07d1e]' },
  recommend: { label: 'Recommend', description: 'Recommend only — today\'s behaviour.', pillClass: 'bg-[#eef1f3] text-[#5c707a]' },
};

// ─── mock reference data ──────────────────────────────────────────────────────

export const PROVIDER_NAMES = [
  'Entra ID',
  'Entra ID Identity Protection',
  'Entra ID PIM',
  'Defender for Endpoint',
  'Defender for Office 365',
  'Defender for Cloud Apps',
  'Microsoft Sentinel',
];

export const ALERT_TYPES = [
  'Impossible / atypical travel',
  'Endpoint malware detected',
  'Reported / detected phishing',
  'Password spray / brute force',
  'Suspicious PowerShell / LOLBin',
  'Mass download / data exfiltration',
  'Ransomware behaviour',
  'Malicious OAuth consent / inbox rule',
  'Anomalous admin role assignment',
  'Legacy auth from risky IP',
];

export const TENANT_NAMES = [
  'Nike', 'Adidas', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla',
  'Meta', 'Netflix', 'Spotify', 'Adobe', 'Oracle', 'SAP', 'Salesforce',
];

export const SENTINEL_PLAYBOOKS = [
  'Purge similar mail (O365)',
  'Collect endpoint forensics',
  'Snapshot VM disks',
  'Revoke OAuth consent grant',
  'Enrich with threat intel',
  'Quarantine mailbox',
];

const soc = (id: string): NotificationChannel => ({ id, type: 'email', value: 'soc@seculyze.com' });
const teams = (id: string): NotificationChannel => ({ id, type: 'itsm', value: '#soc-alerts', itsmType: 'Slack' });

let nid = 0;
const n = () => `n${++nid}`;

// ─── the 10 prebuilt scenarios ────────────────────────────────────────────────

export const MOCK_FLOWS: SoarFlow[] = [
  {
    id: 'flow-1', scenarioId: 'scn-1', isPrebuilt: true, author: 'Seculyze', priority: 1,
    name: 'Impossible / atypical travel',
    alertTypes: ['Impossible / atypical travel'], providerNames: ['Entra ID', 'Entra ID Identity Protection'],
    clientScope: ['all'], confidenceThreshold: 80, minRisk: 'High', executionMode: 'staged',
    isActive: true, lastRun: '12m ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Impossible / atypical travel'], providerNames: ['Entra ID', 'Entra ID Identity Protection'] },
      { id: n(), kind: 'triage', minConfidence: 80, minRisk: 'High' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'action', action: 'reset_password', tier: 'high' },
      { id: n(), kind: 'notify', channels: [soc('c1'), teams('c2')], template: 'Sessions revoked and password reset for {{user}} after atypical travel.' },
    ],
  },
  {
    id: 'flow-2', scenarioId: 'scn-2', isPrebuilt: true, author: 'Seculyze', priority: 2,
    name: 'Endpoint malware detected',
    alertTypes: ['Endpoint malware detected'], providerNames: ['Defender for Endpoint'],
    clientScope: ['all'], confidenceThreshold: 85, minRisk: 'Medium', executionMode: 'auto',
    isActive: true, lastRun: '43m ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Endpoint malware detected'], providerNames: ['Defender for Endpoint'] },
      { id: n(), kind: 'triage', minConfidence: 85, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'isolate_device', tier: 'high' },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'ServiceNow' } },
      { id: n(), kind: 'notify', channels: [soc('c3')], template: 'Host {{device}} isolated after confirmed malware. Ticket {{ticket}} raised.' },
    ],
  },
  {
    id: 'flow-3', scenarioId: 'scn-3', isPrebuilt: true, author: 'Seculyze', priority: 3,
    name: 'Reported / detected phishing',
    alertTypes: ['Reported / detected phishing'], providerNames: ['Defender for Office 365'],
    clientScope: ['all'], confidenceThreshold: 75, minRisk: 'Medium', executionMode: 'auto',
    isActive: true, lastRun: '2h ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Reported / detected phishing'], providerNames: ['Defender for Office 365'] },
      { id: n(), kind: 'triage', minConfidence: 75, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'run_sentinel_playbook', tier: 'low', params: { playbook: 'Purge similar mail (O365)' } },
      { id: n(), kind: 'action', action: 'block_user', tier: 'medium', params: { target: 'sender' } },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'Jira' } },
    ],
  },
  {
    id: 'flow-4', scenarioId: 'scn-4', isPrebuilt: true, author: 'Seculyze', priority: 4,
    name: 'Password spray / brute force',
    alertTypes: ['Password spray / brute force'], providerNames: ['Entra ID'],
    clientScope: ['all'], confidenceThreshold: 90, minRisk: 'High', executionMode: 'auto',
    isActive: true, lastRun: '1h ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Password spray / brute force'], providerNames: ['Entra ID'] },
      { id: n(), kind: 'triage', minConfidence: 90, minRisk: 'High' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'block_user', tier: 'medium' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'notify', channels: [soc('c4')], template: 'Account {{user}} locked after confirmed password spray.' },
    ],
  },
  {
    id: 'flow-5', scenarioId: 'scn-5', isPrebuilt: true, author: 'Seculyze', priority: 5,
    name: 'Suspicious PowerShell / LOLBin',
    alertTypes: ['Suspicious PowerShell / LOLBin'], providerNames: ['Defender for Endpoint'],
    clientScope: ['all'], confidenceThreshold: 70, minRisk: 'Medium', executionMode: 'staged',
    isActive: false, lastRun: '3d ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Suspicious PowerShell / LOLBin'], providerNames: ['Defender for Endpoint'] },
      { id: n(), kind: 'triage', minConfidence: 70, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'isolate_device', tier: 'high' },
      { id: n(), kind: 'action', action: 'run_sentinel_playbook', tier: 'low', params: { playbook: 'Collect endpoint forensics' } },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'ServiceNow' } },
    ],
  },
  {
    id: 'flow-6', scenarioId: 'scn-6', isPrebuilt: true, author: 'Seculyze', priority: 6,
    name: 'Mass download / data exfil',
    alertTypes: ['Mass download / data exfiltration'], providerNames: ['Defender for Cloud Apps'],
    clientScope: ['all'], confidenceThreshold: 75, minRisk: 'High', executionMode: 'staged',
    isActive: true, lastRun: '6h ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Mass download / data exfiltration'], providerNames: ['Defender for Cloud Apps'] },
      { id: n(), kind: 'triage', minConfidence: 75, minRisk: 'High' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'action', action: 'block_user', tier: 'medium' },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'ServiceNow' } },
      { id: n(), kind: 'notify', channels: [soc('c5')], template: 'Access cut for {{user}} after mass download of {{count}} files.' },
    ],
  },
  {
    id: 'flow-7', scenarioId: 'scn-7', isPrebuilt: true, author: 'Seculyze', priority: 7,
    name: 'Ransomware behaviour',
    alertTypes: ['Ransomware behaviour'], providerNames: ['Defender for Endpoint'],
    clientScope: ['all'], confidenceThreshold: 80, minRisk: 'High', executionMode: 'auto',
    isActive: true, lastRun: '9d ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Ransomware behaviour'], providerNames: ['Defender for Endpoint'] },
      { id: n(), kind: 'triage', minConfidence: 80, minRisk: 'High' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'isolate_device', tier: 'high' },
      { id: n(), kind: 'action', action: 'run_sentinel_playbook', tier: 'low', params: { playbook: 'Snapshot VM disks' } },
      { id: n(), kind: 'action', action: 'reset_password', tier: 'high' },
      { id: n(), kind: 'notify', channels: [soc('c6'), teams('c7')], template: 'RANSOMWARE: {{device}} auto-isolated. Snapshots taken. Password reset.' },
    ],
  },
  {
    id: 'flow-8', scenarioId: 'scn-8', isPrebuilt: true, author: 'Seculyze', priority: 8,
    name: 'Malicious OAuth consent / inbox rule',
    alertTypes: ['Malicious OAuth consent / inbox rule'], providerNames: ['Entra ID', 'Defender for Office 365'],
    clientScope: ['all'], confidenceThreshold: 75, minRisk: 'Medium', executionMode: 'staged',
    isActive: true, lastRun: '1d ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Malicious OAuth consent / inbox rule'], providerNames: ['Entra ID', 'Defender for Office 365'] },
      { id: n(), kind: 'triage', minConfidence: 75, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'action', action: 'run_sentinel_playbook', tier: 'medium', params: { playbook: 'Revoke OAuth consent grant' } },
      { id: n(), kind: 'action', action: 'reset_password', tier: 'high' },
      { id: n(), kind: 'notify', channels: [soc('c8')], template: 'OAuth consent revoked and credentials rotated for {{user}}.' },
    ],
  },
  {
    id: 'flow-9', scenarioId: 'scn-9', isPrebuilt: true, author: 'Seculyze', priority: 9,
    name: 'Anomalous admin role assignment',
    alertTypes: ['Anomalous admin role assignment'], providerNames: ['Entra ID PIM'],
    clientScope: ['all'], confidenceThreshold: 60, minRisk: 'Low', executionMode: 'recommend',
    isActive: true, lastRun: '2d ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Anomalous admin role assignment'], providerNames: ['Entra ID PIM'] },
      { id: n(), kind: 'triage', minConfidence: 60, minRisk: 'Low' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'Jira' } },
      { id: n(), kind: 'notify', channels: [soc('c9')], template: 'Review: {{user}} was assigned {{role}} outside change window.' },
    ],
  },
  {
    id: 'flow-10', scenarioId: 'scn-10', isPrebuilt: true, author: 'Seculyze', priority: 10,
    name: 'Legacy auth from risky IP',
    alertTypes: ['Legacy auth from risky IP'], providerNames: ['Entra ID'],
    clientScope: ['all'], confidenceThreshold: 85, minRisk: 'Medium', executionMode: 'auto',
    isActive: true, lastRun: '4h ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Legacy auth from risky IP'], providerNames: ['Entra ID'] },
      { id: n(), kind: 'triage', minConfidence: 85, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'block_user', tier: 'medium' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'notify', channels: [soc('c10')], template: 'Legacy-auth sign-in from {{ip}} blocked for {{user}}.' },
    ],
  },
  // ── custom examples ──
  {
    id: 'flow-11', isPrebuilt: false, author: 'Custom', priority: 11,
    name: 'VIP account protection (staged)',
    alertTypes: ['Impossible / atypical travel', 'Password spray / brute force'], providerNames: ['Entra ID'],
    clientScope: ['Nike', 'Apple'], clientLevels: ['Level 1'], confidenceThreshold: 65, minRisk: 'Medium', executionMode: 'staged',
    isActive: true, lastRun: '5h ago',
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Impossible / atypical travel', 'Password spray / brute force'], providerNames: ['Entra ID'] },
      { id: n(), kind: 'triage', minConfidence: 65, minRisk: 'Medium' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'notify', channels: [soc('c11')], template: 'Staged response ready for VIP account {{user}} — one click to execute.' },
    ],
  },
  {
    id: 'flow-12', isPrebuilt: false, author: 'Custom', priority: 12,
    name: 'After-hours admin activity',
    alertTypes: ['Anomalous admin role assignment'], providerNames: ['Entra ID PIM', 'Microsoft Sentinel'],
    clientScope: ['all'], severityScope: ['High'], confidenceThreshold: 70, minRisk: 'Medium', executionMode: 'staged',
    isActive: false,
    nodes: [
      { id: n(), kind: 'trigger', alertTypes: ['Anomalous admin role assignment'], providerNames: ['Entra ID PIM', 'Microsoft Sentinel'] },
      { id: n(), kind: 'triage', minConfidence: 70, minRisk: 'Medium' },
      { id: n(), kind: 'condition', expr: 'hour < 6 || hour > 20' },
      { id: n(), kind: 'respond' },
      { id: n(), kind: 'action', action: 'revoke_sessions', tier: 'medium' },
      { id: n(), kind: 'action', action: 'send_itsm_ticket', tier: 'low', params: { system: 'PagerDuty' } },
    ],
  },
];

export const MOCK_SCHEDULED_REPORTS: ScheduledReport[] = [
  {
    id: 'rep-1', name: 'Monthly automation report', cadence: 'monthly',
    clientScope: ['all'],
    channels: [{ id: 'r1', type: 'email', value: 'stakeholders@seculyze.com' }],
    format: 'pdf',
    sections: ['actions', 'time_saved', 'top_scenarios', 'approvals'],
    isActive: true, nextRun: 'Aug 1, 2026',
  },
  {
    id: 'rep-2', name: 'Weekly SOC digest — Nike', cadence: 'weekly',
    clientScope: ['Nike'],
    channels: [{ id: 'r2', type: 'itsm', value: '#nike-soc', itsmType: 'Slack' }],
    format: 'email_html',
    sections: ['actions', 'top_scenarios'],
    isActive: true, nextRun: 'Mon, Jul 13',
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

export const makeNodeId = () => `node-${Math.random().toString(36).slice(2, 9)}`;

export function blockToNode(block: BlockDef): FlowNode {
  const id = makeNodeId();
  switch (block.kind) {
    case 'trigger': return { id, kind: 'trigger', alertTypes: [], providerNames: [] };
    case 'triage': return { id, kind: 'triage', minConfidence: 75, minRisk: 'Medium' };
    case 'respond': return { id, kind: 'respond' };
    case 'condition': return { id, kind: 'condition', expr: 'confidence >= 80' };
    case 'action': return { id, kind: 'action', action: block.action!, tier: block.tier!, params: {} };
    case 'notify': return { id, kind: 'notify', channels: [{ id: makeNodeId(), type: 'email', value: 'soc@seculyze.com' }], template: '' };
  }
}

export function nodeLabel(node: FlowNode): string {
  switch (node.kind) {
    case 'trigger': return 'Trigger';
    case 'triage': return 'Triage agent';
    case 'respond': return 'Respond agent';
    case 'condition': return 'Condition';
    case 'action': return ACTION_LABELS[node.action];
    case 'notify': return 'Send notification';
  }
}

export function nodeSubtitle(node: FlowNode): string {
  switch (node.kind) {
    case 'trigger': return node.alertTypes.length > 0 ? node.alertTypes[0] + (node.alertTypes.length > 1 ? ` +${node.alertTypes.length - 1}` : '') : 'No scope set';
    case 'triage': return `conf ≥ ${node.minConfidence} · risk ${node.minRisk}`;
    case 'respond': return 'builds action plan';
    case 'condition': return node.expr || 'no expression';
    case 'action': {
      if (node.action === 'run_sentinel_playbook') return (node.params?.playbook as string) ?? 'Choose playbook';
      if (node.action === 'send_itsm_ticket') return (node.params?.system as string) ?? 'ServiceNow';
      return node.action.startsWith('isolate') ? 'Defender for Endpoint' : 'Entra ID';
    }
    case 'notify': return node.channels.map(c => c.itsmType ?? c.type).join(' · ') || 'no channels';
  }
}

// Deterministic mock dry-run for "Test / simulate"
export function simulateFlow(flow: SoarFlow): {
  matched: number; aboveThreshold: number; actionsFired: { label: string; count: number; gated: boolean }[];
  minutesSaved: number;
} {
  const seed = flow.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const matched = 14 + (seed % 41);
  const aboveThreshold = Math.max(1, Math.round(matched * (1 - flow.confidenceThreshold / 130)));
  // Staged flows never auto-fire — every action waits for an analyst to run it.
  const staged = flow.executionMode === 'staged';
  const actionsFired = flow.nodes
    .filter((nd): nd is Extract<FlowNode, { kind: 'action' }> => nd.kind === 'action')
    .map((nd, i) => ({
      label: ACTION_LABELS[nd.action],
      count: Math.max(1, aboveThreshold - i),
      gated: staged,
    }));
  const minutesSaved = aboveThreshold * 14;
  return { matched, aboveThreshold, actionsFired, minutesSaved };
}
