import { useState } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, ChevronDown, ChevronUp,
  Shield, UserX, LogOut, Ban, Clipboard, Play, AlertTriangle,
  ShieldAlert, Circle
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// ─── types ────────────────────────────────────────────────────────────────────

interface IncidentSummary {
  id: string;
  incidentNumber: string;
  type: string;
  sentinelSeverity: string;
  client: { name: string };
  status: string;
}

interface RecommendedAction {
  id: string;
  action: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  icon: string;
  description: string;
  target?: string;
}

interface IncidentResult {
  id: string;
  phase: 'pending' | 'analyzing' | 'complete';
  classification: 'TruePositive' | 'FalsePositive' | 'BenignPositive' | 'Undetermined';
  confidence: number;
  summary: string;
  actions: RecommendedAction[];
  expanded: boolean;
}

interface MultiIncidentAnalysisSidebarProps {
  incidents: IncidentSummary[];
  onClose: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-gray-100 text-gray-500',
};

const SEV_COLORS: Record<string, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-400',
  Medium: 'bg-yellow-400',
  Low: 'bg-green-400',
};

function getActionIcon(icon: string) {
  const cls = 'w-4 h-4 text-[#092E3F]';
  switch (icon) {
    case 'userx': return <UserX className={cls} />;
    case 'logout': return <LogOut className={cls} />;
    case 'shieldalert': return <ShieldAlert className={cls} />;
    case 'ban': return <Ban className={cls} />;
    case 'clipboard': return <Clipboard className={cls} />;
    case 'shield': return <Shield className={cls} />;
    case 'play': return <Play className={cls} />;
    default: return <AlertTriangle className={cls} />;
  }
}

function generateActions(type: string, incId: string): RecommendedAction[] {
  const t = type.toLowerCase();

  if (t.includes('password') || t.includes('brute') || t.includes('sign') || t.includes('login') || t.includes('credential')) {
    return [
      { id: `${incId}-a1`, action: 'Block-AADUser', priority: 'Critical', icon: 'userx', description: 'Block compromised Azure AD user account immediately', target: 'affected.user@tenant.com' },
      { id: `${incId}-a2`, action: 'Revoke-AADSignInSessions', priority: 'High', icon: 'logout', description: 'Revoke all active sign-in sessions for the account', target: 'affected.user@tenant.com' },
      { id: `${incId}-a3`, action: 'Confirm-EntraIDRiskyUser', priority: 'High', icon: 'shieldalert', description: 'Flag account as risky to trigger conditional access', target: 'affected.user@tenant.com' },
      { id: `${incId}-a4`, action: 'Make Incident in ITSM', priority: 'Medium', icon: 'clipboard', description: 'Create ITSM ticket for change management tracking', target: 'INC-AUTO' },
    ];
  }
  if (t.includes('malware') || t.includes('ransomware') || t.includes('execution') || t.includes('powershell')) {
    return [
      { id: `${incId}-a1`, action: 'Isolate-MDEMachine', priority: 'Critical', icon: 'shieldalert', description: 'Isolate endpoint from network using Defender for Endpoint', target: 'DESKTOP-AFFECTED' },
      { id: `${incId}-a2`, action: 'Block IP In Infrastructure', priority: 'Critical', icon: 'ban', description: 'Block C2 IP at firewall and perimeter', target: '10.0.0.0/24' },
      { id: `${incId}-a3`, action: 'Collect Forensic Evidence', priority: 'High', icon: 'clipboard', description: 'Capture memory dump and system artefacts', target: 'DESKTOP-AFFECTED' },
      { id: `${incId}-a4`, action: 'Run Malware Investigation Playbook', priority: 'High', icon: 'play', description: 'Execute automated malware investigation workflow' },
    ];
  }
  if (t.includes('phishing') || t.includes('email') || t.includes('mail') || t.includes('guest') || t.includes('invite')) {
    return [
      { id: `${incId}-a1`, action: 'Block Sender Domain', priority: 'High', icon: 'ban', description: 'Add malicious sender domain to block list', target: 'malicious-domain.com' },
      { id: `${incId}-a2`, action: 'Quarantine Messages', priority: 'High', icon: 'shield', description: 'Quarantine all emails from this sender across tenant' },
      { id: `${incId}-a3`, action: 'Revoke Guest Access', priority: 'Critical', icon: 'userx', description: 'Revoke all guest user invitations from suspicious domain' },
      { id: `${incId}-a4`, action: 'User Awareness Notification', priority: 'Medium', icon: 'clipboard', description: 'Notify impacted users about the phishing attempt' },
    ];
  }

  // default
  return [
    { id: `${incId}-a1`, action: 'Block IP In Infrastructure', priority: 'Critical', icon: 'ban', description: 'Block identified malicious IP at infrastructure level', target: '198.51.100.0' },
    { id: `${incId}-a2`, action: 'Investigate User Activity', priority: 'High', icon: 'shieldalert', description: 'Review user activity logs for the past 72 hours' },
    { id: `${incId}-a3`, action: 'Make Incident in ITSM', priority: 'Medium', icon: 'clipboard', description: 'Create ITSM ticket for change management and tracking', target: 'INC-AUTO' },
  ];
}

