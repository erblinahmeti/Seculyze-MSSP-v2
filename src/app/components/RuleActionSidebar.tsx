import { useState } from 'react';
import {
  X, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, Code2, Users,
  TrendingUp, BellOff, ArrowUpCircle, Loader2,
} from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  author: 'Microsoft' | 'Seculyze' | 'Custom';
  version: string;
  mitre: string[];
  logSources: string[];
  value: 'High' | 'Medium' | 'Low';
  state: 'Enabled' | 'Disabled';
  clientsApplied: number;
  clientNames?: string[];
  action: 'Enable' | 'Disable' | 'Update' | string;
  kqlQuery?: string;
}

interface RuleActionSidebarProps {
  rule: AlertRule;
  baselineTenant?: string;
  onClose: () => void;
  onBack?: () => void;
  onConfirm: () => void;
}

// Bump minor version for the mock "latest available" version
export function getLatestVersion(version: string): string {
  const parts = version.split('.').map(n => parseInt(n, 10) || 0);
  return `${parts[0]}.${(parts[1] ?? 0) + 1}.0`;
}

const UPDATE_CHANGES = [
  'Improved detection accuracy and lower false-positive rate',
  'Updated MITRE ATT&CK technique mappings',
  'Query performance optimisations for large workspaces',
];

