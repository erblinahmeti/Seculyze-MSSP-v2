import {
  ACTION_BY_ID, CONDITION_BY_ID, TRIGGER_BY_ID,
  actionChangesCustomerSystems,
  type Flow, type ActionId, type ConditionId, type TriggerId,
} from './flowRegister';
import { parseSelection } from './MultiSelect';
import { TENANTS } from './tenants';

// ─── What it would have done ─────────────────────────────────────────────────
//
// "Test on last 30 days" was a button that ran something and told you it had
// worked. That is the wrong question. Nobody switching on an automation is
// asking "does it execute" — they are asking "what is it going to do to my
// customers", and the honest way to answer that is to run it backwards over
// history that already happened and count.
//
// So this replays the draft against the last 30 days and returns the numbers a
// person needs in order to say yes: how often it would have fired, how many
// customers it would have touched, what each action would have done, and which
// of those reach into a customer's environment. Plus a handful of named
// incidents, because a count is only believable if you can spot-check it.
//
// The numbers are generated, not measured — this is a prototype and there is no
// warehouse behind it. They are seeded off the flow's own shape, so the same
// draft always produces the same answer and editing a condition visibly moves
// it. A real implementation swaps this file and keeps the shape.

/** Fixed seed, so a given draft always reviews the same way. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};

/** Roughly how many times each trigger fired across the whole fleet in 30 days. */
const VOLUME_30D: Record<TriggerId, number> = {
  tp: 486,
  'ti-high': 164,
  'ti-med': 921,
  'ti-low': 2604,
  fp: 1187,
  'another-playbook': 93,
  schedule: 30,
  'ingestion-anomaly': 47,
  'budget-anomaly': 16,
};

/** How much of the traffic survives each condition, once it has a value. */
const NARROWS_TO: Record<ConditionId, number> = {
  tool: 0.42,
  'alert-rule': 0.18,
  'account-type': 0.61,
  'blast-radius': 0.34,
  cooldown: 0.71,
  approval: 1,          // holds actions back, does not filter the trigger
  'ml-confidence': 0.46,
  customers: 1,         // handled separately — it scales by tenant count
  timing: 1,            // a schedule's own cadence, not a filter
  threshold: 0.55,
  'ingestion-stop': 0.29,
  'log-source': 0.47,
};

/** How often an action's target actually exists on a matching incident. */
const APPLIES: Partial<Record<ActionId, number>> = {
  'revoke-session': 0.63,
  'disable-user': 0.63,
  'reset-password': 0.63,
  'isolate-device': 0.48,
  'quarantine-file': 0.21,
  'quarantine-email': 0.17,
  'block-ip': 0.39,
  'block-domain': 0.12,
};

/** The sentence each action's count goes into. %N is the number. */
const COUNTED: Partial<Record<ActionId, [string, string]>> = {
  'revoke-session': ['%N sign-in session revoked', '%N sign-in sessions revoked'],
  'disable-user': ['%N account disabled', '%N accounts disabled'],
  'reset-password': ['%N password reset', '%N passwords reset'],
  'isolate-device': ['%N device isolated from the network', '%N devices isolated from the network'],
  'quarantine-file': ['%N file quarantined', '%N files quarantined'],
  'quarantine-email': ['%N message quarantined', '%N messages quarantined'],
  'block-ip': ['%N address blocked', '%N addresses blocked'],
  'block-domain': ['%N domain blocked', '%N domains blocked'],
  'create-ticket': ['%N ticket opened', '%N tickets opened'],
  'update-ticket': ['%N ticket updated', '%N tickets updated'],
  'add-comment': ['%N comment added', '%N comments added'],
  'assign-analyst': ['%N incident assigned', '%N incidents assigned'],
  'change-severity': ['%N severity changed', '%N severities changed'],
  'add-tag': ['%N tag applied', '%N tags applied'],
  'get-information': ['%N enrichment gathered', '%N enrichments gathered'],
  search: ['%N query run', '%N queries run'],
  'send-email': ['%N e-mail sent', '%N e-mails sent'],
  'send-sms': ['%N text message sent', '%N text messages sent'],
  'send-incident-report': ['%N report sent', '%N reports sent'],
  'send-monthly-report': ['%N monthly report sent', '%N monthly reports sent'],
  'run-playbook': ['%N playbook run', '%N playbook runs'],
};

