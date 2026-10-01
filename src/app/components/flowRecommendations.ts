import {
  CONDITION_BY_ID, TRIGGER_BY_ID, makeKey,
  type Flow, type TriggerId, type ConditionId, type ActionId,
} from './flowRegister';

// ─── Recommendations ─────────────────────────────────────────────────────────
//
// Pre-built automations Seculyze suggests, which replaced the idea of a
// template gallery. The difference is the whole point: a template is a blank
// pattern you have to recognise as relevant, a recommendation says why it is
// being put in front of *you* and what adopting it is worth.
//
// So every entry carries a `reason` tied to something observed in the tenant's
// own data, never generic advice — "1,284 alerts from three Defender malware
// rules closed as false positive last month" rather than "reduce alert noise".
// The numbers here are mock, like the rest of the prototype's data, but the
// shape is what the real thing has to produce.
//
// Every recommendation is built from the register, so none of them can suggest
// a condition or an action its trigger is not allowed to reach.
//
// Three more were dropped when the six red triggers came out of v1 scope —
// an incident-closed report, a cool-down on repeat sign-in incidents, and
// enrichment on every new incident. All three hung off Incident created or
// Incident closed. They are not retargeted at a surviving trigger, because the
// reason each one gives is tied to incident volume and would stop being true.

export type RecTag = 'Noise' | 'Containment' | 'Reporting' | 'Cost' | 'Triage';

export interface Recommendation {
  id: string;
  name: string;
  /** Why this is in front of you — grounded in observed data. */
  reason: string;
  /** What adopting it is worth. */
  impact: string;
  /**
   * Kept on the data but no longer shown — the chips were adding a second
   * vocabulary next to the trigger groups for no gain. Re-surfacing it is a
   * presentation change, not a data one.
   */
  tag: RecTag;
  trigger: TriggerId;
  conditions: [ConditionId, string, string][];
  actions: [ActionId, string?][];
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec-01',
    name: 'Auto-close benign Defender malware',
    tag: 'Noise',
    reason: '1,284 alerts from 3 Defender malware rules were closed as false positive last month — 94% of everything those rules raised.',
    impact: '~21 h/month of analyst time',
    trigger: 'fp',
    conditions: [
      ['tool', 'is', 'Defender for Endpoint'],
      ['alert-rule', 'matches', '*Malware*'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['add-comment', 'Closed automatically — known benign malware rule'], ['add-tag', 'auto-closed']],
  },
  {
    id: 'rec-02',
    name: 'Revoke session on confirmed identity compromise',
    tag: 'Containment',
    reason: '17 confirmed identity compromises last quarter. Median time to the first containment action was 41 minutes.',
    impact: 'Containment in under a minute',
    trigger: 'tp',
    conditions: [
      ['ml-confidence', 'is above', '0.90'],
      ['approval', 'required from', 'An analyst'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['revoke-session'], ['create-ticket']],
  },
  {
    id: 'rec-03',
    name: 'Isolate on ransomware behaviour',
    tag: 'Containment',
    reason: 'Ransomware rules fired 6 times in 90 days across 2 tenants. None of them are automated today.',
    impact: 'Minutes saved at the worst possible moment',
    trigger: 'tp',
    conditions: [
      ['alert-rule', 'matches', '*Ransomware*'],
      ['approval', 'required from', 'A senior analyst'],
    ],
    actions: [['isolate-device'], ['create-ticket'], ['send-sms', '+45 …']],
  },
  {
    id: 'rec-05',
    name: 'Monthly customer report',
    tag: 'Reporting',
    reason: 'All 9 tenants are reported on manually today, on different days of the month.',
    impact: '~12 h/month',
    trigger: 'schedule',
    conditions: [
      ['customers', 'is one of', 'All 9'],
      ['timing', 'is', 'Every month on the 1st'],
    ],
    actions: [['send-monthly-report'], ['send-email', 'reports@seculyze.com']],
  },
  {
    id: 'rec-07',
    name: 'Keep service accounts out of containment',
    tag: 'Triage',
    reason: '23% of identity alerts last month involved service accounts, which cannot be contained the same way a user can.',
    impact: 'Fewer containment attempts that were never going to work',
    trigger: 'tp',
    conditions: [
      ['account-type', 'excludes', 'Service accounts'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['assign-analyst', 'Identity queue'], ['add-tag', 'service-account']],
  },
  {
    id: 'rec-08',
    name: 'Quarantine confirmed phishing mail',
    tag: 'Containment',
    reason: 'Defender for Office 365 raised 340 confirmed phishing alerts last quarter. Mail is quarantined by hand today.',
    impact: '~7 h/month',
    trigger: 'tp',
    conditions: [
      ['tool', 'is', 'Defender for Office365'],
      ['approval', 'required from', 'An analyst'],
    ],
    actions: [['quarantine-email'], ['create-ticket']],
  },
  {
    id: 'rec-09',
    name: 'Block IPs from high-severity threat intel',
    tag: 'Containment',
    reason: 'High-severity threat-intel matches hit 54 distinct IPs last quarter, each blocked manually.',
    impact: 'Blocked within seconds of the match',
    trigger: 'ti-high',
    conditions: [
      ['approval', 'required from', 'An analyst'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['block-ip'], ['add-comment', 'Blocked on high-severity TI match']],
  },
  {
    id: 'rec-10',
    name: 'Raise a ticket on ingestion spikes',
    tag: 'Cost',
    reason: '4 ingestion anomalies went above 400% of baseline in 30 days. Two of them went unnoticed for more than a day.',
    impact: 'Catches cost overruns the same day',
    trigger: 'ingestion-anomaly',
    conditions: [
      ['threshold', 'is above', '400% of baseline'],
      ['log-source', 'is', 'All log sources'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['create-ticket'], ['send-email', 'soc@seculyze.com']],
  },
  {
    id: 'rec-11',
    name: 'Escalate budget overruns',
    tag: 'Cost',
    reason: '3 tenants went past their commitment tier last quarter, and nobody found out until the invoice.',
    impact: 'No surprise invoices',
    trigger: 'budget-anomaly',
    conditions: [
      ['threshold', 'is above', '25% over budget'],
      ['customers', 'is one of', 'All 9'],
    ],
    actions: [['send-email', 'accounts@seculyze.com'], ['assign-analyst', 'Service delivery']],
  },
];

/** Turn a recommendation into an editable automation, ready for the builder. */
export function recommendationToFlow(r: Recommendation): Flow {
  return {
    id: makeKey(),
    name: r.name,
    trigger: r.trigger,
    triggerParam: r.trigger === 'schedule' ? 'Every month on the 1st' : undefined,
    matchAll: true,
    conditions: r.conditions.map(([id, operator, value]) => ({ key: makeKey(), id, operator, value })),
    actions: r.actions.map(([action, param]) => ({ key: makeKey(), action, param })),
    isActive: false,
    isPrebuilt: true,
  };
}

/** The one-line summary of what a recommendation would look at. */
export function recScope(r: Recommendation): string {
  const t = TRIGGER_BY_ID[r.trigger].name;
  if (r.conditions.length === 0) return `Every ${t.toLowerCase()}`;
  const first = r.conditions[0];
  const rest = r.conditions.length - 1;
  return `${t} · ${CONDITION_BY_ID[first[0]].name.toLowerCase()} ${first[1]} ${first[2]}${rest ? ` +${rest}` : ''}`;
}
