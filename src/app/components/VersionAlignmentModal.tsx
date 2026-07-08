import { useState } from 'react';
import { X, GitBranch, AlertCircle, Users, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface AlertRule {
  id: string;
  name: string;
  author: 'Microsoft' | 'Seculyze' | 'Custom';
  version: string;
}

interface VersionInfo {
  version: string;
  releaseDate: string;
  clientsUsing: number;
  clientNames: string[];
  isNewest: boolean;
  changes: string[];
  kql: string;
}

interface VersionAlignmentModalProps {
  rule: AlertRule;
  baselineTenant?: string;
  onClose: () => void;
  onBack?: () => void;
  onAlign?: (selectedVersion: string) => void;
}

const previous: VersionInfo = {
  version: '2.0.0',
  releaseDate: '2026-04-10',
  clientsUsing: 4,
  clientNames: ['Netflix', 'Spotify', 'Adobe', 'Oracle'],
  isNewest: false,
  changes: [
    'Major performance improvements',
    'Updated MITRE ATT&CK mappings',
    'Enhanced query optimization',
  ],
  kql: `SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count()
    by Account, Computer
| where FailedAttempts > 5`,
};

const newest: VersionInfo = {
  version: '2.0.1',
  releaseDate: '2026-05-15',
  clientsUsing: 11,
  clientNames: ['Nike', 'Adidas', 'Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Meta', 'SAP', 'Salesforce', 'IBM'],
  isNewest: true,
  changes: [
    'Improved detection accuracy by 15%',
    'Reduced false positive rate',
    'Added support for new log source types',
  ],
  kql: `SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count()
    by Account, Computer, IpAddress
| where FailedAttempts > 3
| project TimeGenerated, Account,
    Computer, IpAddress, FailedAttempts`,
};

export default function VersionAlignmentModal({
  rule,
  baselineTenant,
  onClose,
  onBack,
  onAlign,
}: VersionAlignmentModalProps) {
  // The baseline tenant's version is the recommended target — preselect it
  const baselineSide: 'previous' | 'newest' = baselineTenant && previous.clientNames.includes(baselineTenant)
    ? 'previous'
    : 'newest';
  const [selected, setSelected] = useState<'previous' | 'newest'>(baselineSide);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const selectedVersion = selected === 'newest' ? newest : previous;
  const otherVersion = selected === 'newest' ? previous : newest;
  const clientsToUpdate = otherVersion.clientsUsing;
  const total = previous.clientsUsing + newest.clientsUsing;

  const handleAlign = () => {
    onAlign?.(selectedVersion.version);
    toast.success(
      `Aligned ${clientsToUpdate} client${clientsToUpdate !== 1 ? 's' : ''} to version ${selectedVersion.version}`
    );
    onClose();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const VersionColumn = ({ info, side }: { info: VersionInfo; side: 'previous' | 'newest' }) => {
    const isSelected = selected === side;
    return (
      <div
        onClick={() => setSelected(side)}
        className={`flex flex-col rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
          isSelected ? 'border-[#2A96A8]' : 'border-[#e5f2f4] hover:border-[#2A96A8]/40'
        }`}
      >
        {/* Column header — selectable */}
        <div className={`px-3 py-3 shrink-0 ${isSelected ? 'bg-[#e5f2f4]' : 'bg-[#f6f6f6]'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <GitBranch className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#2A96A8]' : 'text-[#6b828c]'}`} />
              <span className="text-sm font-bold text-[#092E3F]">v{info.version}</span>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              isSelected ? 'border-[#2A96A8] bg-[#2A96A8]' : 'border-[#d6d6d6] bg-white'
            }`}>
              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
            </div>
          </div>

          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            {info.isNewest ? (
              <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium">
                Latest
              </span>
            ) : (
              <span className="inline-block px-1.5 py-0.5 bg-[#d6d6d6] text-[#6b828c] text-[10px] rounded font-medium">
                Previous
              </span>
            )}
            {baselineTenant && info.clientNames.includes(baselineTenant) && (
              <span className="inline-block px-1.5 py-0.5 bg-[#092E3F] text-white text-[10px] rounded font-medium">
                Baseline
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-[#6b828c]">
            <Users className="w-3 h-3 shrink-0" />
            <span>{info.clientsUsing} tenant{info.clientsUsing !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-[10px] text-[#6b828c] mt-0.5">{formatDate(info.releaseDate)}</p>
        </div>

        {/* Scrollable tenant list */}
        <div className="flex-1 overflow-y-auto bg-white divide-y divide-[#f4f4f4]" style={{ maxHeight: 260 }}>
          {info.clientNames.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-[#6b828c] italic">No tenants</p>
          ) : (
            info.clientNames.map(name => (
              <div key={name} className="flex items-center gap-2 px-3 py-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${info.isNewest ? 'bg-[#2A96A8]' : 'bg-[#d6d6d6]'}`} />
                <span className="text-xs text-[#092E3F] truncate">{name}</span>
                {name === baselineTenant && (
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#092E3F] text-white text-[9px] font-semibold uppercase tracking-wide shrink-0">Baseline</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
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
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Version Misalignment</p>
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
          <div className="px-6 py-5 space-y-4">

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-0.5">Version Misalignment Detected</p>
                  <p className="text-xs text-[#092E3F]/70">
                    {total} tenants are split across two versions.
                    {baselineTenant
                      ? ` We recommend v${baselineSide === 'previous' ? previous.version : newest.version} — your baseline tenant (${baselineTenant}) runs it.`
                      : ' Select a column to choose the target version, then confirm.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Label */}
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide">
              Select target version — click a column to pick
            </p>

            {/* Two-column version split */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <VersionColumn info={previous} side="previous" />
              <VersionColumn info={newest} side="newest" />
            </div>

            {/* Changelog toggle */}
            <button
              onClick={() => setChangelogOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f6f6f6] border border-[#e5f2f4] hover:bg-[#eef7f8] transition-colors"
            >
              <span className="text-[11px] font-medium text-[#092E3F]">
                What changed in v{selectedVersion.version}?
              </span>
              {changelogOpen
                ? <ChevronUp className="w-3.5 h-3.5 text-[#6b828c]" />
                : <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />
              }
            </button>

            {changelogOpen && (
              <div className="space-y-3 -mt-1">
                <ul className="space-y-1.5 px-1">
                  {selectedVersion.changes.map((change, i) => (
                    <li key={i} className="text-xs text-[#092E3F]/70 flex items-start gap-2">
                      <span className="text-[#2A96A8] mt-0.5 shrink-0">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-[10px] text-green-400 font-mono leading-relaxed">{selectedVersion.kql}</pre>
                </div>
              </div>
            )}

            {/* Impact summary */}
            <div className="bg-[#e5f2f4] rounded-xl p-4">
              <p className="text-xs text-[#092E3F]">
                Aligning to <span className="font-semibold">v{selectedVersion.version}</span> will update{' '}
                <span className="font-semibold">{clientsToUpdate} tenant{clientsToUpdate !== 1 ? 's' : ''}</span>{' '}
                currently on v{otherVersion.version}. All {total} tenants will then run the same version.
              </p>
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
              onClick={handleAlign}
              className="flex-1 py-2 bg-[#092e3f] text-white rounded-xl text-sm hover:bg-[#092e3f]/90 transition-colors font-medium"
            >
              Align all to v{selectedVersion.version}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
