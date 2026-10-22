import { ACTION_BY_ID, MOCK_FLOWS, TRIGGER_BY_ID, type ActionId, type TriggerId } from './flowRegister';
import { PLAYBOOK_BY_ID } from './sentinelPlaybooks';

// ─── Automation run history ──────────────────────────────────────────────────
//
// What the audit view reads. This is deliberately not a log of lines: an audit
// has to answer four questions and a log only answers the first two.
//
//   when   — exact timestamps, per step, not just per run
//   what   — every action attempted, and what each one actually did
//   to whom — the entity. A run that says "isolated a device" and cannot name
//            the device proves nothing, so the target is on the step, not
//            inferred from the incident.
//   by what authority — which flow, which trigger fired it, and who approved
//            it if a human did. This is the column a customer asks about when
//            they want to know why their user was locked out.
//
// A step that failed keeps its error, because the other half of the job is
// troubleshooting, and "the flow failed" is not something anyone can act on.
//
// The data is generated rather than hand-written, from the same register the
// builder uses, so no run contains an action its trigger could not reach. The
// seed is fixed, so the page does not reshuffle itself on every render.

export type StepStatus = 'succeeded' | 'failed' | 'skipped' | 'awaiting-approval' | 'cancelled';
export type RunOutcome = 'succeeded' | 'partial' | 'failed' | 'awaiting-approval' | 'cancelled';

export type EntityKind = 'user' | 'device' | 'ip' | 'mailbox' | 'file' | 'domain' | 'tenant';

export interface Entity {
  kind: EntityKind;
  /** What it is called in the customer's directory — the thing being proved. */
  value: string;
}

export interface RunStep {
  id: string;
  action: ActionId;
  /** The playbook id for run-playbook, the free value otherwise. */
  param?: string;
  status: StepStatus;
  /** Offset from the run's start, in seconds. */
  at: number;
  durationMs: number;
  /** The entity this step acted on. Absent when the step acted on the incident. */
  target?: Entity;
  /** The result, or the error when it failed — never just a status word. */
  detail: string;
}

export interface FlowRun {
  id: string;
  flowName: string;
  trigger: TriggerId;
  tenant: string;
  /** The incident or alert that set it off. */
  sourceRef: string;
  startedAt: string;
  durationMs: number;
  outcome: RunOutcome;
  entities: Entity[];
  /** Who let it run, when a step needed a human. */
  approvedBy?: string;
  approvedAt?: string;
  steps: RunStep[];
}

/** The same customers the rest of the console manages — see tenants.ts. */
export { TENANTS } from './tenants';
import { TENANTS } from './tenants';

const USERS = ['j.mortensen@', 'a.larsen@', 'k.pedersen@', 'm.jensen@', 's.nielsen@', 'svc-backup@', 'r.olsen@', 't.hansen@'];
const DEVICES = ['LAP-4471', 'LAP-2290', 'WRK-0182', 'SRV-DC01', 'LAP-5512', 'WRK-7731'];
const IPS = ['185.220.101.44', '91.219.236.18', '45.153.160.2', '23.129.64.217'];
const DOMAINS = ['cdn-update-srv.net', 'login-verify-mail.com', 'secure-docs-share.io'];
const FILES = ['invoice_Q4.xlsm', 'update_pkg.dll', 'statement.pdf.exe'];
const ANALYSTS = ['Mia Sørensen', 'Daniel Kjær', 'Oliver Bech', 'Freja Lind'];

