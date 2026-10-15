import { useEffect, useRef, useState } from 'react';
import { Building2, Building, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';

// ─── Workspace switcher ──────────────────────────────────────────────────────
//
// Sits under the logo, where every console that has more than one workspace
// puts it. Switching scope changes what the whole console is about, so it is
// not a filter inside a page — it is above them.
//
// Collapsed, it is the icon alone: a stack for the whole book, a single
// building for one tenant, so the scope is still legible at 80px wide.

export default function WorkspaceSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const { scope, tenant, tenants, label, setScope, setTenant } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => boxRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const matches = tenants.filter(t => t.toLowerCase().includes(q.trim().toLowerCase()));
  const Icon = scope === 'mssp' ? Building2 : Building;

  return (
    <div className={`relative ${isCollapsed ? 'px-3' : 'px-4'} pb-3`}>
      <button
        onClick={() => setOpen(v => !v)}
        title={isCollapsed ? `Workspace: ${label}` : undefined}
        className={`w-full flex items-center gap-2.5 rounded-[8px] bg-white/5 border border-white/10
                    hover:bg-white/10 transition-colors ${isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}`}
      >
        <Icon className="w-4 h-4 text-[#2A96A8] shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[10px] uppercase tracking-wide text-white/40">
                {scope === 'mssp' ? 'All tenants' : 'Single tenant'}
              </span>
              <span className="block text-sm text-white truncate">{label}</span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 mt-1 w-[260px] bg-white rounded-[8px] shadow-2xl border border-[var(--stroke)]
                        overflow-hidden ${isCollapsed ? 'left-full ml-2 top-0' : 'left-4 right-4 w-auto'}`}
          >
            {/* Scope first — it changes what every page means. */}
            <div className="p-1.5 border-b border-gray-100">
              {([
                ['mssp', Building2, 'All tenants', `${tenants.length} clients at once`],
                ['tenant', Building, 'Single tenant', 'One workspace at a time'],
              ] as const).map(([id, I, title, sub]) => (
                <button
                  key={id}
                  onClick={() => { setScope(id); if (id === 'mssp') setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left transition-colors ${
                    scope === id ? 'bg-[#eef1f3]' : 'hover:bg-[#fafbfb]'
                  }`}
                >
                  <I className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[#092E3F]">{title}</span>
                    <span className="block text-[11px] text-[#87999f]">{sub}</span>
                  </span>
                  {scope === id && <Check className="w-4 h-4 text-[#2A96A8] shrink-0" />}
                </button>
              ))}
            </div>

            {scope === 'tenant' && (
              <>
                <div className="relative border-b border-gray-100">
                  <Search className="w-3.5 h-3.5 text-[#b7c4c9] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={boxRef}
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Find a client"
                    className="w-full pl-8 pr-3 py-2 text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none"
                  />
                </div>
                <div className="max-h-[260px] overflow-y-auto py-1">
                  {matches.length === 0 && (
                    <p className="px-3 py-3 text-xs text-[#87999f]">No client matches</p>
                  )}
                  {matches.map(t => (
                    <button
                      key={t}
                      onClick={() => { setTenant(t); setOpen(false); }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors ${
                        t === tenant ? 'bg-[#eef1f3] text-[#092E3F]' : 'text-[#092E3F] hover:bg-[#fafbfb]'
                      }`}
                    >
                      {t}
                      {t === tenant && <Check className="w-3.5 h-3.5 text-[#2A96A8]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
