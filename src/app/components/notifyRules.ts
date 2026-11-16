// ─── who gets told ───────────────────────────────────────────────────────────
//
// The Notifications page does not ask you to build anything. The thresholds
// are already there, fixed — two for budget, three for ingestion anomalies —
// and the only thing left to fill in is *who hears about it*. Every one of
// them starts out saying "No contacts configured.", which is a threshold that
// fires into an empty room.
//
// That is the real gap, and it is a different gap from the one Configurations
// first recommended against. An automation that does not exist is at least
// visibly absent. A threshold with nowhere to send looks configured — it has a
// number, it sits in a list, it reads as set up — and it is silent.
//
// "Channels", not "contacts", because two of the three kinds are not people:
// an address, a phone number, or an ITSM integration — Jira, Autotask,
// Xurrent — switched on so the alert lands as a ticket. The page's own type is
// already NotificationChannel; this follows it rather than inventing a second
// word for the same thing.

export type NotifySection = 'budget' | 'anomaly' | 'incident';

export interface NotifyRule {
  id: string;
  section: NotifySection;
  /** The condition as the page words it, minus the "if …" lead-in. */
  when: string;
  /** The same thing in two or three words, for a line that has to stay on one line. */
  short: string;
  /** Where it would be sent: an address, a number, or an ITSM integration.
   *  Empty is the whole problem. */
  channels: string[];
}

/**
 * Seeded as a tenant that has just been onboarded: the thresholds exist,
 * because they ship with the product, and nobody has been put on any of them
 * yet. That is the state the recommendation is for, and it is the state a new
 * customer is actually in.
 *
 * To see the other side of it — a section that is covered, and its card gone —
 * put an address in a section's `channels` below.
 */
export const NOTIFY_RULES: NotifyRule[] = [
  { id: 'budget-projected', section: 'budget', when: 'Projected to breach', short: 'projected to breach', channels: [] },
  { id: 'budget-breached', section: 'budget', when: "Breached it's limit", short: 'breached its limit', channels: [] },

  { id: 'anomaly-450', section: 'anomaly', when: 'Ingestion exceeds 450% of baseline/hour', short: '450% of baseline', channels: [] },
  { id: 'anomaly-650', section: 'anomaly', when: 'Ingestion exceeds 650% of baseline/hour', short: '650% of baseline', channels: [] },
  { id: 'anomaly-quiet', section: 'anomaly', when: 'No ingestion for 24 hours', short: 'no ingestion for 24h', channels: [] },

  // Incidents, by how Seculyze classified them — the same four buckets the
  // Threat Analysis card counts. Unlike the thresholds above, these are set
  // once for the MSSP and apply to every tenant (the settings dialog says so).
  // Seeded so the Incidents overview shows every state: all three channel
  // kinds, ITSM without a person, and a silent bucket. Most MSSPs run one
  // ticketing system and one SMS number, so the seed does too.
  { id: 'incident-tp', section: 'incident', when: 'True positive detected', short: 'True Positives', channels: ['noor@seculyze.com', '+45 2012 3456', 'Jira'] },
  { id: 'incident-high', section: 'incident', when: 'Threat intel: high risk', short: 'Threat Intel: High', channels: ['noor@seculyze.com', 'berlin@seculyze.com', 'Jira'] },
  { id: 'incident-medium', section: 'incident', when: 'Threat intel: medium risk', short: 'Threat Intel: Medium', channels: ['Xurrent'] },
  { id: 'incident-low', section: 'incident', when: 'Threat intel: low risk', short: 'Threat Intel: Low', channels: [] },
];

/** Channels that are a ticketing integration rather than a person. */
export const ITSM_CHANNELS = ['Jira', 'Autotask', 'Xurrent', 'ServiceNow', 'PagerDuty'];
export const isItsm = (channel: string) => ITSM_CHANNELS.includes(channel);

export type ChannelKind = 'email' | 'sms' | 'itsm';

/** An address is e-mail, a number is SMS, a known integration is ITSM. */
export const channelKind = (channel: string): ChannelKind =>
  isItsm(channel) ? 'itsm' : channel.includes('@') ? 'email' : 'sms';

/** The thresholds in a section that would fire with nowhere to send. */
export function unmanned(rules: NotifyRule[], section: NotifySection): NotifyRule[] {
  return rules.filter(r => r.section === section && r.channels.length === 0);
}

export const ruleCount = (rules: NotifyRule[], section: NotifySection) =>
  rules.filter(r => r.section === section).length;
