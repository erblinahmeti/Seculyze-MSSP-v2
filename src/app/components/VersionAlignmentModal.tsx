import { useState } from 'react';
import { X, GitBranch, AlertCircle, ArrowRight, Clock, Users } from 'lucide-react';
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
  onClose: () => void;
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
  onClose,
  onAlign,
}: VersionAlignmentModalProps) {
  const [selected, setSelected] = useState<'previous' | 'newest'>('newest');

  const selectedVersion = selected === 'newest' ? newest : previous;
  const otherVersion = selected === 'newest' ? previous : newest;
  const clientsToUpdate = otherVersion.clientsUsing;

  const handleAlign = () => {
    onAlign?.(selectedVersion.version);
    toast.success(
      `Aligned ${clientsToUpdate} client${clientsToUpdate !== 1 ? 's' : ''} to version ${selectedVersion.version}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
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
          <div className="px-6 py-5 space-y-5">

            {/* Warning banner */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">Version Misalignment Detected</p>
                  <p className="text-xs text-[#092E3F]/70">
                    Clients are split across two versions. Select which version to align all {previous.clientsUsing + newest.clientsUsing} clients to.
                  </p>
                </div>
              </div>
            </div>

            {/* Version picker label */}
            <p className="text-xs font-light text-[#092E3F] uppercase">Select version to align to</p>

            {/* Two version cards */}
            <div className="space-y-3">
              {/* Previous version */}
              <button
                onClick={() => setSelected('previous')}
                className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${
                  selected === 'previous'
                    ? 'border-[#2A96A8]'
                    : 'border-[#e5f2f4] hover:border-[#2A96A8]/40'
                }`}
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  selected === 'previous' ? 'bg-[#e5f2f4]' : 'bg-[#f6f6f6]'
                }`}>
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#6b828c]" />
                    <span className="text-sm font-semibold text-[#092E3F]">v{previous.version}</span>
                    <span className="px-2 py-0.5 bg-[#d6d6d6] text-[#6b828c] text-[10px] rounded-full font-medium">
                      Previous
                    </span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected === 'previous' ? 'border-[#2A96A8] bg-[#2A96A8]' : 'border-[#d6d6d6] bg-white'
                  }`}>
                    {selected === 'previous' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 bg-white space-y-3">
                  <div className="flex items-center gap-4 text-xs text-[#6b828c]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(previous.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{previous.clientsUsing} client{previous.clientsUsing !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {previous.clientNames.map((name) => (
                      <span key={name} className="px-2 py-0.5 bg-[#f6f6f6] text-[#092E3F] text-[10px] rounded-full border border-[#e5f2f4]">
                        {name}
                      </span>
                    ))}
                  </div>

                  <div>
                    <p className="text-[10px] font-medium text-[#6b828c] uppercase mb-1.5">Changes</p>
                    <ul className="space-y-1">
                      {previous.changes.map((change, i) => (
                        <li key={i} className="text-xs text-[#092E3F]/70 flex items-start gap-2">
                          <span className="text-[#6b828c] mt-0.5 shrink-0">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-[10px] text-green-400 font-mono leading-relaxed">{previous.kql}</pre>
                  </div>
                </div>
              </button>

              {/* Arrow between */}
              <div className="flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-[#e5f2f4]" />
                <div className="w-7 h-7 rounded-full bg-[#e5f2f4] flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-[#2A96A8]" />
                </div>
                <div className="h-px flex-1 bg-[#e5f2f4]" />
              </div>

              {/* Newest version */}
              <button
                onClick={() => setSelected('newest')}
                className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${
                  selected === 'newest'
                    ? 'border-[#2A96A8]'
                    : 'border-[#e5f2f4] hover:border-[#2A96A8]/40'
                }`}
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  selected === 'newest' ? 'bg-[#e5f2f4]' : 'bg-[#f6f6f6]'
                }`}>
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#2A96A8]" />
                    <span className="text-sm font-semibold text-[#092E3F]">v{newest.version}</span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium">
                      Newest
                    </span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected === 'newest' ? 'border-[#2A96A8] bg-[#2A96A8]' : 'border-[#d6d6d6] bg-white'
                  }`}>
                    {selected === 'newest' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 bg-white space-y-3">
                  <div className="flex items-center gap-4 text-xs text-[#6b828c]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(newest.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{newest.clientsUsing} client{newest.clientsUsing !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {newest.clientNames.map((name) => (
                      <span key={name} className="px-2 py-0.5 bg-[#f6f6f6] text-[#092E3F] text-[10px] rounded-full border border-[#e5f2f4]">
                        {name}
                      </span>
                    ))}
                  </div>

                  <div>
                    <p className="text-[10px] font-medium text-[#6b828c] uppercase mb-1.5">Changes</p>
                    <ul className="space-y-1">
                      {newest.changes.map((change, i) => (
                        <li key={i} className="text-xs text-[#092E3F]/70 flex items-start gap-2">
                          <span className="text-[#2A96A8] mt-0.5 shrink-0">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-[10px] text-green-400 font-mono leading-relaxed">{newest.kql}</pre>
                  </div>
                </div>
              </button>
            </div>

            {/* Impact summary */}
            <div className="bg-[#e5f2f4] rounded-xl p-4">
              <p className="text-xs text-[#092E3F]">
                Aligning to <span className="font-semibold">v{selectedVersion.version}</span> will update{' '}
                <span className="font-semibold">{clientsToUpdate} client{clientsToUpdate !== 1 ? 's' : ''}</span>{' '}
                currently on v{otherVersion.version}. All {previous.clientsUsing + newest.clientsUsing} clients will then run the same version.
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-[#6b828c] rounded text-sm hover:text-[#092E3F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAlign}
              className="px-6 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors"
            >
              Align to v{selectedVersion.version}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
