// ─── Sentinel playbooks ──────────────────────────────────────────────────────
//
// The Active playbooks list from Microsoft Sentinel → Automation, transcribed
// from the alasentinel-dev-euw workspace. "Run Sentinel playbook" picks from
// this instead of asking for a name typed from memory.
//
// Two columns from that blade do real work here rather than just decorating
// the row:
//
//   triggerKind — what can invoke the playbook. An Entity-triggered playbook
//     is run by a human from an entity page; an automation rule cannot call
//     it. A Standard logic app with trigger kind "Other" is not a Sentinel
//     playbook at all. Neither is offered, on the same rule the rest of the
//     builder follows: if it cannot be used, it is absent rather than greyed.
//
//   changesCustomerSystems — whether this particular playbook reaches into
//     the customer's environment. Isolate-MDEMachine does; CreateSNOWRecord
//     does not. This is what makes "Run Sentinel playbook" stop being
//     uniformly dangerous — the answer depends on which one you picked, which
//     is what the overview card now counts.

export type PlaybookTrigger = 'Incident' | 'Alert' | 'Entity' | 'Other';

export interface Playbook {
  /** Unique within the workspace — a name can repeat across resource groups. */
  id: string;
  name: string;
  triggerKind: PlaybookTrigger;
  plan: 'Consumption' | 'Standard';
  resourceGroup: string;
  location: string;
  /** The "Source name" column — which connector or content pack it came from. */
  source: string;
  enabled: boolean;
  changesCustomerSystems: boolean;
  /** Plain English, for the line under the picker. */
  does: string;
  /**
   * Which kind of entity it acts on, where it acts on one. The audit view uses
   * this to name the target of a playbook step — a run that says "ran
   * Isolate-MDEMachine" without naming the machine proves nothing.
   */
  acts?: 'user' | 'device' | 'mailbox' | 'ip';
}

