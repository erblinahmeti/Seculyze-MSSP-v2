// ─── Tenants ─────────────────────────────────────────────────────────────────
//
// The one list of customers under management. Configurations, the flow
// register and the automation audit each used to keep their own copy of nine
// names, which was survivable at nine and not at sixty — the sidebar would
// have offered sixty tenants while a condition dropdown offered nine.
//
// Sixty is the number the console is designed against now. It is the scale
// where a fleet view earns its place: naming three affected clients stops
// being information, per-tenant figures stop having a single value, and the
// difference between "two settings missing" and "two settings missing across
// forty workspaces" becomes the whole job.
//
// The first nine are unchanged, so anything written against the smaller list
// still reads the same.

export const TENANTS = [
  'Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'New Balance', 'Asics', 'Converse', 'Vans',
  'Fila', 'Umbro', 'Kappa', 'Mizuno', 'Diadora', 'Lotto', 'Hummel', 'Joma', 'Macron',
  'Saucony', 'Brooks', 'Salomon', 'Merrell', 'Columbia', 'Patagonia', 'Arcteryx', 'Mammut',
  'Berghaus', 'Rab', 'Haglofs', 'Fjallraven', 'Timberland', 'Clarks', 'Geox', 'Ecco',
  'Camper', 'Birkenstock', 'Crocs', 'Skechers', 'Hoka', 'Altra', 'Topo', 'Inov8',
  'Scarpa', 'La Sportiva', 'Garmont', 'Lowa', 'Meindl', 'Zamberlan', 'Keen', 'Teva',
  'Osprey', 'Deuter', 'Gregory', 'Thule', 'Ortlieb', 'Vaude', 'Jansport', 'Eastpak',
  'Herschel', 'Samsonite',
];

/** The value a condition or a mock flow uses to mean "every customer". */
export const ALL_TENANTS = `All ${TENANTS.length}`;

/**
 * A deterministic spread of tenants, for mock data that needs "some of them".
 * Stepping by a prime keeps the picks scattered rather than clustered at the
 * front of the alphabet, and the same call always returns the same set.
 */
export function someTenants(count: number, offset: number): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count && i < TENANTS.length * 2; i++) {
    const name = TENANTS[(offset + i * 7) % TENANTS.length];
    if (!out.includes(name)) out.push(name);
  }
  return out;
}
