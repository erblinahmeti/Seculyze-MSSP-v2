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

/**
 * The same scale for the dark navy panel header. On navy the light end of the
 * table badges turns into the brightest pill, so the scale starts from the
 * dark surface instead: stronger teal still means more severe, and the low end
 * stays quiet. Teal and white at opacities only — no new colours.
 */
export const SEVERITY_BADGE_ON_DARK: Record<SeverityLevel, string> = {
  High: 'bg-[#2A96A8] border-[#2A96A8] text-white',
  Medium: 'bg-[#2A96A8]/50 border-transparent text-white',
  Low: 'bg-[#2A96A8]/20 border-transparent text-white/90',
  Informational: 'bg-transparent border-white/30 text-white/70',
};