function classifyIncident(severity: string): { classification: IncidentResult['classification']; confidence: number; summary: string } {
  if (severity === 'Critical' || severity === 'High') {
    return { classification: 'TruePositive', confidence: 91 + Math.floor(Math.random() * 8), summary: 'High-confidence true positive. Immediate containment recommended based on threat indicators and behavioural patterns.' };
  }
  if (severity === 'Medium') {
    return { classification: 'TruePositive', confidence: 74 + Math.floor(Math.random() * 12), summary: 'Likely true positive with moderate confidence. Manual review advised before applying containment actions.' };
  }
  return { classification: 'Undetermined', confidence: 52 + Math.floor(Math.random() * 20), summary: 'Insufficient signals for high-confidence classification. Review recommended actions and apply as appropriate.' };
}

const DELAY_PER_INCIDENT = 2000;

// ─── component ────────────────────────────────────────────────────────────────

export default function MultiIncidentAnalysisSidebar({ incidents, onClose }: MultiIncidentAnalysisSidebarProps) {
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'complete'>('idle');
  const [results, setResults] = useState<Record<string, IncidentResult>>(
    Object.fromEntries(incidents.map(inc => [inc.id, {
      id: inc.id,
      phase: 'pending',
      classification: 'Undetermined',
      confidence: 0,
      summary: '',
      actions: [],
      expanded: false,
    }]))
  );
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [applyingActions, setApplyingActions] = useState(false);

  const allComplete = incidents.every(i => results[i.id]?.phase === 'complete');
  const completeCount = incidents.filter(i => results[i.id]?.phase === 'complete').length;

  const allActions = incidents.flatMap(inc =>
    (results[inc.id]?.phase === 'complete' ? results[inc.id].actions : []).map(a => ({ ...a, incidentId: inc.id, incidentNumber: inc.incidentNumber }))
  );
  const selectedCount = selectedActionIds.size;

  const toggleAction = (id: string) => {
    setSelectedActionIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllActions = () => {
    const criticalAndHigh = allActions.filter(a => a.priority === 'Critical' || a.priority === 'High').map(a => a.id);
    setSelectedActionIds(new Set(criticalAndHigh));
  };

  const toggleExpanded = (id: string) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], expanded: !prev[id].expanded } }));
  };

  const startAnalysis = async () => {
    setPhase('analyzing');

    for (const inc of incidents) {
      // mark as analyzing
      setResults(prev => ({ ...prev, [inc.id]: { ...prev[inc.id], phase: 'analyzing' } }));
      await new Promise(res => setTimeout(res, DELAY_PER_INCIDENT));

      // generate result
      const { classification, confidence, summary } = classifyIncident(inc.sentinelSeverity);
      const actions = generateActions(inc.type, inc.id).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

      setResults(prev => ({
        ...prev,
        [inc.id]: { ...prev[inc.id], phase: 'complete', classification, confidence, summary, actions, expanded: true }
      }));
    }

    setPhase('complete');
    // auto-select all Critical/High actions
    const autoSelect = incidents.flatMap(inc => generateActions(inc.type, inc.id).filter(a => a.priority === 'Critical' || a.priority === 'High').map(a => a.id));
    setSelectedActionIds(new Set(autoSelect));
    toast.success(`Analysis complete for ${incidents.length} incident${incidents.length !== 1 ? 's' : ''}`);
  };

  const applySelected = async () => {
    if (selectedCount === 0) return;
    setApplyingActions(true);
    await new Promise(res => setTimeout(res, 1200));
    setApplyingActions(false);
    toast.success(`${selectedCount} action${selectedCount !== 1 ? 's' : ''} applied across ${incidents.length} incident${incidents.length !== 1 ? 's' : ''}`);
    setSelectedActionIds(new Set());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={phase === 'analyzing' ? undefined : onClose} />

      <div className="relative w-[600px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#2A96A8]" />
                <p className="text-[#2A96A8] text-xs uppercase tracking-widest">AI Analysis</p>
              </div>
              <h2 className="text-white text-base font-semibold">
                {incidents.length} Incident{incidents.length !== 1 ? 's' : ''} Selected
              </h2>
              {phase !== 'idle' && (
                <p className="text-white/50 text-xs mt-1">
                  {completeCount}/{incidents.length} analysed
                </p>
              )}
            </div>
            <button
              onClick={phase === 'analyzing' ? undefined : onClose}
              disabled={phase === 'analyzing'}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5 disabled:opacity-30"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Progress bar */}
          {phase !== 'idle' && (
            <div className="mt-4 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2A96A8] transition-all duration-500 rounded-full"
                style={{ width: `${(completeCount / incidents.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Idle state ── */}
          {phase === 'idle' && (
            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#e5f2f4]/60 border border-[#2A96A8]/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#2A96A8] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#092E3F]/80">
                    AI will analyse each incident sequentially, classify the threat, and generate recommended containment actions. Critical and High priority actions will be pre-selected for bulk apply.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {incidents.map(inc => (
                  <div key={inc.id} className="flex items-center gap-3 px-4 py-3 bg-[#f6f6f6] rounded-xl">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${SEV_COLORS[inc.sentinelSeverity] ?? 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[#6b828c]">#{inc.incidentNumber}</span>
                        <span className="text-xs text-[#6b828c]">·</span>
                        <span className="text-xs text-[#6b828c]">{inc.client.name}</span>
                      </div>
                      <p className="text-sm text-[#092E3F] font-medium truncate">{inc.type}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[inc.sentinelSeverity] ?? 'bg-gray-100 text-gray-500'}`}>
                      {inc.sentinelSeverity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Analyzing / Complete state ── */}
          {phase !== 'idle' && (
            <div className="px-6 py-5 space-y-3">
              {incidents.map(inc => {
                const result = results[inc.id];
                const isAnalyzing = result.phase === 'analyzing';
                const isComplete = result.phase === 'complete';
                const isPending = result.phase === 'pending';

                return (
                  <div
                    key={inc.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      isComplete ? 'border-[#e5f2f4]' :
                      isAnalyzing ? 'border-[#2A96A8]' :
                      'border-[#f0f0f0]'
                    }`}
                  >
                    {/* Incident row header */}
                    <div
                      className={`px-4 py-3 flex items-center gap-3 ${isComplete ? 'cursor-pointer hover:bg-[#f6f6f6]' : ''} ${
                        isAnalyzing ? 'bg-[#e5f2f4]/40' : 'bg-white'
                      }`}
                      onClick={isComplete ? () => toggleExpanded(inc.id) : undefined}
                    >
                      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {isPending && <Circle className="w-4 h-4 text-[#d6d6d6]" />}
                        {isAnalyzing && <Loader2 className="w-4 h-4 text-[#2A96A8] animate-spin" />}
                        {isComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#6b828c]">#{inc.incidentNumber}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${SEV_COLORS[inc.sentinelSeverity]}`} />
                          <span className="text-xs text-[#6b828c]">{inc.client.name}</span>
                          {isComplete && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              result.classification === 'TruePositive' ? 'bg-red-50 text-red-600' :
                              result.classification === 'FalsePositive' ? 'bg-green-50 text-green-700' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {result.classification === 'TruePositive' ? 'True Positive' :
                               result.classification === 'FalsePositive' ? 'False Positive' : 'Undetermined'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#092E3F] font-medium truncate">{inc.type}</p>
                        {isAnalyzing && (
                          <p className="text-[10px] text-[#2A96A8] mt-0.5">Analysing threat indicators…</p>
                        )}
                        {isComplete && (
                          <p className="text-[10px] text-[#6b828c] mt-0.5">
                            {result.confidence}% confidence · {result.actions.length} action{result.actions.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {isComplete && (
                        result.expanded
                          ? <ChevronUp className="w-4 h-4 text-[#6b828c] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[#6b828c] shrink-0" />
                      )}
                    </div>

                    {/* Expanded analysis results */}
                    {isComplete && result.expanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-[#f0f0f0] bg-[#fafafa] space-y-3">
                        {/* Summary */}
                        <p className="text-xs text-[#092E3F]/70 leading-relaxed">{result.summary}</p>

                        {/* Actions list */}
                        <div className="space-y-2">
                          {result.actions.map(action => {
                            const isSelected = selectedActionIds.has(action.id);
                            return (
                              <label
                                key={action.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected ? 'border-[#2A96A8] bg-[#e5f2f4]/40' : 'border-[#e5f2f4] bg-white hover:border-[#2A96A8]/30'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleAction(action.id)}
                                  className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#2A96A8] accent-[#2A96A8] shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-[#092E3F]">{action.action}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[action.priority]}`}>
                                      {action.priority}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#6b828c] leading-snug">{action.description}</p>
                                  {action.target && (
                                    <p className="text-[10px] font-mono text-[#2A96A8] mt-0.5">{action.target}</p>
                                  )}
                                </div>
                                <div className="shrink-0 pt-0.5">{getActionIcon(action.icon)}</div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          {phase === 'idle' && (
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-[#6b828c] text-sm hover:text-[#092E3F] transition-colors">
                Cancel
              </button>
              <button
                onClick={startAnalysis}
                className="flex-1 py-2.5 bg-[#092E3F] text-white rounded text-sm hover:bg-[#092E3F]/90 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Analyse {incidents.length} Incident{incidents.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {phase === 'analyzing' && (
            <div className="flex items-center justify-center gap-3 py-1">
              <Loader2 className="w-4 h-4 text-[#2A96A8] animate-spin" />
              <p className="text-sm text-[#092E3F]">
                Analysing {completeCount + 1} of {incidents.length}…
              </p>
            </div>
          )}

          {phase === 'complete' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#6b828c] mb-1">
                <span>{selectedCount} action{selectedCount !== 1 ? 's' : ''} selected</span>
                <button onClick={selectAllActions} className="text-[#2A96A8] hover:underline">
                  Select Critical & High
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="px-4 py-2 text-[#6b828c] text-sm hover:text-[#092E3F] transition-colors">
                  Close
                </button>
                <button
                  onClick={applySelected}
                  disabled={selectedCount === 0 || applyingActions}
                  className="flex-1 py-2.5 bg-[#092E3F] text-white rounded text-sm hover:bg-[#092E3F]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {applyingActions
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</>
                    : <><Play className="w-4 h-4" /> Apply {selectedCount > 0 ? `${selectedCount} ` : ''}Selected Action{selectedCount !== 1 ? 's' : ''}</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