/** Fixed seed, so the audit trail is stable between renders and reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ERRORS: Partial<Record<ActionId, string>> = {
  'isolate-device': 'Defender returned 404 — device has not checked in for 11 days',
  'revoke-session': 'Graph API returned 403 — the app registration is missing Directory.AccessAsUser.All',
  'disable-user': 'Graph API returned 403 — target is a Global Administrator and is protected',
  'reset-password': 'Entra ID rejected the reset — the account is federated',
  'quarantine-email': 'Message had already been purged by the user',
  'block-ip': 'Firewall policy is locked by another change window',
  'create-ticket': 'ServiceNow returned 500 — instance was in maintenance',
  'run-playbook': 'Playbook timed out after 120s',
  'send-sms': 'Gateway rejected the number as unroutable',
};

const OK: Partial<Record<ActionId, string>> = {
  'isolate-device': 'Device isolated from the network',
  'revoke-session': 'All refresh tokens revoked',
  'disable-user': 'Account disabled in Entra ID',
  'reset-password': 'Password reset, temporary credential sent to the manager',
  'quarantine-email': 'Message moved to quarantine in every recipient mailbox',
  'quarantine-file': 'File quarantined on the endpoint',
  'block-ip': 'Address added to the deny list',
  'block-domain': 'Domain added to the deny list',
  'create-ticket': 'Ticket INC-%N opened',
  'update-ticket': 'Ticket INC-%N updated',
  'add-comment': 'Comment added to the incident',
  'assign-analyst': 'Assigned to %A',
  'add-tag': 'Tag applied',
  'change-severity': 'Severity changed',
  'get-information': 'Enrichment gathered from 3 sources',
  'search': 'Query returned 14 rows',
  'send-email': 'Mail delivered',
  'send-sms': 'Message delivered',
  'send-incident-report': 'Report generated and sent',
  'send-monthly-report': 'Report generated and sent',
  'run-playbook': 'Playbook completed',
};

/** Which entity a given action would have acted on. */
function targetFor(action: ActionId, e: Record<EntityKind, Entity | undefined>, param?: string): Entity | undefined {
  // A playbook step names its target too, taken from what the playbook acts
  // on — otherwise the one kind of step most likely to change a customer
  // system is the one kind that cannot say what it changed.
  if (action === 'run-playbook') {
    const acts = param ? PLAYBOOK_BY_ID[param]?.acts : undefined;
    return acts ? e[acts] : undefined;
  }
  switch (action) {
    case 'revoke-session': case 'disable-user': case 'reset-password': return e.user;
    case 'isolate-device': return e.device;
    case 'quarantine-file': return e.file;
    case 'quarantine-email': return e.mailbox;
    case 'block-ip': return e.ip;
    case 'block-domain': return e.domain;
    default: return undefined;
  }
}

interface Template {
  flowName: string;
  trigger: TriggerId;
  actions: (ActionId | [ActionId, string])[];
  needsApproval: boolean;
  entities: EntityKind[];
}

/** Which entities an action touches — the inverse of targetFor. */
const ACTS_ON: Partial<Record<ActionId, EntityKind>> = {
  'revoke-session': 'user', 'disable-user': 'user', 'reset-password': 'user',
  'isolate-device': 'device', 'quarantine-file': 'file', 'quarantine-email': 'mailbox',
  'block-ip': 'ip', 'block-domain': 'domain',
};

function entitiesFor(actions: (ActionId | [ActionId, string])[], trigger: TriggerId): EntityKind[] {
  const kinds = new Set<EntityKind>();
  for (const a of actions) {
    const [id, param] = Array.isArray(a) ? a : [a, undefined];
    const k = id === 'run-playbook' && param ? PLAYBOOK_BY_ID[param]?.acts : ACTS_ON[id];
    if (k) kinds.add(k as EntityKind);
  }
  if (kinds.size === 0) {
    kinds.add(TRIGGER_BY_ID[trigger]?.group === 'alert' ? 'device' : 'tenant');
  }
  return [...kinds];
}

// The flows a user actually has are generated from the register's own mock
// flows rather than retyped here. They were retyped once, the two lists drifted
// — 'Auto-close Defender malware' against 'Auto-close benign Defender malware'
// — and three of the five flows in the console opened an empty log while the
// history sat under a name nothing linked to.
const FROM_SAVED: Template[] = MOCK_FLOWS.filter(f => f.trigger).map(f => {
  const actions = f.actions.map(a => (a.param ? [a.action, a.param] : a.action)) as (ActionId | [ActionId, string])[];
  return {
    flowName: f.name,
    trigger: f.trigger as TriggerId,
    actions,
    needsApproval: f.conditions.some(c => c.id === 'approval' && !!c.value),
    entities: entitiesFor(actions, f.trigger as TriggerId),
  };
});