export default function RuleActionSidebar({ rule, baselineTenant, onClose, onBack, onConfirm }: RuleActionSidebarProps) {
  const [kqlOpen, setKqlOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const actionType = rule.action as 'Enable' | 'Disable' | 'Update';
  const latestVersion = getLatestVersion(rule.version);
  const tenants = rule.clientNames ?? [];

  const meta = {
    Enable: {
      eyebrow: 'Enable Rule',
      icon: <TrendingUp className="w-4 h-4 text-[#1e7d8f] shrink-0 mt-0.5" />,
      bannerClass: 'bg-[#e5f2f4] border-[#c9e2e6]',
      bannerTitle: 'High-value rule is currently disabled',
      bannerText: `This rule is rated ${rule.value} value but is disabled. Enabling it strengthens detection coverage across your tenants.`,
      cta: 'Enable Rule',
    },
    Disable: {
      eyebrow: 'Disable Rule',
      icon: <BellOff className="w-4 h-4 text-[#5c707a] shrink-0 mt-0.5" />,
      bannerClass: 'bg-[#eef1f3] border-[#dde4e8]',
      bannerTitle: 'Low-value rule is generating noise',
      bannerText: 'This rule is rated Low value but is enabled, producing alerts with little detection return. Disabling it reduces alert fatigue for your analysts.',
      cta: 'Disable Rule',
    },
    Update: {
      eyebrow: 'Update Rule',
      icon: <ArrowUpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      bannerClass: 'bg-amber-50 border-amber-200',
      bannerTitle: 'A newer version is available',
      bannerText: `This rule is running v${rule.version} while v${latestVersion} is available. Updating applies the latest detection logic to all tenants.`,
      cta: `Update to v${latestVersion}`,
    },
  }[actionType];

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    await new Promise(res => setTimeout(res, 900));
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
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
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">{meta.eyebrow}</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Recommendation banner */}
            <div className={`border rounded-xl p-4 ${meta.bannerClass}`}>
              <div className="flex items-start gap-3">
                {meta.icon}
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">{meta.bannerTitle}</p>
                  <p className="text-xs text-[#092E3F]/70">{meta.bannerText}</p>
                </div>
              </div>
            </div>

            {/* Version comparison — update only */}
            {actionType === 'Update' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-[#092E3F] rounded-xl">
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-white/50 uppercase tracking-wide mb-1">Current version</p>
                    <span className="inline-block px-3 py-1 rounded-[4px] text-xs font-bold bg-gray-400/20 text-gray-300">
                      v{rule.version}
                    </span>
                  </div>
                  <div className="text-white/40 text-lg">→</div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-white/50 uppercase tracking-wide mb-1">Latest version</p>
                    <span className="inline-block px-3 py-1 rounded-[4px] text-xs font-bold bg-[#76ba3b]/30 text-[#76ba3b] ring-2 ring-[#76ba3b]/50">
                      v{latestVersion}
                    </span>
                  </div>
                </div>
                <div className="bg-[#f6f6f6] rounded-xl p-4">
                  <p className="text-[10px] font-medium text-[#6b828c] uppercase tracking-wide mb-2">What's new in v{latestVersion}</p>
                  <ul className="space-y-1.5">
                    {UPDATE_CHANGES.map((change, i) => (
                      <li key={i} className="text-xs text-[#092E3F]/70 flex items-start gap-2">
                        <span className="text-[#2A96A8] mt-0.5 shrink-0">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Description */}
            {rule.description && (
              <div>
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Description</p>
                <p className="text-xs text-[#092E3F]/70 leading-relaxed">{rule.description}</p>
              </div>
            )}

            {/* Rule summary */}
            <div className="bg-[#f6f6f6] rounded-xl p-4 border-l-2 border-[#6b828c]">
              <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-3">Current Settings</p>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-[#6b828c] mb-1">State</p>
                  <p className="text-[#092E3F] font-medium">{rule.state}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">Value</p>
                  <p className="text-[#092E3F] font-medium">{rule.value}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">Version</p>
                  <p className="text-[#092E3F] font-medium">{rule.version}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">Author</p>
                  <p className="text-[#092E3F] font-medium">{rule.author}</p>
                </div>
              </div>
            </div>

            {/* MITRE & log sources */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">MITRE ATT&CK</p>
                <div className="flex flex-wrap gap-1.5">
                  {rule.mitre.map(m => (
                    <span key={m} className="px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-blue-50 text-blue-600">{m}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Log Sources</p>
                <div className="flex flex-wrap gap-1.5">
                  {rule.logSources.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-emerald-50 text-emerald-600">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Affected tenants */}
            {tenants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#2A96A8]" />
                    Affected Tenants
                  </p>
                  <span className="text-[10px] text-[#6b828c]">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="rounded-xl border border-[#e5f2f4] divide-y divide-[#f4f4f4] overflow-y-auto" style={{ maxHeight: 180 }}>
                  {tenants.map(name => (
                    <div key={name} className="flex items-center gap-2 px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2A96A8] shrink-0" />
                      <span className="text-xs text-[#092E3F]">{name}</span>
                      {name === baselineTenant && (
                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[#092E3F] text-white text-[9px] font-semibold uppercase tracking-wide">Baseline</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KQL preview */}
            {rule.kqlQuery && (
              <div className="rounded-xl border border-[#e5f2f4] overflow-hidden">
                <button
                  onClick={() => setKqlOpen(o => !o)}
                  className="w-full px-4 py-2.5 flex items-center justify-between bg-[#f6f6f6] hover:bg-[#eef7f8] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-[#2A96A8]" />
                    <span className="text-[11px] font-medium text-[#092E3F]">KQL Query</span>
                  </div>
                  {kqlOpen ? <ChevronUp className="w-3.5 h-3.5 text-[#6b828c]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />}
                </button>
                {kqlOpen && (
                  <div className="bg-[#092E3F] px-4 py-3 overflow-x-auto">
                    <pre className="text-[11px] font-mono leading-5 text-[#c8e6ea]">{rule.kqlQuery}</pre>
                  </div>
                )}
              </div>
            )}

            {/* What happens next */}
            <div className="bg-[#f6f6f6] rounded-xl p-4">
              <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2.5">What happens when you confirm</p>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#2A96A8] shrink-0 mt-0.5" />
                <p className="text-xs text-[#092E3F]/70">
                  {actionType === 'Enable' && `The rule is enabled across ${tenants.length > 0 ? `all ${tenants.length} tenants` : 'your tenants'} and starts generating alerts immediately.`}
                  {actionType === 'Disable' && `The rule is disabled across ${tenants.length > 0 ? `all ${tenants.length} tenants` : 'your tenants'}. Existing alerts are kept, but no new alerts will be generated.`}
                  {actionType === 'Update' && `All ${tenants.length > 0 ? tenants.length : ''} tenants are updated to v${latestVersion}. The rule keeps its current state and value settings.`}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#6b828c] text-sm hover:text-[#092E3F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirming
                ? (actionType === 'Update' ? 'Updating…' : actionType === 'Enable' ? 'Enabling…' : 'Disabling…')
                : meta.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
