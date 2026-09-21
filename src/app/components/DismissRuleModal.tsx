import { useState } from 'react';
import { X, BellOff, RotateCcw, Clock, Globe, Users, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

// ─── types (exported so AlertRules.tsx can import) ───────────────────────────

export interface DismissalEntry {
  by: string;
  at: string;
  scope: 'global' | 'per-tenant';
  tenants?: string[];
  restoredBy?: string;
  restoredAt?: string;
}

export interface RuleDismissals {
  entries: DismissalEntry[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function isGloballyDismissed(dismissals: RuleDismissals | undefined): boolean {
  if (!dismissals) return false;
  return dismissals.entries.some(e => e.scope === 'global' && !e.restoredBy);
}

export function dismissedTenants(dismissals: RuleDismissals | undefined): string[] {
  if (!dismissals) return [];
  const active = dismissals.entries.filter(e => e.scope === 'per-tenant' && !e.restoredBy);
  return [...new Set(active.flatMap(e => e.tenants ?? []))];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── audit trail panel ───────────────────────────────────────────────────────

function AuditTrail({ entries }: { entries: DismissalEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-[#6b828c] mx-auto mb-2 opacity-40" />
        <p className="text-xs text-[#6b828c]">No history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {[...entries].reverse().map((entry, i) => (
        <div key={i} className="rounded-[8px] border border-[#e5f2f4] p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {entry.restoredBy ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-green-100 text-green-700">Restored</span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-[8px] bg-red-100 text-red-700">Dismissed</span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-[#f0f0f0] text-[#6b828c] font-mono">
                {entry.scope === 'global' ? 'Global' : `${entry.tenants?.length ?? 0} tenant${(entry.tenants?.length ?? 0) !== 1 ? 's' : ''}`}
              </span>
            </div>
            <span className="text-[10px] text-[#6b828c]">{formatTimestamp(entry.at)}</span>
          </div>
          <p className="text-xs text-[#092E3F]">
            <span className="font-medium">{entry.restoredBy ?? entry.by}</span>
            {entry.restoredBy ? ' restored this recommendation' : ' dismissed this recommendation'}
          </p>
          {entry.scope === 'per-tenant' && entry.tenants && (
            <p className="text-[10px] text-[#6b828c]">Tenants: {entry.tenants.join(', ')}</p>
          )}
          {entry.restoredBy && entry.restoredAt && (
            <p className="text-[10px] text-[#6b828c]">Restored at {formatTimestamp(entry.restoredAt)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── main modal ──────────────────────────────────────────────────────────────

interface DismissRuleModalProps {
  ruleName: string;
  tenants: string[];
  dismissals: RuleDismissals | undefined;
  currentUser: string;
  initialTab?: 'dismiss' | 'restore' | 'history';
  onDismiss: (entry: DismissalEntry) => void;
  onRestore: (scope: 'global' | 'per-tenant', tenants?: string[]) => void;
  onClose: () => void;
}

type ModalView = 'dismiss' | 'restore' | 'history';

export default function DismissRuleModal({
  ruleName,
  tenants,
  dismissals,
  currentUser,
  initialTab = 'dismiss',
  onDismiss,
  onRestore,
  onClose,
}: DismissRuleModalProps) {
  const [view, setView] = useState<ModalView>(initialTab);
  const [scope, setScope] = useState<'global' | 'per-tenant'>('global');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [tenantsExpanded, setTenantsExpanded] = useState(true);

  const globallyDismissed = isGloballyDismissed(dismissals);
  const alreadyDismissedTenants = dismissedTenants(dismissals);
  const hasDismissals = dismissals && dismissals.entries.some(e => !e.restoredBy);

  const activeTenants = tenants.filter(t => !alreadyDismissedTenants.includes(t));

  const toggleTenant = (tenant: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenant) ? prev.filter(t => t !== tenant) : [...prev, tenant]
    );
  };

  const handleDismiss = () => {
    const entry: DismissalEntry = {
      by: currentUser,
      at: new Date().toISOString(),
      scope,
      tenants: scope === 'per-tenant' ? selectedTenants : undefined,
    };
    onDismiss(entry);
    onClose();
  };

  const handleRestore = (restoreScope: 'global' | 'per-tenant', restoreTenants?: string[]) => {
    onRestore(restoreScope, restoreTenants);
    onClose();
  };

  const canDismiss =
    scope === 'global'
      ? !globallyDismissed
      : selectedTenants.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="relative w-[480px] bg-white rounded-[8px] shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <BellOff className="w-4 h-4 text-[#2A96A8]" />
                <p className="text-[#2A96A8] text-xs uppercase tracking-widest">Manage Recommendation</p>
              </div>
              <h2 className="text-white text-sm font-semibold leading-snug line-clamp-2">{ruleName}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[8px] transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-4">
            {(['dismiss', 'restore', 'history'] as ModalView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors capitalize ${
                  view === v
                    ? 'bg-white text-[#092E3F]'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {v === 'history' ? 'Audit Trail' : v.charAt(0).toUpperCase() + v.slice(1)}
                {v === 'restore' && hasDismissals && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-400/80 text-[#092E3F] rounded-[8px] text-[9px] font-bold">
                    {(dismissals?.entries.filter(e => !e.restoredBy).length ?? 0)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[520px] overflow-y-auto">

          {/* ── DISMISS VIEW ── */}
          {view === 'dismiss' && (
            <>
              {globallyDismissed ? (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[8px] p-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-[#092E3F]">
                    This recommendation is <strong>globally dismissed</strong>. Go to the <button onClick={() => setView('restore')} className="text-[#2A96A8] underline">Restore tab</button> to re-enable it.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#092E3F]/70">
                    Dismissed recommendations are hidden from future Calibrate runs. You can restore them at any time.
                  </p>

                  {/* Scope selector */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide">Dismissal scope</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setScope('global')}
                        className={`flex flex-col items-start p-3 rounded-[8px] border-2 transition-all ${
                          scope === 'global'
                            ? 'border-[#092E3F] bg-[#092E3F]/5'
                            : 'border-[#e5f2f4] hover:border-[#2A96A8]/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="w-3.5 h-3.5 text-[#092E3F]" />
                          <span className="text-xs font-medium text-[#092E3F]">All tenants</span>
                        </div>
                        <p className="text-[10px] text-[#6b828c] text-left">Removes recommendation globally for all clients</p>
                      </button>
                      <button
                        onClick={() => setScope('per-tenant')}
                        disabled={tenants.length === 0}
                        className={`flex flex-col items-start p-3 rounded-[8px] border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          scope === 'per-tenant'
                            ? 'border-[#092E3F] bg-[#092E3F]/5'
                            : 'border-[#e5f2f4] hover:border-[#2A96A8]/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-3.5 h-3.5 text-[#092E3F]" />
                          <span className="text-xs font-medium text-[#092E3F]">Specific tenants</span>
                        </div>
                        <p className="text-[10px] text-[#6b828c] text-left">Dismiss for selected clients only</p>
                      </button>
                    </div>
                  </div>

                  {/* Tenant picker */}
                  {scope === 'per-tenant' && tenants.length > 0 && (
                    <div className="rounded-[8px] border border-[#e5f2f4] overflow-hidden">
                      <button
                        onClick={() => setTenantsExpanded(e => !e)}
                        className="w-full px-4 py-2.5 flex items-center justify-between bg-[#f6f6f6] hover:bg-[#eef7f8] transition-colors"
                      >
                        <span className="text-[11px] font-medium text-[#092E3F]">
                          Select tenants
                          {selectedTenants.length > 0 && (
                            <span className="ml-2 text-[#2A96A8]">{selectedTenants.length} selected</span>
                          )}
                        </span>
                        {tenantsExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#6b828c]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />}
                      </button>
                      {tenantsExpanded && (
                        <div className="p-3 space-y-1">
                          <div className="flex gap-2 mb-2">
                            <button
                              onClick={() => setSelectedTenants(activeTenants)}
                              className="text-[10px] text-[#2A96A8] hover:underline"
                            >
                              Select all
                            </button>
                            <span className="text-[#d6d6d6]">·</span>
                            <button
                              onClick={() => setSelectedTenants([])}
                              className="text-[10px] text-[#6b828c] hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                          {tenants.map(tenant => {
                            const alreadyDismissed = alreadyDismissedTenants.includes(tenant);
                            return (
                              <label
                                key={tenant}
                                className={`flex items-center gap-3 px-2 py-1.5 rounded-[8px] transition-colors ${
                                  alreadyDismissed
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:bg-[#f6f6f6] cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTenants.includes(tenant)}
                                  disabled={alreadyDismissed}
                                  onChange={() => !alreadyDismissed && toggleTenant(tenant)}
                                  className="w-3.5 h-3.5 rounded-[8px] border-gray-300 text-[#2A96A8] accent-[#2A96A8]"
                                />
                                <span className="text-xs text-[#092E3F] flex-1">{tenant}</span>
                                {alreadyDismissed && (
                                  <span className="text-[9px] text-[#6b828c] font-medium">Already dismissed</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Optional reason */}
                  <div>
                    <label className="text-[11px] font-medium text-[#6b828c] uppercase tracking-wide block mb-1.5">
                      Reason <span className="normal-case font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Not applicable to this environment"
                      rows={2}
                      className="w-full px-3 py-2 text-xs bg-[#f6f6f6] border border-[#e5f2f4] rounded-[8px] text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] resize-none"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* ── RESTORE VIEW ── */}
          {view === 'restore' && (
            <>
              {!hasDismissals ? (
                <div className="text-center py-8">
                  <RotateCcw className="w-8 h-8 text-[#6b828c] mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-[#6b828c]">Nothing to restore — this recommendation is active</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#092E3F]/70">
                    Restoring will make this recommendation visible again in future Calibrate runs.
                  </p>

                  {globallyDismissed && (
                    <div className="rounded-[8px] border-2 border-[#e5f2f4] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-[#092E3F]" />
                        <div>
                          <p className="text-xs font-medium text-[#092E3F]">Global dismissal</p>
                          <p className="text-[10px] text-[#6b828c]">Dismissed for all tenants</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestore('global')}
                        className="px-3 py-1.5 bg-[#092E3F] text-white rounded-[8px] text-xs hover:bg-[#092E3F]/80 transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  )}

                  {alreadyDismissedTenants.length > 0 && (
                    <div className="rounded-[8px] border-2 border-[#e5f2f4] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-[#092E3F]" />
                          <div>
                            <p className="text-xs font-medium text-[#092E3F]">Per-tenant dismissals</p>
                            <p className="text-[10px] text-[#6b828c]">{alreadyDismissedTenants.length} tenant{alreadyDismissedTenants.length !== 1 ? 's' : ''} dismissed</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestore('per-tenant', alreadyDismissedTenants)}
                          className="px-3 py-1.5 bg-[#092E3F] text-white rounded-[8px] text-xs hover:bg-[#092E3F]/80 transition-colors"
                        >
                          Restore all
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {alreadyDismissedTenants.map(t => (
                          <div key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#f6f6f6] border border-[#e5f2f4]">
                            <span className="text-[11px] text-[#092E3F]">{t}</span>
                            <button
                              onClick={() => handleRestore('per-tenant', [t])}
                              className="text-[#6b828c] hover:text-[#2A96A8] transition-colors"
                              title={`Restore ${t}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── HISTORY VIEW ── */}
          {view === 'history' && (
            <AuditTrail entries={dismissals?.entries ?? []} />
          )}
        </div>

        {/* Footer */}
        {view === 'dismiss' && !globallyDismissed && (
          <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#6b828c] rounded-[8px] text-sm hover:text-[#092E3F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDismiss}
              disabled={!canDismiss}
              className="flex-1 py-2 bg-red-600 text-white rounded-[8px] text-sm hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <BellOff className="w-4 h-4" />
              {scope === 'global'
                ? 'Dismiss for all tenants'
                : `Dismiss for ${selectedTenants.length} tenant${selectedTenants.length !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
