// ─── Status colours ──────────────────────────────────────────────────────────
//
// The same colours as the status badges in the Incidents (A) table
// (StatusBadge in Incidents.tsx): New blue, Active emerald, Closed grey.

export const STATUSES = ['New', 'Active', 'Closed'] as const;
export type StatusLevel = (typeof STATUSES)[number];

export const STATUS_BADGE: Record<StatusLevel, string> = {
  New: 'bg-blue-100/80 text-blue-500',
  Active: 'bg-emerald-100/70 text-emerald-600',
  Closed: 'bg-gray-100/80 text-gray-500',
};

/**
 * Statuses on the dark navy panel header: white at three strengths, no hue.
 * Blue tinted over the navy turned muddy and off-brand, and a neutral status
 * keeps it apart from the teal severity pill beside it. New (needs someone) is
 * strongest, Closed (nothing left to do) is an outline only.
 */
export const STATUS_BADGE_ON_DARK: Record<StatusLevel, string> = {
  New: 'bg-white/20 border-transparent text-white',
  Active: 'bg-white/10 border-transparent text-white/85',
  Closed: 'bg-transparent border-white/30 text-white/70',
};
