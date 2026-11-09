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
 * The same colours for the dark navy panel header, as with severity: each
 * status keeps its colour family, tinted over the navy with white text, and
 * Closed — nothing left to do — is the quietest, an outline only.
 */
export const STATUS_BADGE_ON_DARK: Record<StatusLevel, string> = {
  New: 'bg-blue-500/30 border-transparent text-white',
  Active: 'bg-emerald-600/30 border-transparent text-white',
  Closed: 'bg-transparent border-white/30 text-white/70',
};