export const PLAYBOOKS: Playbook[] = [
  { id: 'pb-01', name: 'Get-GeoFromIpAndTagIncident', triggerKind: 'Alert', plan: 'Consumption',
    resourceGroup: 'alasentinel-prod-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Looks up the geography behind an IP and tags the incident' },

  { id: 'pb-02', name: 'Get-GeoFromIpAndTagIncident', triggerKind: 'Alert', plan: 'Consumption',
    resourceGroup: 'alasentinel-sandbox', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Looks up the geography behind an IP and tags the incident' },

  { id: 'pb-03', name: 'Create-AzureDevOpsTask', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Opens a task in Azure DevOps' },

  { id: 'pb-04', name: 'CreateJiraIssue_Reporting', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'AtlassianJiraAudit',
    enabled: true, changesCustomerSystems: false,
    does: 'Raises a Jira issue for reporting' },

  { id: 'pb-05', name: 'CreateSNOWRecord', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Servicenow',
    enabled: true, changesCustomerSystems: false,
    does: 'Creates a ServiceNow record' },

  { id: 'pb-06', name: 'Isolate-MDE-Machine-entityTrigger', triggerKind: 'Entity', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'MicrosoftDefenderATP',
    enabled: true, acts: 'device', changesCustomerSystems: true,
    does: 'Isolates a device, run by hand from an entity page' },

  { id: 'pb-07', name: 'Isolate-MDEMachine', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'MicrosoftDefenderATP',
    enabled: true, acts: 'device', changesCustomerSystems: true,
    does: 'Isolates every host on the incident, then comments on it' },

  { id: 'pb-08', name: 'Jira-CreateAndUpdateIssue_Reporting2', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'AtlassianJiraAudit',
    enabled: true, changesCustomerSystems: false,
    does: 'Creates a Jira issue and keeps it updated' },

  { id: 'pb-09', name: 'Notify-LogManagementTeam', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Notifies the log management team' },

  { id: 'pb-10', name: 'Reset-EntraIDPassword-IncidentTrigger', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Microsoft Entra ID',
    enabled: true, acts: 'user', changesCustomerSystems: true,
    does: 'Resets the password of every user on the incident' },

  { id: 'pb-11', name: 'Reset-EntraIDUserPassword-EntityTrigger', triggerKind: 'Entity', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Microsoft Entra ID',
    enabled: true, acts: 'user', changesCustomerSystems: true,
    does: 'Resets one user’s password, run by hand from an entity page' },

  { id: 'pb-12', name: 'Revoke-AADSignIn-Session-entityTrigger', triggerKind: 'Entity', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Azure Active Directory',
    enabled: true, acts: 'user', changesCustomerSystems: true,
    does: 'Revokes one user’s sessions, run by hand from an entity page' },

  { id: 'pb-13', name: 'Revoke-EntraIDSignInSessions-incident', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Microsoft Entra ID',
    enabled: true, acts: 'user', changesCustomerSystems: true,
    does: 'Revokes the sessions of every user on the incident' },

  { id: 'pb-14', name: 'Send-basic-email', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Sends a plain email' },

  { id: 'pb-15', name: 'Sync-Incidents', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'AtlassianJiraAudit',
    enabled: true, changesCustomerSystems: false,
    does: 'Keeps Sentinel incidents and Jira issues in step' },

  { id: 'pb-16', name: 'TestPlaybook', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false, does: 'Test playbook' },

  { id: 'pb-17', name: 'TestPlaybook2', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinel-dev-euw', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false, does: 'Test playbook' },

  { id: 'pb-18', name: 'AzureArc-Playbook-Dev', triggerKind: 'Incident', plan: 'Consumption',
    resourceGroup: 'sentinelrelated-dev', location: 'West Europe', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false,
    does: 'Azure Arc playbook, in development' },

  // Standard logic apps, not Sentinel playbooks — in the blade's list, but
  // nothing in Sentinel can invoke them.
  { id: 'pb-19', name: 'adomcp-pro-01/List_Organizations', triggerKind: 'Other', plan: 'Standard',
    resourceGroup: 'mlresearch-euw-dev', location: 'Sweden Central', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false, does: 'Lists organizations' },

  { id: 'pb-20', name: 'adomcp-pro-01/List_projects', triggerKind: 'Other', plan: 'Standard',
    resourceGroup: 'mlresearch-euw-dev', location: 'Sweden Central', source: 'Custom Content',
    enabled: true, changesCustomerSystems: false, does: 'Lists projects' },
];

export const PLAYBOOK_BY_ID = Object.fromEntries(PLAYBOOKS.map(p => [p.id, p])) as Record<string, Playbook>;

/**
 * The ones an automation rule can actually call. Entity-triggered playbooks
 * are invoked by a person from an entity page, and "Other" is a Standard logic
 * app rather than a Sentinel playbook — neither is reachable from a flow, so
 * neither is offered.
 */
export const RUNNABLE_PLAYBOOKS = PLAYBOOKS.filter(
  p => p.enabled && (p.triggerKind === 'Incident' || p.triggerKind === 'Alert'));

export const EXCLUDED_REASON =
  `${PLAYBOOKS.length - RUNNABLE_PLAYBOOKS.length} more exist in this workspace but ` +
  'no automation can call them — entity-triggered playbooks are run by hand from an ' +
  'entity page, and Standard logic apps are not Sentinel playbooks.';

/**
 * Whether a chosen playbook reaches into the customer's environment. With
 * nothing chosen the answer is "assume it can", because an unknown playbook
 * can do anything — which is the safe way round for a number the overview card
 * reports to a customer.
 */
export function playbookChangesCustomerSystems(id: string | undefined): boolean {
  if (!id) return true;
  return PLAYBOOK_BY_ID[id]?.changesCustomerSystems ?? true;
}

/** How a playbook reads in one line under the picker. */
export function playbookDetail(p: Playbook): string {
  return `${p.triggerKind} trigger · ${p.source} · ${p.resourceGroup} · ${p.location}`;
}
