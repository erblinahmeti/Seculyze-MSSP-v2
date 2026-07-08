import { useState } from 'react';
import { X, Package, CheckCircle, Loader2, ChevronDown, ChevronUp, ChevronLeft, Users, Clock, Info } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface ContentHubPackage {
  id: string;
  name: string;
  publisher: string;
  description: string;
  logSourcesProvided: string[];
  version: string;
  sizeKb: number;
}

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  logSources: string[];
  requiredPackages?: ContentHubPackage[];
}

interface ContentHubSidebarProps {
  rule: AlertRule;
  onClose: () => void;
  onBack?: () => void;
  onEnabled?: () => void;
}

type PackageStatus = 'pending' | 'installing' | 'installed';
type TenantStatus = 'pending' | 'installing' | 'enabled' | 'pending-log-source';
type Phase = 'idle' | 'packages' | 'tenants' | 'done';

const PACKAGE_INSTALL_MS = 1500;
const TENANT_INSTALL_MS = 1100;

const TENANTS = [
  { name: 'Nike',       hasLogSource: true },
  { name: 'Adidas',     hasLogSource: true },
  { name: 'Apple',      hasLogSource: false },
  { name: 'Microsoft',  hasLogSource: true },
  { name: 'Google',     hasLogSource: true },
  { name: 'Amazon',     hasLogSource: false },
  { name: 'Tesla',      hasLogSource: true },
  { name: 'Meta',       hasLogSource: false },
  { name: 'Netflix',    hasLogSource: true },
  { name: 'Spotify',    hasLogSource: false },
  { name: 'Adobe',      hasLogSource: true },
  { name: 'Oracle',     hasLogSource: false },
  { name: 'SAP',        hasLogSource: true },
  { name: 'Salesforce', hasLogSource: true },
];