const RECOMMENDED: Template[] = [
  { flowName: 'Auto-close benign Defender malware', trigger: 'fp',
    actions: ['add-comment', 'add-tag'], needsApproval: false, entities: ['device'] },

  { flowName: 'Revoke session on confirmed identity compromise', trigger: 'tp',
    actions: ['revoke-session', 'create-ticket'], needsApproval: true, entities: ['user', 'ip'] },

  { flowName: 'Isolate on ransomware behaviour', trigger: 'tp',
    actions: ['isolate-device', 'create-ticket', 'send-sms'], needsApproval: true, entities: ['device', 'user'] },

  { flowName: 'Quarantine confirmed phishing mail', trigger: 'tp',
    actions: ['quarantine-email', 'create-ticket'], needsApproval: true, entities: ['mailbox', 'domain'] },

  { flowName: 'Block IPs from high-severity threat intel', trigger: 'ti-high',
    actions: ['block-ip', 'add-comment'], needsApproval: true, entities: ['ip'] },

  { flowName: 'Keep service accounts out of containment', trigger: 'tp',
    actions: ['assign-analyst', 'add-tag'], needsApproval: false, entities: ['user'] },

  { flowName: 'Enrich and triage medium threat intel', trigger: 'ti-med',
    actions: ['get-information', 'search', 'add-tag'], needsApproval: false, entities: ['ip', 'device'] },

  { flowName: 'Isolate via Sentinel playbook', trigger: 'tp',
    actions: [['run-playbook', 'pb-07'], 'add-comment'], needsApproval: true, entities: ['device'] },

  { flowName: 'Tag geography on low threat intel', trigger: 'ti-low',
    actions: [['run-playbook', 'pb-01'], 'add-tag'], needsApproval: false, entities: ['ip'] },

  { flowName: 'Monthly customer report', trigger: 'schedule',
    actions: ['send-monthly-report', 'send-email'], needsApproval: false, entities: ['tenant'] },

  { flowName: 'Raise a ticket on ingestion spikes', trigger: 'ingestion-anomaly',
    actions: ['create-ticket', 'send-email'], needsApproval: false, entities: ['tenant'] },

  { flowName: 'Escalate budget overruns', trigger: 'budget-anomaly',
    actions: ['send-email', 'assign-analyst'], needsApproval: false, entities: ['tenant'] },
];

// The saved flows first, and none of the recommendations that duplicate one.
const TEMPLATES: Template[] = [
  ...FROM_SAVED,
  ...RECOMMENDED.filter(t => !FROM_SAVED.some(f => f.flowName === t.flowName)),
];