const ALERT_SAMPLES: Record<string, string[]> = {
  tp: ['Credential access confirmed on LAP-4471', 'Suspicious inbox rule on m.jensen@', 'Impossible travel confirmed for a.larsen@'],
  'ti-high': ['Outbound to 185.220.101.44 (known C2)', 'Hash match on update_pkg.dll', 'DNS lookup for cdn-update-srv.net'],
  'ti-med': ['IOC match on invoice_Q4.xlsm', 'Contact with 91.219.236.18', 'Reputation hit on login-verify-mail.com'],
  'ti-low': ['Low-confidence IOC on WRK-0182', 'Stale indicator match on SRV-DC01', 'Aged hash match on statement.pdf.exe'],
  fp: ['Defender malware rule, known benign', 'Backup service flagged as mass deletion', 'Scanner traffic flagged as recon'],
  'another-playbook': ['Chained from Enrich-Entity', 'Chained from Triage-Phishing', 'Chained from Contain-Host'],
  'ingestion-anomaly': ['Firewall log volume down 94%', 'AADNonInteractive stopped at 03:10', 'Syslog volume up 6× on one source'],
  'budget-anomaly': ['Ingestion 38% over commitment', 'Spend pace puts month 22% over', 'One table at 41% of the bill'],
  schedule: ['Daily run, 07:00', 'Daily run, 07:00', 'Daily run, 07:00'],
};

export interface BacktestHit {
  tenant: string;
  ref: string;
  when: string;
  what: string;
}

export interface BacktestAction {
  action: ActionId;
  param?: string;
  count: number;
  held: number;
  changesCustomerSystems: boolean;
  phrase: string;
}

export interface Backtest {
  /** True for a schedule — it ran on a cadence, it did not match anything. */
  isScheduled: boolean;
  /** How many trigger events there were before any condition was applied. */
  candidates: number;
  /** How many of those the flow would have acted on. */
  matched: number;
  perDay: number;
  tenants: number;
  actions: BacktestAction[];
  /** How many actions reaching into customer systems would have run unheld. */
  unheldChanges: number;
  heldForApproval: boolean;
  samples: BacktestHit[];
  /** Things that should stop someone pressing the button. */
  blockers: string[];
  /** Things worth reading first, but not reasons to stop. */
  notes: string[];
}

const plural = (n: number, pair: [string, string]) =>
  (n === 1 ? pair[0] : pair[1]).replace('%N', n.toLocaleString());

