// ─── ITSM per tenant ─────────────────────────────────────────────────────────
//
// Each tenant connects its own ITSM, so "Create ticket" goes to — and shows the
// logo of — the incident's tenant's platform. Logos are dropped into
// src/assets/itsm/<platform>.svg|png (see the README there) and picked up here;
// until one exists, callers fall back to a generic ticket icon.

export type ItsmPlatform = 'ServiceNow' | 'Autotask';

/** Mock: which ITSM each test tenant has connected. */
export const TENANT_ITSM: Record<string, ItsmPlatform> = {
  Nike: 'ServiceNow',
  Adidas: 'Autotask',
  Puma: 'ServiceNow',
  // The main Incidents page's other tenants.
  Apple: 'ServiceNow',
  Microsoft: 'Autotask',
  Google: 'ServiceNow',
};

// Every logo file present at build time, keyed by file name.
const files = import.meta.glob('../../assets/itsm/*.{svg,png}', { eager: true, import: 'default' }) as Record<string, string>;

/** The platform's logo URL, or null if no file has been added yet. */
export function itsmLogo(platform: string): string | null {
  const slug = platform.toLowerCase();
  const hit = Object.entries(files).find(([path]) => path.split('/').pop()?.replace(/\.(svg|png)$/, '') === slug);
  return hit ? hit[1] : null;
}
