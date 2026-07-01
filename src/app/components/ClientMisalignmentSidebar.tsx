import { useState } from 'react';
import { X, CheckCircle, XCircle, Users, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Client {
  name: string;
  level: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4';
  enabled: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  value: 'High' | 'Medium' | 'Low';
  state: 'Enabled' | 'Disabled';
  clientStates?: Record<string, { enabled: boolean; level: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4' }>;
}

interface ClientMisalignmentSidebarProps {
  rule: AlertRule;
  onClose: () => void;
  onAligned?: (enabledAll: boolean) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  'Level 1': 'bg-[#e5f2f4] text-[#2A96A8]',
  'Level 2': 'bg-blue-50 text-blue-600',
  'Level 3': 'bg-purple-50 text-purple-600',
  'Level 4': 'bg-amber-50 text-amber-600',
};

export default function ClientMisalignmentSidebar({ rule, onClose, onAligned }: ClientMisalignmentSidebarProps) {
  const initialClients: Client[] = Object.entries(rule.clientStates ?? {}).map(([name, data]) => ({
    name,
    level: data.level,
    enabled: data.enabled,
  }));

  const [clients, setClients] = useState<Client[]>(initialClients);

  const enabledClients = clients.filter(c => c.enabled);
  const disabledClients = clients.filter(c => !c.enabled);
  const isAligned = enabledClients.length === 0 || disabledClients.length === 0;

  const toggle = (name: string) => {
    setClients(prev => prev.map(c => c.name === name ? { ...c, enabled: !c.enabled } : c));
  };

  const alignAll = (enable: boolean) => {
    setClients(prev => prev.map(c => ({ ...c, enabled: enable })));
    const label = enable ? 'enabled' : 'disabled';
    toast.success(`All ${clients.length} clients ${label} for: ${rule.name}`);
    onAligned?.(enable);
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
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Client Misalignment</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Recommended alignment direction */}
            {(() => {
              const majority = enabledClients.length >= disabledClients.length ? 'enabled' : 'disabled';
              const minorityCount = majority === 'enabled' ? disabledClients.length : enabledClients.length;
              const majorityCount = majority === 'enabled' ? enabledClients.length : disabledClients.length;
              return (
                <div className={`rounded-xl p-4 border ${majority === 'enabled' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${majority === 'enabled' ? 'bg-green-100' : 'bg-gray-200'}`}>
                      <ArrowRight className={`w-4 h-4 ${majority === 'enabled' ? 'text-green-700' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#092E3F] mb-0.5">
                        Recommended: <span className={majority === 'enabled' ? 'text-green-700' : 'text-gray-600'}>
                          {majority === 'enabled' ? 'Enable All' : 'Disable All'}
                        </span>
                      </p>
                      <p className="text-xs text-[#092E3F]/70">
                        {majorityCount} of {clients.length} clients have this rule {majority}. Align the remaining {minorityCount} to match.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Warning banner */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">Clients are out of sync</p>
                  <p className="text-xs text-[#092E3F]/70">
                    Use the toggles below to adjust individual clients, or use the footer buttons to align all at once.
                  </p>
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium uppercase tracking-wide">Enabled</span>
                </div>
                <p className="text-2xl font-bold text-[#092E3F]">{enabledClients.length}</p>
                <p className="text-[10px] text-green-600 mt-1">
                  {enabledClients.map(c => c.name).slice(0, 3).join(', ')}
                  {enabledClients.length > 3 ? ` +${enabledClients.length - 3} more` : ''}
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Disabled</span>
                </div>
                <p className="text-2xl font-bold text-[#092E3F]">{disabledClients.length}</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {disabledClients.map(c => c.name).slice(0, 3).join(', ')}
                  {disabledClients.length > 3 ? ` +${disabledClients.length - 3} more` : ''}
                </p>
              </div>
            </div>

            {/* Client list — enabled group */}
            {enabledClients.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <p className="text-xs font-medium text-[#092E3F] uppercase tracking-wide">
                    Enabled ({enabledClients.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {enabledClients.map(client => (
                    <div key={client.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#f6f6f6] border border-[#e5f2f4]">
                      <div className="flex items-center gap-3">
                        <Users className="w-3.5 h-3.5 text-[#6b828c] shrink-0" />
                        <span className="text-sm font-medium text-[#092E3F]">{client.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${LEVEL_COLORS[client.level]}`}>
                          {client.level}
                        </span>
                      </div>
                      <button
                        onClick={() => toggle(client.name)}
                        className="relative inline-block w-12 h-6 transition-colors rounded-full bg-[#4caf50] shrink-0"
                      >
                        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform translate-x-6" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider between groups */}
            {enabledClients.length > 0 && disabledClients.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e5f2f4]" />
                <span className="text-[10px] text-[#6b828c] uppercase tracking-widest">Misaligned</span>
                <div className="h-px flex-1 bg-[#e5f2f4]" />
              </div>
            )}

            {/* Client list — disabled group */}
            {disabledClients.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-xs font-medium text-[#092E3F] uppercase tracking-wide">
                    Disabled ({disabledClients.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {disabledClients.map(client => (
                    <div key={client.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#f6f6f6] border border-[#e5f2f4]">
                      <div className="flex items-center gap-3">
                        <Users className="w-3.5 h-3.5 text-[#6b828c] shrink-0" />
                        <span className="text-sm font-medium text-[#092E3F]">{client.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${LEVEL_COLORS[client.level]}`}>
                          {client.level}
                        </span>
                      </div>
                      <button
                        onClick={() => toggle(client.name)}
                        className="relative inline-block w-12 h-6 transition-colors rounded-full bg-[#e5f2f4] shrink-0"
                      >
                        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform translate-x-0" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aligned state confirmation */}
            {isAligned && clients.length > 0 && (
              <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                enabledClients.length > 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-[#f6f6f6] border-[#e5f2f4]'
              }`}>
                <CheckCircle className={`w-5 h-5 shrink-0 ${enabledClients.length > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                <p className="text-sm text-[#092E3F]">
                  All clients are now{' '}
                  <span className="font-semibold">{enabledClients.length > 0 ? 'enabled' : 'disabled'}</span>.
                  Press <span className="font-semibold">Confirm Alignment</span> to save.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => alignAll(false)}
              className="flex-1 py-2 rounded border border-[#d6d6d6] text-sm text-[#092E3F] hover:bg-gray-50 transition-colors font-medium"
            >
              Disable All
            </button>
            <button
              onClick={() => alignAll(true)}
              className="flex-1 py-2 rounded bg-[#092e3f] text-white text-sm hover:bg-[#092e3f]/90 transition-colors font-medium"
            >
              Enable All
            </button>
          </div>
          {isAligned && (
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 rounded-xl bg-[#092e3f] text-white text-sm hover:bg-[#092e3f]/90 transition-colors font-medium"
            >
              Confirm Alignment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
