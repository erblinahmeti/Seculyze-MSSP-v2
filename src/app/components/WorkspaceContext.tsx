import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CLIENTS } from './configData';

// ─── Workspace scope ─────────────────────────────────────────────────────────
//
// The whole console answers a different question depending on who is asking.
//
//   mssp   — nine tenants at once. "How many of mine are missing this, and
//            which do I fix first?" Rows aggregate, numbers are counts across
//            the book, and per-workspace figures have no single value.
//   tenant — one customer. "Is this on, and what is it reporting?" Rows are
//            that workspace's own state, and portal deep links work because
//            there is one workspace to deep link into.
//
// It lives above the pages rather than inside each one, because it is the same
// question on every screen and a per-page picker would let the Configurations
// page say Adidas while the Incidents page said everything.
//
// Pages read it with useWorkspace(). A page that has not been through its pass
// yet can ignore it and still works — scope is additive, not a rewrite.

export type Scope = 'mssp' | 'tenant';

interface Workspace {
  scope: Scope;
  /** The tenant in view. Null in mssp scope. */
  tenant: string | null;
  /** Every tenant under management, in both scopes. */
  tenants: string[];
  /** The tenants a page should actually show. */
  inScope: string[];
  /** True when exactly one workspace is in view — the single-tenant design. */
  single: boolean;
  /** What to call the current scope in a heading. */
  label: string;
  setScope: (scope: Scope) => void;
  setTenant: (tenant: string) => void;
}

const KEY = 'seculyze:workspace';

const WorkspaceCtx = createContext<Workspace | null>(null);

const read = (): { scope: Scope; tenant: string | null } => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { scope: 'mssp', tenant: null };
    const v = JSON.parse(raw);
    if (v.scope === 'tenant' && CLIENTS.includes(v.tenant)) return { scope: 'tenant', tenant: v.tenant };
    return { scope: 'mssp', tenant: null };
  } catch {
    return { scope: 'mssp', tenant: null };
  }
};

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [{ scope, tenant }, set] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ scope, tenant })); } catch { /* private window */ }
  }, [scope, tenant]);

  const value = useMemo<Workspace>(() => ({
    scope,
    tenant,
    tenants: CLIENTS,
    inScope: scope === 'tenant' && tenant ? [tenant] : CLIENTS,
    single: scope === 'tenant' && !!tenant,
    label: scope === 'tenant' && tenant ? tenant : 'All clients',
    // Switching to single tenant with nobody chosen lands on the first one
    // rather than an empty console.
    setScope: next => set(s => next === 'tenant'
      ? { scope: 'tenant', tenant: s.tenant ?? CLIENTS[0] }
      : { scope: 'mssp', tenant: s.tenant }),
    setTenant: t => set({ scope: 'tenant', tenant: t }),
  }), [scope, tenant]);

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
