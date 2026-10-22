import { ACTION_BY_ID, type ActionId } from './flowRegister';
import { PLAYBOOK_BY_ID } from './sentinelPlaybooks';
import { type FlowRun, type RunStep } from './flowRuns';

// ─── what went in, and what came back ────────────────────────────────────────
//
// The audit log answers the reporting question — what did this automation do
// last month, to whom, on whose authority. It does not answer the other one,
// the one asked at 2am: *why did that happen*. For that you need the call the
// step actually made and the thing it actually got back, which is exactly what
// Sentinel's run history gives you when you open a step.
//
// So every step can show its inputs and its outputs. Inputs are the call —
// the query text, the directory, the playbook and its parameters. Outputs are
// the response, as the system returned it. A step that failed shows the error
// where the output would have been, because that is the thing being looked
// for.
//
// Both are derived from the run rather than stored on it: the shape of a call
// is a property of the action, and the values come from the entity the step
// touched. A real implementation reads them off the connector's response and
// keeps this shape.

export interface StepIo {
  /** The call, as label/value pairs. */
  inputs: [string, string][];
  /** The response, pretty-printed. */
  outputs: string;
  /** The same thing as the wire saw it, for the raw toggle. */
  rawInputs: string;
  rawOutputs: string;
}

const SUB = 'Development';
const RG = 'sentinel-dev-euw';
const WORKSPACE = 'alasentinel-dev-euw';

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

/** The KQL a lookup step would have run, against the entity it was given. */
function query(run: FlowRun, step: RunStep): string {
  const e = step.target ?? run.entities[0];
  if (!e) return `SecurityAlert\n| where TimeGenerated > ago(1d)\n| project Entities`;
  const column = e.kind === 'user' ? 'AccountUpn'
    : e.kind === 'device' ? 'Computer'
    : e.kind === 'ip' ? 'RemoteIP'
    : e.kind === 'mailbox' ? 'Recipient'
    : e.kind === 'file' ? 'FileName'
    : e.kind === 'domain' ? 'DomainName'
    : 'TenantId';
  return `SecurityAlert\n| where SystemAlertId == "${run.sourceRef.toLowerCase()}"\n| where ${column} == "${e.value}"\n| project Entities, TimeGenerated`;
}

/** The call each kind of action makes, in the shape its connector takes. */
function callFor(run: FlowRun, step: RunStep): [string, string][] {
  const t = step.target;
  const who = t?.value ?? run.entities[0]?.value ?? run.tenant;
  const common: [string, string][] = [
    ['Subscription', SUB],
    ['Resource Group', RG],
  ];

  switch (step.action) {
    case 'search':
    case 'get-information':
      return [
        ...common,
        ['Resource Type', 'Log Analytics Workspace'],
        ['Resource Name', WORKSPACE],
        ['Query', query(run, step)],
        ['Time Range Type', '2'],
      ];

    case 'run-playbook': {
      const pb = step.param ? PLAYBOOK_BY_ID[step.param] : undefined;
      return [
        ...common,
        ['Playbook', pb?.name ?? step.param ?? '—'],
        ['Acts on', pb?.acts ?? 'incident'],
        ['Incident', run.sourceRef],
        ['Entity', who],
      ];
    }

    case 'revoke-session':
    case 'disable-user':
    case 'reset-password':
      return [
        ['Directory', `${run.tenant.toLowerCase().replace(/\s/g, '')}.onmicrosoft.com`],
        ['User', who],
        ['Method', step.action === 'revoke-session' ? 'POST /users/{id}/revokeSignInSessions'
          : step.action === 'disable-user' ? 'PATCH /users/{id} { accountEnabled: false }'
          : 'POST /users/{id}/authentication/passwordMethods/{id}/resetPassword'],
      ];

    case 'isolate-device':
      return [
        ['Device', who],
        ['Isolation type', 'Full'],
        ['Comment', `Isolated by ${run.flowName}`],
      ];

    case 'quarantine-file':
    case 'quarantine-email':
      return [
        [step.action === 'quarantine-file' ? 'File' : 'Message', who],
        ['Scope', step.action === 'quarantine-email' ? 'Every recipient mailbox' : 'Endpoint'],
      ];

    case 'block-ip':
    case 'block-domain':
      return [
        [step.action === 'block-ip' ? 'Address' : 'Domain', who],
        ['List', 'Deny'],
        ['Expires', 'Never'],
      ];

    case 'create-ticket':
    case 'update-ticket':
      return [
        ['System', ACTION_BY_ID[step.action].system],
        ['Incident', run.sourceRef],
        ['Title', `${run.flowName} — ${run.tenant}`],
        ['Severity', run.outcome === 'failed' ? 'High' : 'Medium'],
      ];

    case 'send-email':
    case 'send-sms':
    case 'send-incident-report':
    case 'send-monthly-report':
      return [
        ['To', step.param || 'the tenant notification list'],
        ['Subject', `${run.flowName} — ${run.tenant}`],
        ['Incident', run.sourceRef],
      ];

    case 'add-comment':
    case 'add-tag':
    case 'change-severity':
    case 'assign-analyst':
      return [
        ['Incident', run.sourceRef],
        ['Value', step.param || '—'],
      ];

    default:
      return [['Incident', run.sourceRef], ['Entity', who]];
  }
}

/** What the connector handed back. */
function responseFor(run: FlowRun, step: RunStep): unknown {
  if (step.status === 'failed') return { error: step.detail };
  if (step.status === 'skipped') return { skipped: true, reason: step.detail };
  if (step.status === 'awaiting-approval') return { status: 'Pending', waitingOn: run.approvedBy ?? 'an analyst' };

  const t = step.target;
  switch (step.action) {
    case 'search':
    case 'get-information':
      return [{
        Entities: `[{"$id":"3","${t?.kind === 'device' ? 'HostName' : 'AadUserId'}":"${t?.value ?? 'd8d54317-7f36-464d-be28'}","IsDomainJoined":true,"Type":"${t?.kind ?? 'account'}"}]`,
        TimeGenerated: run.startedAt,
      }];
    case 'create-ticket':
    case 'update-ticket':
      return { number: `INC-${run.id.replace(/\D/g, '').slice(-5)}`, state: 'Open', assigned: run.approvedBy ?? 'unassigned' };
    case 'run-playbook':
      return { status: 'Succeeded', runId: run.id, durationMs: step.durationMs };
    default:
      return { status: 'Succeeded', target: t?.value ?? run.sourceRef, detail: step.detail };
  }
}

export function stepIo(run: FlowRun, step: RunStep): StepIo {
  const inputs = callFor(run, step);
  const response = responseFor(run, step);
  return {
    inputs,
    outputs: pretty(response),
    rawInputs: pretty(Object.fromEntries(inputs.map(([k, v]) => [k.replace(/\s/g, ''), v]))),
    rawOutputs: pretty(response),
  };
}