export default function ContentHubSidebar({ rule, onClose, onBack, onEnabled }: ContentHubSidebarProps) {
  const packages = rule.requiredPackages ?? [];

  const [phase, setPhase] = useState<Phase>('idle');
  const [pkgStatuses, setPkgStatuses] = useState<Record<string, PackageStatus>>(
    Object.fromEntries(packages.map(p => [p.id, 'pending']))
  );
  const [tenantStatuses, setTenantStatuses] = useState<Record<string, TenantStatus>>(
    Object.fromEntries(TENANTS.map(t => [t.name, 'pending']))
  );
  const [packagesExpanded, setPackagesExpanded] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const readyCount = TENANTS.filter(t => t.hasLogSource).length;
  const pendingCount = TENANTS.filter(t => !t.hasLogSource).length;
  const deployedCount = Object.values(tenantStatuses).filter(s => s !== 'pending').length;

  const phaseOrder: Phase[] = ['idle', 'packages', 'tenants', 'done'];
  const currentPhaseIdx = phaseOrder.indexOf(phase);

  const installAll = async () => {
    if (isRunning || phase === 'done') return;
    setIsRunning(true);
    setPackagesExpanded(true);

    // Phase 1: Install packages globally
    setPhase('packages');
    for (const pkg of packages) {
      setPkgStatuses(prev => ({ ...prev, [pkg.id]: 'installing' }));
      await new Promise(res => setTimeout(res, PACKAGE_INSTALL_MS));
      setPkgStatuses(prev => ({ ...prev, [pkg.id]: 'installed' }));
      toast.success(`${pkg.name} installed`);
    }

    await new Promise(res => setTimeout(res, 400));
    setPackagesExpanded(false);

    // Phase 2: Deploy to each tenant one by one
    setPhase('tenants');
    for (const tenant of TENANTS) {
      setTenantStatuses(prev => ({ ...prev, [tenant.name]: 'installing' }));
      await new Promise(res => setTimeout(res, TENANT_INSTALL_MS));
      setTenantStatuses(prev => ({
        ...prev,
        [tenant.name]: tenant.hasLogSource ? 'enabled' : 'pending-log-source',
      }));
    }

    setPhase('done');
    setIsRunning(false);
    toast.success(`${readyCount} tenants enabled, ${pendingCount} pending log sources`);
    onEnabled?.();
  };

  const renderStepDot = (stepPhase: Phase, label: string) => {
    const stepIdx = phaseOrder.indexOf(stepPhase);
    const isActive = currentPhaseIdx === stepIdx;
    const isDone = currentPhaseIdx > stepIdx;
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
          isDone ? 'bg-green-500' : isActive ? 'bg-[#2A96A8]' : 'bg-white/20'
        }`}>
          {isDone
            ? <CheckCircle className="w-3 h-3 text-white" />
            : <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-white/30'}`} />
          }
        </div>
        <span className={`text-[11px] font-medium ${
          isDone ? 'text-green-400' : isActive ? 'text-white' : 'text-white/40'
        }`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <style>{`@keyframes progress-fill { from { width: 0% } to { width: 100% } }`}</style>
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors mb-1.5 -ml-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Rule Overview
                </button>
              )}
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Install & Enable</p>
              <h2 className="text-white text-base font-semibold leading-snug">{rule.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Phase indicator */}
          <div className="mt-4 flex items-center gap-2">
            {renderStepDot('packages', 'Packages')}
            <div className="flex-1 h-px bg-white/20" />
            {renderStepDot('tenants', 'Tenants')}
            <div className="flex-1 h-px bg-white/20" />
            {renderStepDot('done', 'Done')}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Idle info banner */}
            {phase === 'idle' && (
              <div className="bg-[#e5f2f4] border border-[#c9e2e6] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#2A96A8] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#092E3F]/80">
                    <span className="font-medium text-[#092E3F]">{packages.length} package{packages.length !== 1 ? 's' : ''}</span> will be installed first, then the rule deploys to each of your {TENANTS.length} tenants. Tenants without an active log source are installed too — they simply turn on by themselves once their connector goes live.
                  </p>
                </div>
              </div>
            )}

            {/* Packages section */}
            <div>
              <button
                className="w-full flex items-center justify-between mb-2"
                onClick={() => setPackagesExpanded(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#092E3F] uppercase tracking-wide">Packages</span>
                  {(phase === 'tenants' || phase === 'done') && (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                      <CheckCircle className="w-3 h-3" />
                      {packages.length} installed
                    </span>
                  )}
                </div>
                {packagesExpanded
                  ? <ChevronUp className="w-4 h-4 text-[#6b828c]" />
                  : <ChevronDown className="w-4 h-4 text-[#6b828c]" />
                }
              </button>

              {packagesExpanded && (
                <div className="space-y-2">
                  {packages.map(pkg => {
                    const s = pkgStatuses[pkg.id];
                    return (
                      <div key={pkg.id} className={`rounded-xl border-2 p-3 transition-all ${
                        s === 'installed' ? 'border-green-200 bg-green-50/50' :
                        s === 'installing' ? 'border-[#2A96A8] bg-[#e5f2f4]/50' :
                        'border-[#e5f2f4] bg-white'
                      }`}>
                        <div className="flex items-center gap-3">
                          {s === 'installed'
                            ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            : s === 'installing'
                              ? <Loader2 className="w-4 h-4 text-[#2A96A8] shrink-0 animate-spin" />
                              : <Package className="w-4 h-4 text-[#6b828c] shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#092E3F] truncate">{pkg.name}</span>
                              {s === 'installed' && <span className="text-[10px] text-green-600 font-medium shrink-0">Installed</span>}
                              {s === 'installing' && <span className="text-[10px] text-[#2A96A8] font-medium shrink-0">Installing…</span>}
                            </div>
                            <span className="text-[10px] text-[#6b828c]">{pkg.publisher} · v{pkg.version}</span>
                          </div>
                        </div>
                        {s === 'installing' && (
                          <div className="mt-2 h-1 bg-[#e5f2f4] rounded-full overflow-hidden">
                            <div className="h-full bg-[#2A96A8] rounded-full" style={{
                              animation: `progress-fill ${PACKAGE_INSTALL_MS}ms ease-in-out forwards`
                            }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tenant section header */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#e5f2f4]" />
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#6b828c]" />
                <span className="text-[10px] text-[#6b828c] uppercase tracking-widest">
                  Tenants
                  {phase !== 'idle'
                    ? ` · ${deployedCount}/${TENANTS.length}`
                    : ` · ${TENANTS.length}`
                  }
                </span>
              </div>
              <div className="h-px flex-1 bg-[#e5f2f4]" />
            </div>

            {/* Tenant list */}
            <div className={`space-y-1.5 ${phase === 'idle' ? 'opacity-50' : ''}`}>
              {TENANTS.map(tenant => {
                const s = tenantStatuses[tenant.name];
                return (
                  <div key={tenant.name} className={`rounded-lg border px-3 py-2.5 transition-all ${
                    s === 'enabled' ? 'border-green-200 bg-green-50/40' :
                    s === 'pending-log-source' ? 'border-[#dbe3e6] bg-[#f4f7f8]' :
                    s === 'installing' ? 'border-[#2A96A8] bg-[#e5f2f4]/30' :
                    'border-[#e5f2f4] bg-[#f6f6f6]'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {s === 'enabled'
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : s === 'installing'
                            ? <Loader2 className="w-3.5 h-3.5 text-[#2A96A8] shrink-0 animate-spin" />
                            : s === 'pending-log-source'
                              ? <Clock className="w-3.5 h-3.5 text-[#6b828c] shrink-0" />
                              : <div className="w-3.5 h-3.5 rounded-full border-2 border-[#d6d6d6] shrink-0" />
                        }
                        <span className="text-sm font-medium text-[#092E3F] truncate">{tenant.name}</span>
                        {!tenant.hasLogSource && phase === 'idle' && (
                          <span className="text-[9px] text-[#5c707a] bg-[#eef1f3] border border-[#dbe3e6] px-1.5 py-0.5 rounded-full shrink-0">
                            No log source yet
                          </span>
                        )}
                      </div>
                      {s === 'enabled' && (
                        <span className="text-[10px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">Enabled</span>
                      )}
                      {s === 'installing' && (
                        <span className="text-[10px] font-medium text-[#2A96A8] shrink-0">Installing…</span>
                      )}
                      {s === 'pending-log-source' && (
                        <span className="text-[10px] font-medium text-[#5c707a] bg-[#eef1f3] px-2 py-0.5 rounded-full shrink-0">Enables with log source</span>
                      )}
                    </div>
                    {s === 'installing' && (
                      <div className="mt-2 h-1 bg-[#e5f2f4] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2A96A8] rounded-full" style={{
                          animation: `progress-fill ${TENANT_INSTALL_MS}ms ease-in-out forwards`
                        }} />
                      </div>
                    )}
                    {s === 'pending-log-source' && (
                      <p className="mt-1 text-[10px] text-[#6b828c] leading-relaxed">
                        Installed and ready — no action needed. Turns on automatically once the log source is connected.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Done summary */}
            {phase === 'done' && (
              <div className="rounded-xl border border-[#e5f2f4] bg-[#f6f6f6] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-sm font-semibold text-[#092E3F]">Deployment complete</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#092E3F]">{readyCount}</p>
                    <p className="text-xs text-green-700 mt-0.5">Enabled now</p>
                  </div>
                  <div className="bg-[#f4f7f8] border border-[#dbe3e6] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#092E3F]">{pendingCount}</p>
                    <p className="text-xs text-[#5c707a] mt-0.5">Enable with log source</p>
                  </div>
                </div>
                <p className="text-xs text-[#6b828c]">
                  Everything is installed. The remaining tenants turn on by themselves once their log source connector is active — nothing more to do here.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          {phase === 'done' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">All done</span>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#092e3f] text-white rounded-xl text-sm hover:bg-[#092e3f]/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#6b828c] text-sm hover:text-[#092E3F] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={installAll}
                disabled={isRunning}
                className="px-6 py-2 bg-[#092e3f] text-white rounded-xl text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                {phase === 'idle'
                  ? `Install & Enable · ${TENANTS.length} tenants`
                  : phase === 'packages'
                    ? 'Installing packages…'
                    : 'Deploying to tenants…'
                }
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
