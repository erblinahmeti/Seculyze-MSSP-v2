import { useState } from 'react';
import { X, Shield, TrendingUp, DollarSign, AlertTriangle, Search, Users, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface AlertRule {
  id: string;
  name: string;
  author: 'Microsoft' | 'Seculyze' | 'Custom';
  version: string;
  mitre: string[];
  logSources: string[];
  value: 'High' | 'Medium' | 'Low';
  state: 'Enabled' | 'Disabled';
}

interface Client {
  id: string;
  name: string;
  level: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4';
  hasLogSources: boolean;
  enabled: boolean;
}

interface ValueDistributeModalProps {
  rule: AlertRule;
  sourceTenantId?: string;
  onClose: () => void;
  onBack?: () => void;
  onDistribute?: (value: 'High' | 'Medium' | 'Low', explanation: string, targetClientIds: string[]) => void;
}

type MatrixPosition = {
  gain: 'high' | 'medium' | 'low';
  cost: 'low' | 'medium' | 'high';
};

const getValueFromPosition = (position: MatrixPosition): 'High' | 'Medium' | 'Low' => {
  if (position.gain === 'high' && position.cost === 'low') return 'High';
  if (position.gain === 'high' && position.cost === 'medium') return 'High';
  if (position.gain === 'medium' && position.cost === 'low') return 'High';
  if (position.gain === 'high' && position.cost === 'high') return 'Medium';
  if (position.gain === 'medium' && position.cost === 'medium') return 'Medium';
  if (position.gain === 'low' && position.cost === 'low') return 'Medium';
  return 'Low';
};

const initialClients: Omit<Client, 'enabled'>[] = [
  { id: '1', name: 'Nike', level: 'Level 1', hasLogSources: true },
  { id: '2', name: 'Adidas', level: 'Level 1', hasLogSources: true },
  { id: '3', name: 'Apple', level: 'Level 2', hasLogSources: true },
  { id: '4', name: 'Microsoft', level: 'Level 2', hasLogSources: true },
  { id: '5', name: 'Google', level: 'Level 1', hasLogSources: true },
  { id: '6', name: 'Amazon', level: 'Level 3', hasLogSources: false },
  { id: '7', name: 'Tesla', level: 'Level 2', hasLogSources: true },
  { id: '8', name: 'Meta', level: 'Level 3', hasLogSources: false },
  { id: '9', name: 'Netflix', level: 'Level 1', hasLogSources: true },
  { id: '10', name: 'Spotify', level: 'Level 4', hasLogSources: true },
  { id: '11', name: 'Adobe', level: 'Level 2', hasLogSources: true },
  { id: '12', name: 'Oracle', level: 'Level 3', hasLogSources: false },
  { id: '13', name: 'SAP', level: 'Level 1', hasLogSources: true },
  { id: '14', name: 'Salesforce', level: 'Level 2', hasLogSources: true },
];

export default function ValueDistributeModal({
  rule,
  sourceTenantId,
  onClose,
  onBack,
  onDistribute,
}: ValueDistributeModalProps) {
  const [position, setPosition] = useState<MatrixPosition | null>(null);
  const [explanation, setExplanation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyAllEnabled, setApplyAllEnabled] = useState(true);
  const [clients, setClients] = useState<Client[]>(
    initialClients
      .filter(c => c.id !== sourceTenantId)
      .map(c => ({ ...c, enabled: c.hasLogSources }))
  );

  const currentValue = position ? getValueFromPosition(position) : null;

  const sourceTenant = initialClients.find(c => c.id === sourceTenantId);
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const enabledCount = clients.filter(c => c.enabled).length;
  const withoutLogSources = clients.filter(c => !c.hasLogSources).length;

  const handleToggleClient = (clientId: string) => {
    setClients(prev =>
      prev.map(c => c.id === clientId ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const handleToggleAll = () => {
    const next = !applyAllEnabled;
    setApplyAllEnabled(next);
    setClients(prev => prev.map(c => ({ ...c, enabled: next })));
  };

  const handleReset = () => {
    setPosition(null);
    setExplanation('');
    toast.info('Value and explanation cleared');
  };

  const handleDistribute = () => {
    if (!position) {
      toast.error('Please select a value on the matrix before distributing');
      return;
    }
    if (!explanation.trim()) {
      toast.error('Please provide an explanation for the value recommendation');
      return;
    }
    const selectedIds = clients.filter(c => c.enabled).map(c => c.id);
    if (selectedIds.length === 0) {
      toast.error('Please enable at least one client to distribute to');
      return;
    }
    onDistribute?.(currentValue, explanation, selectedIds);
    toast.success(`Distributed rule with ${currentValue} value to ${selectedIds.length} client${selectedIds.length !== 1 ? 's' : ''}`);
    onClose();
  };

  const getCellColor = (gain: 'high' | 'medium' | 'low', cost: 'low' | 'medium' | 'high') => {
    const value = getValueFromPosition({ gain, cost });
    if (value === 'High') return 'bg-[#76ba3b]';
    if (value === 'Medium') return 'bg-[#cfffa6]';
    return 'bg-[#d6d6d6]';
  };

  const isSelected = (gain: 'high' | 'medium' | 'low', cost: 'low' | 'medium' | 'high') =>
    position !== null && position.gain === gain && position.cost === cost;

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
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Set Value & Distribute</p>
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

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">
                    New Alert Rule{sourceTenant ? ` from ${sourceTenant.name}` : ''}
                  </p>
                  <p className="text-xs text-[#092E3F]/70">
                    Set the value recommendation using the matrix below, then select which clients should receive this rule.
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Value */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-light text-[#092E3F] uppercase">Overall Value:</span>
                  {currentValue ? (
                    <span className={`text-xs font-black uppercase ${
                      currentValue === 'High' ? 'text-[#76ba3b]' :
                      currentValue === 'Medium' ? 'text-[#e0a800]' :
                      'text-[#6b828c]'
                    }`}>
                      {currentValue}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-500">Not set — click a cell below</span>
                  )}
                </div>
                {position && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-[#d6d6d6] hover:text-[#092E3F] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-[#6b828c]">Click a cell on the matrix to set the value</p>
            </div>

            {/* 3×3 Gain vs Cost Matrix */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="flex flex-col items-center">
                  <TrendingUp className="w-4 h-4 text-[#092E3F] mb-1" />
                  <span className="text-xs text-[#092E3F]">Gain</span>
                </div>
                <div className="w-2 h-[168px] rounded-sm bg-gradient-to-b from-[#76ba3b] to-[#092e3f]" />
              </div>

              <div className="flex-1">
                <div className="grid grid-rows-3 gap-0 h-[168px] rounded-sm overflow-hidden">
                  {(['high', 'medium', 'low'] as const).map((gain) => (
                    <div key={gain} className="grid grid-cols-3 gap-0">
                      {(['low', 'medium', 'high'] as const).map((cost) => (
                        <button
                          key={cost}
                          onClick={() => setPosition({ gain, cost })}
                          className={`${getCellColor(gain, cost)} relative transition-all hover:opacity-80`}
                        >
                          {isSelected(gain, cost) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-5 h-5 bg-[#f6f6f6] rounded-full border-4 border-[#092E3F] shadow-lg" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2 pl-12">
                  <div className="flex-1 h-2 rounded-sm bg-gradient-to-r from-[#092e3f] to-[#b73520]" />
                  <div className="flex items-center gap-1 shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-[#092E3F]" />
                    <span className="text-xs text-[#092E3F]">Cost</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-xs font-light text-[#092E3F] uppercase mb-2">
                Value Explanation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this value is recommended..."
                className="w-full px-4 py-3 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-sm text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] transition-all resize-none"
                rows={3}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-[#e5f2f4]" />

            {/* Clients header with Apply All toggle */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2A96A8]" />
                  <h3 className="text-sm font-medium text-[#092E3F]">
                    Target Clients
                    <span className="ml-2 text-xs text-[#6b828c] font-normal">
                      {enabledCount} of {clients.length} enabled
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6b828c]">Apply all</span>
                  <button
                    onClick={handleToggleAll}
                    className={`relative inline-block w-12 h-6 transition-colors rounded-full ${
                      applyAllEnabled ? 'bg-[#2A96A8]' : 'bg-[#e5f2f4]'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      applyAllEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {withoutLogSources > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-[#092E3F]">
                      <span className="font-medium">{withoutLogSources} client{withoutLogSources !== 1 ? 's' : ''}</span> don't have the required log sources enabled. The rule will be distributed but won't be active until log sources are enabled.
                    </p>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c]" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#f6f6f6] border border-[#e5f2f4] rounded-lg text-xs text-[#092E3F] placeholder:text-[#979394] focus:outline-none focus:border-[#2A96A8] transition-all"
                />
              </div>

              {/* Client list with switches */}
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#f6f6f6] hover:bg-[#e5f2f4] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${client.hasLogSources ? 'bg-green-500' : 'bg-orange-400'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#092E3F] truncate">{client.name}</span>
                          {!client.hasLogSources && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] rounded-full shrink-0 whitespace-nowrap">
                              No Log Sources
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#6b828c]">{client.level}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleClient(client.id)}
                      className={`relative inline-block w-12 h-6 transition-colors rounded-full shrink-0 ml-3 ${
                        client.enabled ? 'bg-[#4caf50]' : 'bg-[#e5f2f4]'
                      }`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        client.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
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
              onClick={handleDistribute}
              disabled={!position || enabledCount === 0}
              className="px-6 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Value & Distribute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
