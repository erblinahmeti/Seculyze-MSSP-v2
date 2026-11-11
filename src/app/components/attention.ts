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

/** The Incidents (A) table colours: red for a verdict, threat-intel bands from turquoise to navy. */
export const ATTENTION_BADGE: Record<Attention, string> = {
  'True Positive Detected': 'bg-[#b73520] text-white',
  'Threat Intel: High Risk': 'bg-[#092E3F] text-white',
  'Threat Intel: Medium Risk': 'bg-[#2b7376] text-white',
  'Threat Intel: Low Risk': 'bg-[#66c1bf] text-[#224a4d]',
  'Tuning: False Positive': 'bg-[#e8f6f5] text-[#224a4d]',
  'No Attention': 'bg-gray-100 text-gray-500',
};

/**
 * The same badges on the dark navy panel header. Two need help there: High
 * risk is navy on navy, so it inverts to a white pill with navy text — the
 * most contrast for the highest band, ahead of the teal severity pill; the
 * pale false-positive tint would glow, so it becomes an outline in its own
 * turquoise. True positive keeps the table's solid system red. The rest read as
 * they are.
 */
export const ATTENTION_ON_DARK: Record<Attention, string> = {
  'True Positive Detected': 'bg-[#b73520] border-[#b73520] text-white',
  'Threat Intel: High Risk': 'bg-white border-white text-[#092E3F]',
  'Threat Intel: Medium Risk': 'bg-[#2b7376] border-[#2b7376] text-white',
  'Threat Intel: Low Risk': 'bg-[#66c1bf] border-[#66c1bf] text-[#224a4d]',
  'Tuning: False Positive': 'bg-transparent border-[#66c1bf]/70 text-[#e8f6f5]',
  'No Attention': 'bg-transparent border-white/30 text-white/70',
};