function buildRuns(): FlowRun[] {
  const rand = rng(20251013);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const now = new Date('2026-10-13T09:40:00Z').getTime();
  const runs: FlowRun[] = [];

  for (let i = 0; i < 64; i++) {
    const t = TEMPLATES[Math.floor(rand() * TEMPLATES.length)];
    const tenant = pick(TENANTS);
    const domainSuffix = tenant.toLowerCase().replace(/\s/g, '') + '.com';

    const made: Record<EntityKind, Entity | undefined> = {
      user: { kind: 'user', value: pick(USERS) + domainSuffix },
      device: { kind: 'device', value: pick(DEVICES) },
      ip: { kind: 'ip', value: pick(IPS) },
      mailbox: { kind: 'mailbox', value: pick(USERS) + domainSuffix },
      domain: { kind: 'domain', value: pick(DOMAINS) },
      file: { kind: 'file', value: pick(FILES) },
      tenant: { kind: 'tenant', value: tenant },
    };

    // Most runs go through. The rest are the ones worth troubleshooting.
    const roll = rand();
    const mode: 'ok' | 'failed-step' | 'all-failed' | 'waiting' | 'cancelled' =
      roll > 0.80 ? 'failed-step'
      : roll > 0.74 ? 'all-failed'
      : roll > 0.68 ? 'waiting'
      : roll > 0.65 ? 'cancelled'
      : 'ok';

    const startedAt = new Date(now - Math.floor(rand() * 30 * 24 * 3600 * 1000)).toISOString();
    const approver = t.needsApproval ? pick(ANALYSTS) : undefined;
    const waitSecs = t.needsApproval ? 30 + Math.floor(rand() * 600) : 0;

    const steps: RunStep[] = [];
    let at = waitSecs;
    let failedOne = mode === 'failed-step' ? Math.floor(rand() * t.actions.length) : -1;
    if (mode === 'failed-step' && failedOne === 0 && t.actions.length > 1) failedOne = 1;

    t.actions.forEach((entry, idx) => {
      const action = (Array.isArray(entry) ? entry[0] : entry) as ActionId;
      const param = Array.isArray(entry) ? entry[1] : undefined;

      let status: StepStatus = 'succeeded';
      if (mode === 'all-failed') status = idx === 0 ? 'failed' : 'skipped';
      else if (mode === 'waiting') status = idx === 0 ? 'awaiting-approval' : 'skipped';
      else if (mode === 'cancelled') status = idx === 0 ? 'cancelled' : 'skipped';
      else if (mode === 'failed-step') status = idx === failedOne ? 'failed' : idx > failedOne ? 'skipped' : 'succeeded';

      const dur = status === 'skipped' || status === 'awaiting-approval'
        ? 0 : 400 + Math.floor(rand() * 9000);

      const detail =
        status === 'failed'
          ? ERRORS[action] ?? 'The downstream system returned an error'
          : status === 'skipped'
            ? 'Not attempted — an earlier step did not complete'
            : status === 'awaiting-approval'
              ? `Waiting for approval from ${approver ?? 'an analyst'}`
              : status === 'cancelled'
                ? 'Cancelled — the approval request expired after 60 minutes'
                : (OK[action] ?? 'Completed')
                    .replace('%N', String(40000 + Math.floor(rand() * 9000)))
                    .replace('%A', pick(ANALYSTS));

      steps.push({
        id: `s-${i}-${idx}`,
        action,
        param,
        status,
        at,
        durationMs: dur,
        target: targetFor(action, made, param),
        detail,
      });
      at += Math.ceil(dur / 1000) + 1;
    });

    const outcome: RunOutcome =
      mode === 'waiting' ? 'awaiting-approval'
      : mode === 'cancelled' ? 'cancelled'
      : mode === 'all-failed' ? 'failed'
      : mode === 'failed-step' ? 'partial'
      : 'succeeded';

    runs.push({
      id: `RUN-${(10482 + i).toString()}`,
      flowName: t.flowName,
      trigger: t.trigger,
      tenant,
      sourceRef: t.trigger === 'schedule' || t.trigger === 'ingestion-anomaly' || t.trigger === 'budget-anomaly'
        ? '—'
        : `INC-${90000 + Math.floor(rand() * 9000)}`,
      startedAt,
      durationMs: at * 1000,
      outcome,
      entities: t.entities.map(k => made[k]!).filter(Boolean),
      approvedBy: t.needsApproval && mode !== 'waiting' && mode !== 'cancelled' ? approver : undefined,
      approvedAt: t.needsApproval && mode !== 'waiting' && mode !== 'cancelled'
        ? new Date(new Date(startedAt).getTime() + waitSecs * 1000).toISOString()
        : undefined,
      steps,
    });
  }

  return runs.sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
}

export const RUNS: FlowRun[] = buildRuns();

// ─── the flat audit log ──────────────────────────────────────────────────────
//
// The audit page is run-first: a run, with its steps nested inside it. This is
// the other shape of the same truth — one entry per automated action, which is
// what "a full audit log of every automated action" actually means, and what
// you scroll when the question is "what has this flow been doing" rather than
// "what happened in run 10507".
//
// Author is the field a log like this usually gets wrong. An automated action
// has one: the flow acted, under the authority of whoever approved it. So an
// approved action is attributed to the analyst who let it through, and an
// unapproved one to the automation itself — never to a blank cell.

export interface AuditEntry {
  id: string;
  runId: string;
  /** Exact moment this action ran, not the moment the run started. */
  at: string;
  flowName: string;
  trigger: TriggerId;
  tenant: string;
  sourceRef: string;
  action: ActionId;
  param?: string;
  entity?: Entity;
  outcome: StepStatus;
  detail: string;
  durationMs: number;
  author: string;
  authorKind: 'automation' | 'analyst';
  /** Did this particular action reach into the customer's environment. */
  changedCustomerSystems: boolean;
}

