// ─── Status colours ──────────────────────────────────────────────────────────
//
// Status is shown as a ringed dot and the word, in the AI Triage B incident
// panel and in the Incidents (A) table's Status column alike (StatusBadge in
// Incidents.tsx). STATUS_BADGE is the older filled-pill style, kept for
// anything that still wants a pill.

export const STATUSES = ['New', 'Active', 'Closed'] as const;
export type StatusLevel = (typeof STATUSES)[number];

export const STATUS_BADGE: Record<StatusLevel, string> = {
  New: 'bg-blue-100/80 text-blue-500',
  Active: 'bg-emerald-100/70 text-emerald-600',
  Closed: 'bg-gray-100/80 text-gray-500',
};

/**
 * Status on the dark navy panel header: a coloured dot and the label, as Azure
 * DevOps shows work-item state: New teal (waiting to be picked up), Active grey
 * (in progress), Closed green (done). Lighter steps of each family so a small
 * dot reads on navy. No fill turns muddy on the navy, and the teal severity
 * pill stays the only pill in the header.
 */
export const STATUS_DOT: Record<StatusLevel, string> = {
  New: 'bg-[#2A96A8]',
  Active: 'bg-gray-400',
  Closed: 'bg-emerald-500',
};

/** The ring round each header dot: the dot's own colour, faded. */
export const STATUS_DOT_RING: Record<StatusLevel, string> = {
  New: 'ring-[#2A96A8]/40',
  Active: 'ring-gray-400/40',
  Closed: 'ring-emerald-500/40',
};
