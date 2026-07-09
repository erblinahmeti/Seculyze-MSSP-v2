import { useState } from 'react';
import { X, Shield, TrendingUp, DollarSign, Info, ChevronLeft } from 'lucide-react';
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
  sourceTenantId?: string;
  clientsApplied?: number;
  clientNames?: string[];
  recommendedValue?: 'High' | 'Medium' | 'Low';
}

interface Client {
  id: string;
  name: string;
  level: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4';
  hasLogSource: boolean;
}

interface ValueMatrixModalProps {
  rule: AlertRule;
  baselineTenant?: string;
  onClose: () => void;
  onBack?: () => void;
  onApply?: (value: 'High' | 'Medium' | 'Low', explanation: string) => void;
  showKQL?: boolean;
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

const getPositionFromValue = (value: 'High' | 'Medium' | 'Low'): MatrixPosition => {
  if (value === 'High') return { gain: 'high', cost: 'low' };
  if (value === 'Medium') return { gain: 'medium', cost: 'medium' };
  return { gain: 'low', cost: 'high' };
};

const mockClients: Client[] = [
  { id: '1', name: 'Nike', level: 'Level 1', hasLogSource: true },
  { id: '2', name: 'Adidas', level: 'Level 1', hasLogSource: true },
  { id: '3', name: 'Apple', level: 'Level 2', hasLogSource: false },
  { id: '4', name: 'Microsoft', level: 'Level 2', hasLogSource: true },
  { id: '5', name: 'Google', level: 'Level 1', hasLogSource: true },
  { id: '6', name: 'Amazon', level: 'Level 3', hasLogSource: false },
  { id: '7', name: 'Tesla', level: 'Level 2', hasLogSource: true },
  { id: '8', name: 'Meta', level: 'Level 3', hasLogSource: false },
  { id: '9', name: 'Netflix', level: 'Level 1', hasLogSource: true },
  { id: '10', name: 'Spotify', level: 'Level 4', hasLogSource: false },
  { id: '11', name: 'Adobe', level: 'Level 2', hasLogSource: true },
  { id: '12', name: 'Oracle', level: 'Level 3', hasLogSource: false },
  { id: '13', name: 'SAP', level: 'Level 1', hasLogSource: true },
  { id: '14', name: 'Salesforce', level: 'Level 2', hasLogSource: true },
  { id: '15', name: 'IBM', level: 'Level 4', hasLogSource: false },
];

const mockKQL = `SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count() by Account, Computer
| where FailedAttempts > 5`;

export default function ValueMatrixModal({
  rule,
  baselineTenant,
  onClose,
  onBack,
  onApply,
  showKQL = false
}: ValueMatrixModalProps) {
  // In misalignment mode the baseline tenant's value (rule.value) is the source of truth —
  // initialize the matrix there, since we recommend restoring the baseline
  const [position, setPosition] = useState<MatrixPosition>(getPositionFromValue(rule.value));
  // In align mode, start from the baseline tenant's existing rationale — we're
  // restoring the baseline value, so its explanation is the sensible default.
  const [explanation, setExplanation] = useState(showKQL ? (rule.valueExplanation ?? '') : '');

  const currentValue = getValueFromPosition(position);

  // The tenant that deviated from the baseline, and the value they changed to
  const deviatingClient = showKQL ? mockClients.find(c => c.id === rule.sourceTenantId) || mockClients[0] : null;
  const deviatingValue = rule.recommendedValue;

  // Per-tenant current value (mock): the deviating tenant sits at its changed value,
  // every other tenant is at the baseline value.
  const tenantCurrentValue = (id: string): 'High' | 'Medium' | 'Low' =>
    id === rule.sourceTenantId ? (deviatingValue ?? rule.value) : rule.value;

  // Alignment is idempotent — only tenants whose value differs from the target
  // (the value the marker is on) actually change. The rest are left untouched.
  const changingTenants = showKQL ? mockClients.filter(c => tenantCurrentValue(c.id) !== currentValue) : [];
  const changingCount = changingTenants.length;
  const unchangedCount = showKQL ? mockClients.length - changingCount : 0;

  const handleApply = () => {
    if (!explanation.trim()) {
      toast.error('Please provide an explanation for the value change');
      return;
    }
    onApply?.(currentValue, explanation);
    if (showKQL) {
      const names = changingTenants.length <= 3 ? ` (${changingTenants.map(c => c.name).join(', ')})` : '';
      toast.success(`${changingCount} tenant${changingCount !== 1 ? 's' : ''} aligned to ${currentValue}${names} — ${unchangedCount} already matched`);
    } else {
      toast.success(`Value updated to ${currentValue} across all customers`);
    }
    onClose();
  };

  const handleReset = () => {
    setPosition(getPositionFromValue(rule.value));
    setExplanation(showKQL ? (rule.valueExplanation ?? '') : '');
    toast.info('Reset to baseline value and explanation');
  };

  const getCellColor = (gain: 'high' | 'medium' | 'low', cost: 'low' | 'medium' | 'high') => {
    const value = getValueFromPosition({ gain, cost });
    if (value === 'High') return 'bg-[#76ba3b]';
    if (value === 'Medium') return 'bg-[#cfffa6]';
    return 'bg-[#d6d6d6]';
  };

  const isSelected = (gain: 'high' | 'medium' | 'low', cost: 'low' | 'medium' | 'high') => {
    return position.gain === gain && position.cost === cost;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sidebar panel */}
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
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">
                {showKQL ? 'Value Alignment' : 'Set Value Recommendation'}
              </p>
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

            {/* Value Misalignment Info */}
            {showKQL && deviatingClient && (
              <div className="space-y-3">
                {/* Deviation → Baseline indicator */}
                {deviatingValue && (
                  <div className="flex items-center gap-3 p-4 bg-[#092E3F] rounded-xl">
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide mb-1">{deviatingClient.name} changed to</p>
                      <span className={`inline-block px-3 py-1 rounded-[4px] text-xs font-bold ${
                        deviatingValue === 'High' ? 'bg-[#76ba3b]/20 text-[#76ba3b]' :
                        deviatingValue === 'Medium' ? 'bg-yellow-400/20 text-yellow-300' :
                        'bg-gray-400/20 text-gray-300'
                      }`}>{deviatingValue}</span>
                    </div>
                    <div className="text-white/40 text-lg">→</div>
                    <div className="flex-1 text-center">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide mb-1">
                        Baseline{baselineTenant ? ` (${baselineTenant})` : ''} has
                      </p>
                      <span className={`inline-block px-3 py-1 rounded-[4px] text-xs font-bold ring-2 ${
                        rule.value === 'High' ? 'bg-[#76ba3b]/30 text-[#76ba3b] ring-[#76ba3b]/50' :
                        rule.value === 'Medium' ? 'bg-yellow-400/30 text-yellow-300 ring-yellow-400/50' :
                        'bg-gray-400/30 text-gray-300 ring-gray-400/50'
                      }`}>{rule.value}</span>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[#092E3F] font-medium mb-1">Deviation from Baseline</p>
                      <p className="text-xs text-blue-800">
                        <span className="font-bold">{deviatingClient.name}</span> changed this rule's value
                        {deviatingValue ? <> from <span className="font-bold">{rule.value}</span> to <span className="font-bold">{deviatingValue}</span></> : ''}.
                        Your baseline tenant{baselineTenant ? <> <span className="font-bold">{baselineTenant}</span></> : ''} has it at <span className="font-bold">{rule.value}</span> —
                        we recommend restoring the baseline value. Confirm below to align.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Current value distribution — misalignment overview */}
            {showKQL && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide">
                  Current value distribution
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['High', 'Medium', 'Low'] as const).map(v => {
                    const forValue = mockClients.filter(c => tenantCurrentValue(c.id) === v);
                    // This whole column will move if it isn't already the target value
                    const columnChanges = v !== currentValue && forValue.length > 0;
                    const colors = {
                      High:   { border: 'border-[#76ba3b]/40', header: 'bg-[#76ba3b]/10', label: 'text-[#4a8522] font-bold' },
                      Medium: { border: 'border-amber-200',    header: 'bg-amber-50',      label: 'text-amber-700 font-bold' },
                      Low:    { border: 'border-gray-200',     header: 'bg-gray-50',       label: 'text-gray-600 font-bold' },
                    }[v];
                    return (
                      <div key={v} className={`rounded-xl border-2 overflow-hidden ${colors.border}`}>
                        <div className={`px-2.5 py-2 flex items-center justify-between ${colors.header}`}>
                          <span className={`text-xs ${colors.label}`}>{v}</span>
                          <span className="text-[10px] text-[#6b828c] font-medium">{forValue.length}</span>
                        </div>
                        <div className="divide-y divide-[#f4f4f4] overflow-y-auto bg-white" style={{ maxHeight: 140 }}>
                          {forValue.length === 0
                            ? <p className="px-2.5 py-2 text-[10px] text-[#6b828c] italic">None</p>
                            : forValue.map(c => (
                              <div key={c.id} className="px-2.5 py-1.5 text-xs text-[#092E3F] flex items-center gap-1.5">
                                <span className="truncate">{c.name}</span>
                                {c.name === baselineTenant && (
                                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[#092E3F] text-white text-[9px] font-semibold uppercase tracking-wide shrink-0">Baseline</span>
                                )}
                                {columnChanges && (
                                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-[#2A96A8] shrink-0">→ {currentValue}</span>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Impact summary — exactly what changes vs. what stays */}
                <div className="flex items-start gap-2 rounded-[4px] bg-[#f6f6f6] px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-[#2A96A8] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#092E3F]/75 leading-relaxed">
                    {changingCount === 0 ? (
                      <>All tenants are already at <span className="font-semibold">{currentValue}</span> — nothing to change.</>
                    ) : (
                      <>
                        <span className="font-semibold">{changingCount} tenant{changingCount !== 1 ? 's' : ''}</span>
                        {' '}will change to <span className="font-semibold">{currentValue}</span>
                        {changingTenants.length <= 3 && <> ({changingTenants.map(c => c.name).join(', ')})</>}.
                        {' '}The other <span className="font-semibold">{unchangedCount}</span> already match and stay unchanged — nothing already correct is overwritten.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {!showKQL && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-[#092E3F] font-medium mb-1">Update value recommendation across all customers</p>
                    <p className="text-xs text-[#092E3F]/70">Move the marker on the matrix to adjust the overall value based on gain and cost.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Overall Value Display */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-light text-[#092E3F] uppercase">Overall Value: </span>
                  <span className={`text-xs font-black uppercase ${
                    currentValue === 'High' ? 'text-[#76ba3b]' :
                    currentValue === 'Medium' ? 'text-[#e0a800]' :
                    'text-[#6b828c]'
                  }`}>
                    {currentValue}
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-[#d6d6d6] hover:text-[#092E3F] transition-colors flex items-center gap-1"
                >
                  <span>Reset to default</span>
                  <svg className="w-3.5 h-3.5 rotate-180 -scale-y-100" fill="currentColor" viewBox="0 0 16 17.5">
                    <path d="M8,0 L16,0 L16,8 L14,8 L14,3.41 L6.71,10.71 L5.29,9.29 L12.59,2 L8,2 L8,0 Z M0,5 L0,17.5 L14,17.5 L14,11.5 L12,11.5 L12,15.5 L2,15.5 L2,7 L6,7 L6,5 L0,5 Z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-[#6b828c]">Move the marker to adjust overall value</p>
            </div>

            {/* Gain vs Cost Matrix */}
            <div className="flex items-center gap-4">
              {/* Gain Scale (Left) */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="flex flex-col items-center">
                  <TrendingUp className="w-4 h-4 text-[#092E3F] mb-1" />
                  <span className="text-xs text-[#092E3F]">Gain</span>
                </div>
                <div className="w-2 h-[168px] rounded-sm bg-gradient-to-b from-[#76ba3b] to-[#092e3f]" />
              </div>

              {/* Matrix Grid */}
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

                {/* Cost Scale (Bottom) */}
                <div className="mt-3 flex items-center gap-2 pl-12">
                  <div className="flex-1 h-2 rounded-sm bg-gradient-to-r from-[#092e3f] to-[#b73520]" />
                  <div className="flex items-center gap-1 shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-[#092E3F]" />
                    <span className="text-xs text-[#092E3F]">Cost</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Value Explanation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-light text-[#092E3F] uppercase">
                  Value Explanation
                </label>
                {showKQL && baselineTenant && explanation.trim() !== '' && explanation.trim() === (rule.valueExplanation ?? '').trim() && (
                  <span className="text-[10px] font-medium text-[#2A96A8] bg-[#e5f2f4] px-2 py-0.5 rounded-[4px]">
                    Inherited from {baselineTenant}
                  </span>
                )}
              </div>
              {showKQL && (
                <p className="text-[11px] text-[#6b828c] mb-2 leading-relaxed">
                  {changingCount === 0
                    ? 'All tenants already aligned — no explanation change needed.'
                    : <>Applies only to the <span className="font-semibold text-[#092E3F]">{changingCount} tenant{changingCount !== 1 ? 's' : ''}</span> being aligned. Tenants already at {currentValue} keep their own explanation — it isn't overwritten.</>}
                </p>
              )}
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain why this value is recommended..."
                className="w-full px-4 py-3 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-sm text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] transition-all resize-none"
                rows={3}
              />
            </div>

            {/* KQL Code Section */}
            {showKQL && (
              <div>
                <h3 className="text-xs font-light text-[#092E3F] uppercase mb-2">KQL Query</h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-green-400 font-mono">{mockKQL}</pre>
                </div>
                <p className="text-xs text-[#6b828c] mt-2">
                  Multiple versions detected. The query above represents version {rule.version}.
                </p>
              </div>
            )}

            {/* Settings reference — the baseline in align mode, the rule itself otherwise */}
            <div className="bg-gray-50 rounded-xl p-4 border-l-2 border-[#6b828c]">
              <h3 className="text-xs font-light text-[#092E3F] uppercase mb-1">
                {showKQL ? `Baseline settings${baselineTenant ? ` · ${baselineTenant}` : ''}` : 'Current Settings'}
              </h3>
              {showKQL && (
                <p className="text-[11px] text-[#6b828c] mb-3 leading-relaxed">
                  The reference you're aligning tenants to. Individual tenants may differ — see the value distribution above.
                </p>
              )}
              <div className={`grid grid-cols-4 gap-3 text-xs ${showKQL ? '' : 'mt-2'}`}>
                <div>
                  <p className="text-[#6b828c] mb-1">State</p>
                  <p className="text-[#092E3F] font-medium">{rule.state}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">Version</p>
                  <p className="text-[#092E3F] font-medium">{rule.version}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">Author</p>
                  <p className="text-[#092E3F] font-medium">{rule.author}</p>
                </div>
                <div>
                  <p className="text-[#6b828c] mb-1">{showKQL ? 'Baseline value' : 'Current Value'}</p>
                  <p className="text-[#092E3F] font-medium">{rule.value}</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-[#6b828c] rounded text-sm hover:text-[#092E3F] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={showKQL && changingCount === 0}
              className="px-6 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {showKQL
                ? changingCount === 0
                  ? 'All tenants aligned'
                  : `Align ${changingCount} tenant${changingCount !== 1 ? 's' : ''} to ${currentValue}`
                : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