export function backtest(f: Flow): Backtest {
  const seed = hash(`${f.trigger}|${f.conditions.map(c => c.id + c.operator + c.value).join(',')}|${f.actions.map(a => a.action + (a.param ?? '')).join(',')}`);
  const rand = rng(seed);

  const trigger = f.trigger as TriggerId;
  const def = TRIGGER_BY_ID[trigger];
  const isScheduled = def?.group === 'schedule';
  const candidates = VOLUME_30D[trigger] ?? 0;
  if (trigger && candidates === 0 && !VOLUME_30D[trigger]) {
    console.warn(`flowBacktest: no 30-day volume for trigger "${trigger}" — review will read as "never matched"`);
  }

  // Conditions with a value narrow the traffic; the ones without are dead
  // weight and get called out rather than silently counted as a filter.
  const live = f.conditions.filter(c => c.value);
  const unset = f.conditions.filter(c => !c.value).map(c => CONDITION_BY_ID[c.id].name);

  let keep = 1;
  for (const c of live) keep *= NARROWS_TO[c.id] ?? 0.5;
  // "any" is a union, not an intersection — it lets more through, not less.
  if (!f.matchAll && live.length > 1) keep = Math.min(1, keep * live.length * 1.8);

  // Scoping to named customers has to change who shows up in the examples, not
  // just the arithmetic — otherwise the review offers evidence from customers
  // the flow would never have touched.
  // parseSelection returns an empty list for "every tenant" — it is a phrase,
  // not sixty ticked names, so that nothing excludes the tenant onboarded
  // tomorrow. Empty here means all, never none.
  const scope = live.find(c => c.id === 'customers');
  const picked = scope ? parseSelection(scope.value) : [];
  const scopedNames = picked.length ? picked : TENANTS;
  const scoped = scopedNames.length;
  const tenantShare = scoped / TENANTS.length;

  const matched = isScheduled
    ? candidates
    : Math.max(0, Math.round(candidates * keep * tenantShare));

  // How many distinct customers you would expect to see hit, if the matches
  // land evenly across the ones in scope. Guessing lower than the examples
  // below it would make the whole page look unreliable.
  const tenants = matched === 0 ? 0
    : isScheduled ? scoped
    : Math.min(scoped, Math.max(1, Math.round(scoped * (1 - Math.pow(1 - 1 / scoped, matched)))));

  const heldForApproval = live.some(c => c.id === 'approval');

  const actions: BacktestAction[] = f.actions.map(a => {
    const applies = APPLIES[a.action] ?? 1;
    const total = Math.round(matched * applies);
    const changes = actionChangesCustomerSystems(a);
    const held = changes && heldForApproval ? total : 0;
    return {
      action: a.action,
      param: a.param,
      count: total,
      held,
      changesCustomerSystems: changes,
      phrase: plural(total, COUNTED[a.action] ?? ['%N run', '%N runs']),
    };
  });

  const unheldChanges = actions
    .filter(a => a.changesCustomerSystems)
    .reduce((n, a) => n + (a.count - a.held), 0);

  // A few named incidents, so the counts can be spot-checked rather than
  // taken on faith.
  const pool = ALERT_SAMPLES[trigger] ?? ALERT_SAMPLES.tp;
  const samples: BacktestHit[] = matched === 0 ? [] : Array.from({ length: Math.min(3, matched) }, (_, i) => {
    const day = 1 + Math.floor(rand() * 29);
    return {
      tenant: scopedNames[Math.floor(rand() * scoped) % scoped],
      ref: `INC-${13000 + Math.floor(rand() * 900)}`,
      when: `${day} ${day > 21 ? 'Sep' : 'Oct'}, ${String(Math.floor(rand() * 23)).padStart(2, '0')}:${String(Math.floor(rand() * 59)).padStart(2, '0')}`,
      what: pool[i % pool.length],
    };
  });

  const blockers: string[] = [];
  const notes: string[] = [];

  if (f.actions.length === 0) blockers.push('There are no actions, so this would have done nothing at all.');
  if (unset.length) {
    blockers.push(`${unset.length === 1 ? 'One condition has' : `${unset.length} conditions have`} no value set — ${unset.join(', ')}. ${unset.length === 1 ? 'It is' : 'They are'} switched on but ${unset.length === 1 ? 'does' : 'do'} nothing.`);
  }

  if (matched === 0) {
    blockers.push('Nothing in the last 30 days would have matched. Either the conditions are too narrow, or this is for something that has not happened yet.');
  } else if (!isScheduled && matched > 600) {
    notes.push(`That is about ${Math.round(matched / 30)} a day. Narrow it before you set it live, or it will be the loudest thing in the console.`);
  }

  if (unheldChanges > 0) {
    notes.push(`${unheldChanges.toLocaleString()} of these would have changed something in a customer's environment with nobody looking first. Switch on Approval if that should not happen unattended.`);
  } else if (heldForApproval && actions.some(a => a.changesCustomerSystems)) {
    notes.push('Everything that reaches into a customer environment would have waited for an analyst.');
  }

  return {
    isScheduled, candidates, matched, tenants,
    perDay: Math.round((matched / 30) * 10) / 10,
    actions, unheldChanges, heldForApproval, samples, blockers, notes,
  };
}

/** The headline, as one sentence, for the top of the review. */
export function verdict(b: Backtest, triggerName: string): string {
  if (b.matched === 0) return `Over the last 30 days, ${triggerName.toLowerCase()} never produced anything this flow would have acted on.`;
  const customers = `${b.tenants} customer${b.tenants === 1 ? '' : 's'}`;
  if (b.isScheduled) return `Over the last 30 days, this would have run ${b.matched === 1 ? 'once' : `${b.matched} times`} across ${customers}.`;
  if (b.matched === b.candidates) {
    return `Over the last 30 days, ${triggerName.toLowerCase()} fired ${b.candidates.toLocaleString()} times, across ${customers}. Nothing is narrowing it, so this would have acted on every one of them.`;
  }
  return `Over the last 30 days, this would have fired ${b.matched === 1 ? 'once' : `${b.matched.toLocaleString()} times`} — ${b.candidates.toLocaleString()} ${triggerName.toLowerCase()} events came in and the conditions kept ${Math.round((b.matched / b.candidates) * 100)}% of them, across ${customers}.`;
}

export const ACTION_LABEL = (a: BacktestAction) =>
  a.action === 'run-playbook' && a.param ? a.param : ACTION_BY_ID[a.action].name;