function buildLog(): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const r of RUNS) {
    const changed = new Set(changedCustomerSystems(r).map(s => s.id));
    for (const s of r.steps) {
      out.push({
        id: `${r.id}-${s.id}`,
        runId: r.id,
        at: new Date(new Date(r.startedAt).getTime() + s.at * 1000).toISOString(),
        flowName: r.flowName,
        trigger: r.trigger,
        tenant: r.tenant,
        sourceRef: r.sourceRef,
        action: s.action,
        param: s.param,
        entity: s.target,
        outcome: s.status,
        detail: s.detail,
        durationMs: s.durationMs,
        author: r.approvedBy ?? 'Seculyze automation',
        authorKind: r.approvedBy ? 'analyst' : 'automation',
        changedCustomerSystems: changed.has(s.id),
      });
    }
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export const AUDIT_LOG: AuditEntry[] = buildLog();

// ─── helpers the view needs ──────────────────────────────────────────────────

/** How many actions this flow has on record — the number on the Audit log button. */
export const actionsLogged = (flowName: string) =>
  AUDIT_LOG.reduce((n, e) => n + (e.flowName === flowName ? 1 : 0), 0);

/**
 * Back from a log line to the run and the step it came from, so the flat log
 * can open the same detail the run view does. The id is built as
 * `${run.id}-${step.id}`, which is the only reason this is possible — keep
 * them in step if either ever changes.
 */
export function resolveEntry(entry: AuditEntry): { run: FlowRun; step: RunStep } | null {
  const run = RUNS.find(r => r.id === entry.runId);
  const step = run?.steps.find(x => `${run.id}-${x.id}` === entry.id);
  return run && step ? { run, step } : null;
}

export const OUTCOMES: RunOutcome[] = ['succeeded', 'partial', 'failed', 'awaiting-approval', 'cancelled'];

export const OUTCOME_LABEL: Record<RunOutcome, string> = {
  succeeded: 'Succeeded',
  partial: 'Partly done',
  failed: 'Failed',
  'awaiting-approval': 'Awaiting approval',
  cancelled: 'Cancelled',
};

export const STEP_LABEL: Record<StepStatus, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  skipped: 'Skipped',
  'awaiting-approval': 'Awaiting approval',
  cancelled: 'Cancelled',
};

export const ENTITY_LABEL: Record<EntityKind, string> = {
  user: 'User', device: 'Device', ip: 'IP', mailbox: 'Mailbox',
  file: 'File', domain: 'Domain', tenant: 'Tenant',
};

/** What a step actually ran, resolving a playbook id to its name. */
export function stepName(s: RunStep): string {
  const d = ACTION_BY_ID[s.action];
  if (s.action === 'run-playbook' && s.param) {
    const pb = PLAYBOOK_BY_ID[s.param];
    if (pb) return `${d.name} — ${pb.name}`;
  }
  return d.name;
}

/** Steps that reached into the customer's environment and succeeded. */
export function changedCustomerSystems(r: FlowRun): RunStep[] {
  return r.steps.filter(s => {
    if (s.status !== 'succeeded') return false;
    if (s.action === 'run-playbook') return s.param ? !!PLAYBOOK_BY_ID[s.param]?.changesCustomerSystems : true;
    return ACTION_BY_ID[s.action].destructive;
  });
}

export const fmtDuration = (ms: number) =>
  ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60000)} min`;

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });

export const fmtClock = (iso: string, offsetSecs = 0) =>
  new Date(new Date(iso).getTime() + offsetSecs * 1000)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const triggerName = (t: TriggerId) => TRIGGER_BY_ID[t].name;

/** The evidence export. One row per step, because that is the unit of proof. */
export function toCsv(runs: FlowRun[]): string {
  const head = ['Run', 'Started (UTC)', 'Tenant', 'Flow', 'Trigger', 'Source', 'Step', 'Action',
                'Target type', 'Target', 'Status', 'Step time (UTC)', 'Duration (ms)', 'Detail', 'Approved by'];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = runs.flatMap(r =>
    r.steps.map((s, i) => [
      r.id,
      r.startedAt,
      r.tenant,
      r.flowName,
      triggerName(r.trigger),
      r.sourceRef,
      String(i + 1),
      stepName(s),
      s.target ? ENTITY_LABEL[s.target.kind] : '',
      s.target ? s.target.value : '',
      STEP_LABEL[s.status],
      new Date(new Date(r.startedAt).getTime() + s.at * 1000).toISOString(),
      String(s.durationMs),
      s.detail,
      r.approvedBy ?? '',
    ].map(esc).join(',')));
  return [head.map(esc).join(','), ...rows].join('\n');
}
