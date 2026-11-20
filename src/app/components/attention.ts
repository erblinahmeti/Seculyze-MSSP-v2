// ─── Attention ───────────────────────────────────────────────────────────────
//
// Seculyze's own assessment of an incident — the Attention column in the
// Incidents (A) table (AttentionBadge in Incidents.tsx). Unlike Sentinel
// severity, which the analytics rule sets once for every incident it raises,
// Attention is worked out per incident, so it leads in the panel header.

export type Attention =
  | 'True Positive Detected'
  | 'Threat Intel: High Risk'
  | 'Threat Intel: Medium Risk'
  | 'Threat Intel: Low Risk'
  | 'Tuning: False Positive'
  | 'No Attention';

/**
 * The approved Attention colours — one per classification, used everywhere it
 * is shown: the table badge, the panel header, and the Threat Analysis chart.
 * Red for a verdict; the threat-intel bands step from pale teal to navy; a
 * false positive is the palest tint. Change them here, not in a page.
 */
export const ATTENTION_COLOR: Record<Exclude<Attention, 'No Attention'>, string> = {
  'True Positive Detected': '#b73520',
  'Threat Intel: High Risk': '#092e3f',
  'Threat Intel: Medium Risk': '#2a96a8',
  'Threat Intel: Low Risk': '#90c6cf',
  'Tuning: False Positive': '#e5f2f4',
};

/** The table badge: the colour above as the fill, white or navy text for contrast. */
export const ATTENTION_BADGE: Record<Attention, string> = {
  'True Positive Detected': 'bg-[#b73520] text-white',
  'Threat Intel: High Risk': 'bg-[#092e3f] text-white',
  'Threat Intel: Medium Risk': 'bg-[#2a96a8] text-white',
  'Threat Intel: Low Risk': 'bg-[#90c6cf] text-[#092e3f]',
  'Tuning: False Positive': 'bg-[#e5f2f4] text-[#092e3f]',
  'No Attention': 'bg-gray-100 text-gray-500',
};

/**
 * The same badges on the dark navy panel header — the table colours, except
 * High risk: its navy would vanish into the navy header, so it takes the
 * header's own lighter navy (#184354, the gradient's end) with white text.
 * Every label's border is its own fill.
 */
export const ATTENTION_ON_DARK: Record<Attention, string> = {
  'True Positive Detected': `${ATTENTION_BADGE['True Positive Detected']} border-[#b73520]`,
  'Threat Intel: High Risk': 'bg-[#184354] border-[#184354] text-white',
  'Threat Intel: Medium Risk': `${ATTENTION_BADGE['Threat Intel: Medium Risk']} border-[#2a96a8]`,
  'Threat Intel: Low Risk': `${ATTENTION_BADGE['Threat Intel: Low Risk']} border-[#90c6cf]`,
  'Tuning: False Positive': `${ATTENTION_BADGE['Tuning: False Positive']} border-[#e5f2f4]`,
  'No Attention': `${ATTENTION_BADGE['No Attention']} border-gray-100`,
};
