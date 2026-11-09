// ─── Severity colours ────────────────────────────────────────────────────────
//
// The same teal scale as the severity badges in the Incidents (A) table
// (SeverityBadge in Incidents.tsx): the higher the severity, the stronger the
// teal. Kept here so the triage pages and panel use one source.
//
// Incidents (A) has no Informational; it continues the scale one step below Low.

export const SEVERITIES = ['High', 'Medium', 'Low', 'Informational'] as const;
export type SeverityLevel = (typeof SEVERITIES)[number];

export const SEVERITY_BADGE: Record<SeverityLevel, string> = {
  High: 'bg-[#2A96A8] text-white',
  Medium: 'bg-[#2A96A8]/30 text-[#2A96A8]',
  Low: 'bg-[#2A96A8]/10 text-[#2A96A8]/60',
  Informational: 'bg-[#2A96A8]/5 text-[#2A96A8]/50',
};
