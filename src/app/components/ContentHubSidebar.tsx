import { useState } from 'react';
import { X, Package, CheckCircle, Loader2, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Zap, Users } from 'lucide-react';
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
  onEnabled?: () => void;
}

type PackageStatus = 'pending' | 'installing' | 'installed';

const INSTALL_DURATION_MS = 2200;

// Which clients have log source connectors active (separate from package installation)
const CLIENT_LOG_SOURCE_STATUS = [
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

export default function ContentHubSidebar({ rule, onClose, onEnabled }: ContentHubSidebarProps) {
  const packages = rule.requiredPackages ?? [];

  const [statuses, setStatuses] = useState<Record<string, PackageStatus>>(
    Object.fromEntries(packages.map(p => [p.id, 'pending']))
  );
  const [expandedPackage, setExpandedPackage] = useState<string | null>(packages[0]?.id ?? null);
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const allInstalled = packages.every(p => statuses[p.id] === 'installed');
  const anyInstalling = packages.some(p => statuses[p.id] === 'installing');

  const installAll = async () => {
    if (isRunning || allInstalled) return;
    setIsRunning(true);

    for (const pkg of packages) {
      if (statuses[pkg.id] === 'installed') continue;

      setStatuses(prev => ({ ...prev, [pkg.id]: 'installing' }));
      setExpandedPackage(pkg.id);

      await new Promise(res => setTimeout(res, INSTALL_DURATION_MS));

      setStatuses(prev => ({ ...prev, [pkg.id]: 'installed' }));
      toast.success(`${pkg.name} installed`);
    }

    // Brief pause then enable the rule
    await new Promise(res => setTimeout(res, 600));
    setRuleEnabled(true);
    toast.success(`Rule enabled: ${rule.name}`);
    onEnabled?.();
    setIsRunning(false);
  };

  const statusIcon = (id: string) => {
    const s = statuses[id];
    if (s === 'installed') return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    if (s === 'installing') return <Loader2 className="w-4 h-4 text-[#2A96A8] shrink-0 animate-spin" />;
    return <Package className="w-4 h-4 text-[#6b828c] shrink-0" />;
  };

  const statusLabel = (id: string) => {
    const s = statuses[id];
    if (s === 'installed') return <span className="text-[10px] text-green-600 font-medium">Installed</span>;
    if (s === 'installing') return <span className="text-[10px] text-[#2A96A8] font-medium">Installing…</span>;
    return <span className="text-[10px] text-[#6b828c]">Pending</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
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
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Dependency explanation */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">Prerequisites required</p>
                  <p className="text-xs text-[#092E3F]/70">
                    This rule needs {packages.length} Content Hub solution{packages.length !== 1 ? 's' : ''} installed to the Sentinel Workspace before it can be enabled. Installing them takes just a moment.
                  </p>
                </div>
              </div>
            </div>

            {/* Progress overview */}
            <div className="flex items-center gap-2">
              {packages.map((pkg, i) => (
                <div key={pkg.id} className="flex items-center gap-2 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    statuses[pkg.id] === 'installed' ? 'bg-green-400' :
                    statuses[pkg.id] === 'installing' ? 'bg-[#2A96A8] animate-pulse' :
                    'bg-[#e5f2f4]'
                  }`} />
                  {i < packages.length - 1 && (
                    <div className="w-1 h-1 rounded-full bg-[#d6d6d6] shrink-0" />
                  )}
                </div>
              ))}
              <span className="text-xs text-[#6b828c] shrink-0 ml-1">
                {packages.filter(p => statuses[p.id] === 'installed').length}/{packages.length}
              </span>
            </div>

            {/* Package list */}
            <div className="space-y-2">
              {packages.map((pkg) => {
                const isExpanded = expandedPackage === pkg.id;
                const status = statuses[pkg.id];

                return (
                  <div
                    key={pkg.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      status === 'installed' ? 'border-green-200 bg-green-50/40' :
                      status === 'installing' ? 'border-[#2A96A8] bg-[#e5f2f4]/50' :
                      'border-[#e5f2f4] bg-white'
                    }`}
                  >
                    {/* Package header row */}
                    <button
                      className="w-full px-4 py-3 flex items-center gap-3 text-left"
                      onClick={() => setExpandedPackage(isExpanded ? null : pkg.id)}
                    >
                      {statusIcon(pkg.id)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#092E3F] truncate">{pkg.name}</span>
                          {statusLabel(pkg.id)}
                        </div>
                        <span className="text-[10px] text-[#6b828c]">{pkg.publisher} · v{pkg.version}</span>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-[#6b828c] shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-[#6b828c] shrink-0" />
                      }
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[#e5f2f4]">
                        <p className="text-xs text-[#092E3F]/70 pt-3">{pkg.description}</p>

                        <div>
                          <p className="text-[10px] font-medium text-[#6b828c] uppercase mb-1.5">Provides log sources</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.logSourcesProvided.map(ls => (
                              <span key={ls} className="px-2 py-0.5 bg-[#e5f2f4] text-[#2A96A8] text-[10px] rounded-full font-medium">
                                {ls}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#6b828c]">
                          <span>{(pkg.sizeKb / 1024).toFixed(1)} MB</span>
                          <button className="flex items-center gap-1 hover:text-[#2A96A8] transition-colors">
                            <ExternalLink className="w-3 h-3" />
                            View in Content Hub
                          </button>
                        </div>

                        {/* Installing progress bar */}
                        {status === 'installing' && (
                          <div className="pt-1">
                            <div className="h-1 bg-[#e5f2f4] rounded-full overflow-hidden">
                              <div className="h-full bg-[#2A96A8] rounded-full animate-[grow_2.2s_ease-in-out_forwards]" style={{
                                animation: `progress-fill ${INSTALL_DURATION_MS}ms ease-in-out forwards`
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Client Impact Preview */}
            <div className="rounded-xl border border-[#e5f2f4] overflow-hidden">
              <div className="px-4 py-3 bg-[#f6f6f6] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2A96A8]" />
                <p className="text-sm font-medium text-[#092E3F]">Client Impact After Installation</p>
              </div>
              <div className="px-4 pb-4 pt-3 space-y-3">
                <p className="text-xs text-[#6b828c]">
                  Installing the packages enables the rule globally. Clients with active log source connectors will fire alerts immediately; others will activate automatically once their connectors are set up.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-medium text-green-800">Alerts immediately</span>
                    </div>
                    <p className="text-lg font-bold text-[#092E3F] mb-1">{CLIENT_LOG_SOURCE_STATUS.filter(c => c.hasLogSource).length}</p>
                    <div className="flex flex-wrap gap-1">
                      {CLIENT_LOG_SOURCE_STATUS.filter(c => c.hasLogSource).map(c => (
                        <span key={c.name} className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">{c.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#f6f6f6] border border-[#e5f2f4] rounded-lg p-3 opacity-60">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-[#6b828c]" />
                      <span className="text-xs font-medium text-[#6b828c]">Pending connector</span>
                    </div>
                    <p className="text-lg font-bold text-[#092E3F] mb-1">{CLIENT_LOG_SOURCE_STATUS.filter(c => !c.hasLogSource).length}</p>
                    <div className="flex flex-wrap gap-1">
                      {CLIENT_LOG_SOURCE_STATUS.filter(c => !c.hasLogSource).map(c => (
                        <span key={c.name} className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full">{c.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rule that will be enabled */}
            <div className={`rounded-xl border-2 p-4 transition-all ${
              ruleEnabled ? 'border-green-300 bg-green-50' : 'border-dashed border-[#d6d6d6] bg-[#f6f6f6]'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  ruleEnabled ? 'bg-green-500' : 'bg-[#e5f2f4]'
                }`}>
                  {ruleEnabled
                    ? <CheckCircle className="w-4 h-4 text-white" />
                    : <Zap className="w-4 h-4 text-[#6b828c]" />
                  }
                </div>
                <div>
                  <p className={`text-sm font-medium ${ruleEnabled ? 'text-green-800' : 'text-[#6b828c]'}`}>
                    {ruleEnabled ? 'Rule Enabled' : 'Rule will be enabled after installation'}
                  </p>
                  <p className="text-[10px] text-[#6b828c] mt-0.5 truncate max-w-[340px]">{rule.name}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          {ruleEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">All done — rule is now enabled</span>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#6b828c] rounded text-sm hover:text-[#092E3F] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={installAll}
                disabled={isRunning || allInstalled}
                className="px-6 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {anyInstalling && <Loader2 className="w-4 h-4 animate-spin" />}
                {anyInstalling ? 'Installing…' : allInstalled ? 'Installed' : `Install ${packages.length > 1 ? 'All & ' : '& '}Enable Rule`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
