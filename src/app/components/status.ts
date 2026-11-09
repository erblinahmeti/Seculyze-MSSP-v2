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
 * Status on the dark navy panel header: a coloured dot and the label, as Azure
 * DevOps shows work-item state. New is brand teal (blue is barely used in the
 * product); Active emerald and Closed grey keep the Incidents (A) families, in
 * their lighter steps so a small dot reads on navy. No fill turns muddy on the
 * navy, and the teal severity pill stays the only pill in the header.
 */
export const STATUS_DOT: Record<StatusLevel, string> = {
  New: 'bg-[#2A96A8]',
  Active: 'bg-emerald-500',
  Closed: 'bg-gray-400',
};
