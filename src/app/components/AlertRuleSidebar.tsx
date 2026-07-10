import { useState } from 'react';
import { X, Search, Users, ArrowRight, Shield, Code, MessageSquare, History, Info, Activity, FileText, AlertTriangle, CheckCircle, Eye, Edit3, Save, ChevronDown, ChevronUp, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Client {
  id: string;
  name: string;
  level: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4';
  enabled: boolean;
  fpRate?: string;
  score?: number;
}

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
  attention: 'High Value Alert' | 'Low Value Alert' | 'Medium Value Alert' | 'Update Available' | 'Version Misalignment' | 'Value Misalignment' | 'Disable Aligned' | 'New Rule' | 'Client Misalignment' | 'Prerequisites Required' | 'Alert rule requires configuration';
  action: 'Enable' | 'Disable' | 'Update' | 'Align' | 'Distribute' | 'Align Version' | 'Align Value' | 'Align Clients' | 'Set Value & Distribute' | 'Install & Enable' | 'Configure';
  valueExplanation?: string;
  kqlQuery?: string;
  secondaryAttentions?: { attention: AlertRule['attention']; action: AlertRule['action'] }[];
}

// Mirrors the resolution priority in AlertRules.tsx — blockers, then maintenance,
// then alignment drift, then value recommendations
const ATTENTION_PRIORITY: Record<AlertRule['attention'], number> = {
  'Prerequisites Required': 1,
  'Alert rule requires configuration': 2,
  'Update Available': 3,
  'Version Misalignment': 4,
  'Value Misalignment': 5,
  'Client Misalignment': 6,
  'New Rule': 7,
  'High Value Alert': 8,
  'Low Value Alert': 9,
  'Medium Value Alert': 10,
  'Disable Aligned': 11,
};

const getAttentionQueue = (rule: AlertRule) =>
  [{ attention: rule.attention, action: rule.action }, ...(rule.secondaryAttentions ?? [])]
    .sort((a, b) => ATTENTION_PRIORITY[a.attention] - ATTENTION_PRIORITY[b.attention]);

interface ChangelogEntry {
  id: string;
  user: string;
  timestamp: string;
  changes: string;
}

interface Comment {
  id: string;
  user: string;
  timestamp: string;
  text: string;
}

const mockClients: Client[] = [
  { id: '1', name: 'Nike', level: 'Level 1', enabled: true, fpRate: '2.1%', score: 94 },
  { id: '2', name: 'Adidas', level: 'Level 1', enabled: true, fpRate: '1.8%', score: 96 },
  { id: '3', name: 'Apple', level: 'Level 2', enabled: false, fpRate: '3.2%', score: 89 },
  { id: '4', name: 'Microsoft', level: 'Level 2', enabled: true, fpRate: '2.4%', score: 93 },
  { id: '5', name: 'Google', level: 'Level 1', enabled: true, fpRate: '1.9%', score: 95 },
  { id: '6', name: 'Amazon', level: 'Level 3', enabled: false, fpRate: '4.1%', score: 85 },
  { id: '7', name: 'Tesla', level: 'Level 2', enabled: true, fpRate: '2.7%', score: 91 },
  { id: '8', name: 'Meta', level: 'Level 3', enabled: false, fpRate: '3.8%', score: 87 },
  { id: '9', name: 'Netflix', level: 'Level 1', enabled: true, fpRate: '2.0%', score: 94 },
  { id: '10', name: 'Spotify', level: 'Level 4', enabled: false, fpRate: '5.2%', score: 82 },
  { id: '11', name: 'Adobe', level: 'Level 2', enabled: true, fpRate: '2.5%', score: 92 },
  { id: '12', name: 'Oracle', level: 'Level 3', enabled: false, fpRate: '4.3%', score: 84 },
  { id: '13', name: 'SAP', level: 'Level 1', enabled: true, fpRate: '1.7%', score: 97 },
  { id: '14', name: 'Salesforce', level: 'Level 2', enabled: true, fpRate: '2.3%', score: 93 },
  { id: '15', name: 'IBM', level: 'Level 4', enabled: false, fpRate: '5.5%', score: 80 },
];

interface AlertRuleSidebarProps {
  rule?: AlertRule;
  rules?: AlertRule[];
  mode?: 'single' | 'distribution';
  sourceTenantId?: string;
  onClose: () => void;
  onDistribute?: (targetClientIds: string[]) => void;
  // Launch the action flow for an attention/action pair — same flows as the table buttons
  onAction?: (pair: { attention: AlertRule['attention']; action: AlertRule['action'] }) => void;
}

export default function AlertRuleSidebar({
  rule,
  rules = [],
  mode = 'single',
  sourceTenantId,
  onClose,
  onDistribute,
  onAction
}: AlertRuleSidebarProps) {
  // In distribution mode, filter out the source tenant
  const availableClients = mode === 'distribution' && sourceTenantId
    ? mockClients.filter(c => c.id !== sourceTenantId)
    : mockClients;

  const [clients, setClients] = useState<Client[]>(
    availableClients.map(c => ({ ...c, enabled: true }))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [applyAllEnabled, setApplyAllEnabled] = useState(true);

  // New states for detail view - collapsible sections
  const [expandedSections, setExpandedSections] = useState<{
    description: boolean;
    attentionAction: boolean;
    valueMatrix: boolean;
    basicInfo: boolean;
    logSources: boolean;
    mitre: boolean;
    query: boolean;
    changelog: boolean;
    comments: boolean;
    clients: boolean;
  }>({
    description: true,
    attentionAction: true,
    valueMatrix: true,
    basicInfo: true,
    logSources: true,
    mitre: true,
    query: false,
    changelog: false,
    comments: false,
    clients: false
  });

  const [isEditingQuery, setIsEditingQuery] = useState(false);
  const [kqlQuery, setKqlQuery] = useState(rule?.kqlQuery || `// Example KQL Query
SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count() by Account, Computer, IpAddress
| where FailedAttempts > 5
| project TimeGenerated, Account, Computer, IpAddress, FailedAttempts`);
  const [newComment, setNewComment] = useState('');

  // Matrix state
  type MatrixPosition = { gain: 'high' | 'med' | 'low'; cost: 'low' | 'med' | 'high' };
  const getMatrixValueFromRule = (ruleValue: 'High' | 'Medium' | 'Low'): MatrixPosition => {
    if (ruleValue === 'High') return { gain: 'med', cost: 'med' };
    if (ruleValue === 'Medium') return { gain: 'med', cost: 'low' };
    return { gain: 'low', cost: 'high' };
  };
  const [matrixPosition, setMatrixPosition] = useState<MatrixPosition>(
    getMatrixValueFromRule(rule?.value || 'Medium')
  );
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [valueExplanation, setValueExplanation] = useState(
    rule?.valueExplanation || 'This rule provides high value due to its effectiveness in detecting critical security threats with minimal false positives. The cost is medium due to the computational resources required for analysis.'
  );

  // Mock version misalignment data
  const hasVersionMisalignment = rule?.attention === 'Version Misalignment';
  const versionVariants = hasVersionMisalignment ? [
    {
      version: '1.1.4',
      clientCount: 8,
      clients: ['Nike', 'Adidas', 'Google', 'Tesla', 'Netflix', 'Adobe', 'SAP', 'Salesforce'],
      kqlQuery: `// Version 1.1.4
SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count() by Account, Computer, IpAddress
| where FailedAttempts > 5
| project TimeGenerated, Account, Computer, IpAddress, FailedAttempts`
    },
    {
      version: '1.0.8',
      clientCount: 4,
      clients: ['Apple', 'Microsoft', 'Amazon', 'Meta'],
      kqlQuery: `// Version 1.0.8
SecurityEvent
| where EventID == 4625
| where AccountType == "User"
| summarize FailedAttempts = count() by Account, Computer, IpAddress
| where FailedAttempts > 3
| project TimeGenerated, Account, Computer, IpAddress, FailedAttempts`
    },
    {
      version: '0.9.2',
      clientCount: 3,
      clients: ['Oracle', 'Spotify', 'IBM'],
      kqlQuery: `// Version 0.9.2
SecurityEvent
| where EventID == 4625
| summarize FailedAttempts = count() by Account, Computer
| where FailedAttempts > 3
| project TimeGenerated, Account, Computer, FailedAttempts`
    }
  ] : [];

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Mock data
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      user: 'Sarah Chen',
      timestamp: '2024-05-28 14:30',
      text: 'Updated the threshold to reduce false positives from automated testing environments.'
    },
    {
      id: '2',
      user: 'Mike Johnson',
      timestamp: '2024-05-27 09:15',
      text: 'This rule has been very effective in catching brute force attempts. Consider enabling for all Level 1 clients.'
    }
  ]);

  const [changelog] = useState<ChangelogEntry[]>([
    {
      id: '1',
      user: 'Sarah Chen',
      timestamp: '2024-05-28 14:30',
      changes: 'Updated KQL query threshold from 3 to 5 failed attempts'
    },
    {
      id: '2',
      user: 'David Martinez',
      timestamp: '2024-05-26 11:20',
      changes: 'Changed state from Disabled to Enabled for Nike, Adidas, Apple'
    },
    {
      id: '3',
      user: 'Emily Rodriguez',
      timestamp: '2024-05-25 16:45',
      changes: 'Updated value classification from Medium to High'
    },
    {
      id: '4',
      user: 'System',
      timestamp: '2024-05-24 08:00',
      changes: 'Version updated from 1.0.0 to 1.1.4'
    }
  ]);

  const enabledCount = clients.filter(c => c.enabled).length;
  const totalCount = clients.length;
  const sourceTenant = mockClients.find(c => c.id === sourceTenantId);

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = filterTab === 'all' ||
                       (filterTab === 'enabled' && client.enabled) ||
                       (filterTab === 'disabled' && !client.enabled);

    return matchesSearch && matchesTab;
  });

  const handleToggleClient = (clientId: string) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const handleApplyAll = () => {
    const newApplyAllState = !applyAllEnabled;
    setApplyAllEnabled(newApplyAllState);
    setClients(prev => prev.map(c => ({ ...c, enabled: newApplyAllState })));
    toast.success(newApplyAllState ? 'Applied rule to all clients' : 'Removed rule from all clients');
  };

  const handleSaveQuery = () => {
    setIsEditingQuery(false);
    toast.success('KQL query saved successfully');
  };

  const handleMatrixCellClick = (gain: 'high' | 'med' | 'low', cost: 'low' | 'med' | 'high') => {
    setMatrixPosition({ gain, cost });
    toast.success('Matrix position updated');
  };

  const getMatrixValue = (gain: string, cost: string): string => {
    if (gain === 'high' && (cost === 'low' || cost === 'med')) return 'H';
    if (gain === 'high' && cost === 'high') return 'M';
    if (gain === 'med' && cost === 'low') return 'H';
    if (gain === 'med' && cost === 'med') return 'M';
    if (gain === 'med' && cost === 'high') return 'L';
    if (gain === 'low' && cost === 'low') return 'M';
    return 'L';
  };

  const getMatrixColor = (value: string): string => {
    if (value === 'H') return 'bg-[#76ba3b]';
    if (value === 'M') return 'bg-[#cfffa6]';
    return 'bg-[#d6d6d6]';
  };

  const isSelectedCell = (gain: string, cost: string): boolean => {
    return matrixPosition.gain === gain && matrixPosition.cost === cost;
  };

  const handleResetMatrix = () => {
    setMatrixPosition(getMatrixValueFromRule(rule?.value || 'Medium'));
    toast.info('Reset to default value');
  };

  const handleSaveExplanation = () => {
    setIsEditingExplanation(false);
    toast.success('Value explanation saved successfully');
  };

  const handleAlignAcrossCustomers = () => {
    toast.success('Aligning value matrix across all customers');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      user: 'Current User',
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      text: newComment
    };

    setComments(prev => [comment, ...prev]);
    setNewComment('');
    toast.success('Comment added successfully');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
        {/* Sidebar */}
        <div className="w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">
                {mode === 'distribution' ? 'Distribute Rules' : 'Alert Rule'}
              </p>
              <h2 className="text-white text-base font-semibold leading-snug">
                {mode === 'distribution'
                  ? `${rules.length} rule${rules.length !== 1 ? 's' : ''} from ${sourceTenant?.name ?? 'source'}`
                  : (rule?.name ?? 'Alert Rule')}
              </h2>
              {mode === 'distribution' && (
                <p className="text-[#e5f2f4]/70 text-xs mt-1">Select target tenants for distribution</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-[#e5f2f4] border-b border-[#e5f2f4] px-6 py-3">
          <p className="text-sm text-[#092E3F]">
            <span className="font-bold">{enabledCount}</span>
            <span className="text-[#092E3F]/60"> of </span>
            <span className="font-bold">{totalCount}</span>
            <span className="text-[#092E3F]/60">{mode === 'distribution' ? ` target tenants selected (excluding ${sourceTenant?.name})` : ' clients enabled'}</span>
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin scrollbar-thumb-[#e5f2f4] scrollbar-track-transparent">

          {/* Rules Preview (Distribution Mode Only) */}
          {mode === 'distribution' && rules.length > 0 && (
            <div className="pb-4 border-b border-[#e5f2f4]">
              <h3 className="text-sm font-medium text-[#092E3F] mb-3">Rules to Distribute</h3>
              <div className="bg-[#f6f6f6] rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <Shield className="w-3 h-3 text-[#2A96A8] flex-shrink-0" />
                      <span className="text-[#092E3F] flex-1 truncate">{r.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        r.value === 'High' ? 'bg-red-50 text-red-600' :
                        r.value === 'Medium' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {r.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Sections (Single Rule Mode Only) */}
          {mode === 'single' && rule && (
            <div className="space-y-6">
              {/* Description Section */}
              <div>
                <button
                  onClick={() => toggleSection('description')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Description</h3>
                  </div>
                  {expandedSections.description ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.description && (
                  <div className="mb-6">
                    <p className="text-sm text-[#092E3F]/60 leading-relaxed">
                      {rule.description || 'This alert rule monitors for suspicious activity patterns that may indicate a security threat. It analyzes log data to detect anomalies and potential security incidents requiring investigation.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Attention & Action Section */}
              <div>
                <button
                  onClick={() => toggleSection('attentionAction')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Attention & Action</h3>
                  </div>
                  {expandedSections.attentionAction ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.attentionAction && (
                  <div className="mb-6">
                    {(() => {
                      const queue = getAttentionQueue(rule);
                      if (queue.length === 1) {
                        return (
                          <div className="flex items-center gap-3 bg-[#f6f6f6] rounded-lg p-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[#092E3F]/60 mb-1">Attention</div>
                              <span className="inline-block px-2 py-1 rounded-[4px] text-xs font-medium bg-[#eef1f3] text-[#092E3F]/80">
                                {queue[0].attention}
                              </span>
                            </div>
                            {onAction ? (
                              <button
                                onClick={() => onAction(queue[0])}
                                className="px-4 py-2 rounded-[4px] text-xs font-medium whitespace-nowrap transition-colors bg-white border border-[#c9d6dc] text-[#092E3F] shadow-[0_1px_1px_rgba(9,46,63,0.05)] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white flex items-center gap-1.5 shrink-0"
                              >
                                {queue[0].action}
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="inline-block px-2 py-1 rounded-[4px] text-xs font-medium bg-[#e5f2f4] text-[#1e7d8f] shrink-0">
                                {queue[0].action}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="bg-[#f6f6f6] rounded-lg p-3 space-y-2">
                          <div className="text-xs text-[#092E3F]/60 mb-1">
                            This rule needs {queue.length} actions — resolve in priority order
                          </div>
                          {queue.map((q, i) => (
                            <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-[4px] bg-white border ${
                              i === 0 ? 'border-[#2A96A8]/40' : 'border-[#e5f2f4]'
                            }`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                i === 0 ? 'bg-[#092E3F] text-white' : 'bg-[#e5f2f4] text-[#6b828c]'
                              }`}>{i + 1}</span>
                              <span className="text-xs text-[#092E3F] flex-1">
                                {q.attention}
                                {i === 0 && (
                                  <span className="ml-2 text-[9px] font-semibold uppercase tracking-wide text-[#2A96A8]">Recommended first</span>
                                )}
                              </span>
                              {onAction ? (
                                <button
                                  onClick={() => onAction(q)}
                                  className={`px-3 py-1.5 rounded-[4px] text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
                                    i === 0
                                      ? 'bg-[#092E3F] text-white hover:bg-[#092E3F]/90'
                                      : 'bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white'
                                  }`}
                                >
                                  {q.action}
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                                  i === 0 ? 'bg-[#e5f2f4] text-[#1e7d8f]' : 'bg-[#eef1f3] text-[#6b828c]'
                                }`}>{q.action}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Matrix Value Section */}
              <div>
                <button
                  onClick={() => toggleSection('valueMatrix')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Value Matrix & Explanation</h3>
                  </div>
                  {expandedSections.valueMatrix ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.valueMatrix && (
                  <div className="mb-6 space-y-4">
                    {/* Overall Value */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs font-light text-[#092E3F] uppercase">Overall Value: </span>
                          <span className={`text-xs font-black uppercase ${
                            getMatrixValue(matrixPosition.gain, matrixPosition.cost) === 'H' ? 'text-[#76ba3b]' :
                            getMatrixValue(matrixPosition.gain, matrixPosition.cost) === 'M' ? 'text-[#e0a800]' :
                            'text-[#6b828c]'
                          }`}>
                            {getMatrixValue(matrixPosition.gain, matrixPosition.cost) === 'H' ? 'High' : getMatrixValue(matrixPosition.gain, matrixPosition.cost) === 'M' ? 'Medium' : 'Low'}
                          </span>
                        </div>
                        <button
                          onClick={handleResetMatrix}
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
                          {(['high', 'med', 'low'] as const).map((gain) => (
                            <div key={gain} className="grid grid-cols-3 gap-0">
                              {(['low', 'med', 'high'] as const).map((cost) => (
                                <button
                                  key={cost}
                                  onClick={() => handleMatrixCellClick(gain, cost)}
                                  className={`${getMatrixColor(getMatrixValue(gain, cost))} relative transition-all hover:opacity-80`}
                                >
                                  {isSelectedCell(gain, cost) && (
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-[#092E3F]">Value Explanation</div>
                        {!isEditingExplanation ? (
                          <button
                            onClick={() => setIsEditingExplanation(true)}
                            className="px-2 py-1 bg-[#2A96A8] text-white rounded text-[10px] hover:bg-[#237f8e] transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setIsEditingExplanation(false)}
                              className="px-2 py-1 border border-[#e5f2f4] text-[#6b828c] rounded text-[10px] hover:bg-[#f6f6f6] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveExplanation}
                              className="px-2 py-1 bg-[#2A96A8] text-white rounded text-[10px] hover:bg-[#237f8e] transition-colors flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditingExplanation ? (
                        <textarea
                          value={valueExplanation}
                          onChange={(e) => setValueExplanation(e.target.value)}
                          className="w-full p-2 text-sm text-[#092E3F] border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/50 focus:border-[#2A96A8]"
                          rows={3}
                          style={{ resize: 'vertical' }}
                        />
                      ) : (
                        <p className="text-sm text-[#092E3F]/60 leading-relaxed">
                          {valueExplanation}
                        </p>
                      )}
                    </div>

                    {/* Align Across All Customers Button */}
                    <button
                      onClick={handleAlignAcrossCustomers}
                      className="w-full px-4 py-2.5 bg-[#092e3f] hover:bg-[#092e3f]/90 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Align Across All Customers
                    </button>

                    {/* Version Misalignment Section */}
                    {hasVersionMisalignment && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                          <h4 className="text-sm font-medium text-orange-900">Version Misalignment Detected</h4>
                        </div>
                        <p className="text-xs text-orange-800">
                          Multiple versions of this rule are deployed across clients. Review the KQL queries below:
                        </p>
                        <div className="space-y-3">
                          {versionVariants.map((variant, idx) => (
                            <div key={idx} className="bg-white border border-orange-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-[#092E3F]">Version {variant.version}</span>
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded-full">
                                    {variant.clientCount} clients
                                  </span>
                                </div>
                              </div>
                              <div className="text-[10px] text-gray-600 mb-2 flex flex-wrap gap-1">
                                {variant.clients.map((client, cidx) => (
                                  <span key={cidx} className="px-1.5 py-0.5 bg-gray-100 rounded">
                                    {client}
                                  </span>
                                ))}
                              </div>
                              <textarea
                                value={variant.kqlQuery}
                                readOnly
                                className="w-full h-32 p-2 font-mono text-[10px] bg-gray-900 text-green-400 rounded border border-gray-700 focus:outline-none"
                                style={{ resize: 'vertical' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Basic Information Section */}
              <div>
                <button
                  onClick={() => toggleSection('basicInfo')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Basic Information</h3>
                  </div>
                  {expandedSections.basicInfo ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.basicInfo && (
                  <div className="mb-6">
                    <div className="grid grid-cols-2 gap-3">
                  {/* State */}
                  <div className="bg-[#f6f6f6] rounded-lg p-3">
                    <div className="text-xs text-[#092E3F]/60 mb-1">State</div>
                    <div className="flex items-center gap-2">
                      {rule.state === 'Enabled' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-[#6b828c]/60" />
                      )}
                      <span className={`text-sm font-medium ${
                        rule.state === 'Enabled' ? 'text-green-700' : 'text-gray-600'
                      }`}>
                        {rule.state}
                      </span>
                    </div>
                  </div>

                  {/* Version */}
                  <div className="bg-[#f6f6f6] rounded-lg p-3">
                    <div className="text-xs text-[#092E3F]/60 mb-1">Version</div>
                    <div className="text-sm font-medium text-[#092E3F]">{rule.version}</div>
                  </div>

                  {/* Author */}
                  <div className="bg-[#f6f6f6] rounded-lg p-3">
                    <div className="text-xs text-[#092E3F]/60 mb-1">Author</div>
                    <div className="flex items-center gap-2">
                      {rule.author === 'Microsoft' ? (
                        <Shield className="w-4 h-4 text-blue-600" />
                      ) : rule.author === 'Seculyze' ? (
                        <div className="w-4 h-4 rounded-full bg-[#2A96A8] flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">S</span>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">C</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-[#092E3F]">
                        {rule.author === 'Custom' ? 'Company Name' : rule.author}
                      </span>
                    </div>
                  </div>

                  {/* Clients Applied */}
                  <div className="bg-[#f6f6f6] rounded-lg p-3">
                    <div className="text-xs text-[#092E3F]/60 mb-1">Clients Applied</div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-[#092E3F]">{rule.clientsApplied}</span>
                    </div>
                  </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Log Sources Section */}
              <div>
                <button
                  onClick={() => toggleSection('logSources')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Log Sources</h3>
                  </div>
                  {expandedSections.logSources ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.logSources && (
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {rule.logSources.map((source, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MITRE Tactics Section */}
              <div>
                <button
                  onClick={() => toggleSection('mitre')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#092E3F]" />
                    <h3 className="text-lg text-[#092E3F]">MITRE ATT&CK Tactics</h3>
                  </div>
                  {expandedSections.mitre ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.mitre && (
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {rule.mitre.map((tactic, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                          {tactic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Query Section */}
              <div>
                <button
                  onClick={() => toggleSection('query')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">KQL Query</h3>
                  </div>
                  {expandedSections.query ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.query && (
                  <div className="mb-6">
                    <div className="flex items-center justify-end mb-3">
                      {!isEditingQuery ? (
                        <button
                          onClick={() => setIsEditingQuery(true)}
                          className="px-3 py-1.5 bg-[#2A96A8] text-white rounded-lg text-xs font-medium hover:bg-[#237f8e] transition-colors flex items-center gap-2"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit Query
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditingQuery(false)}
                            className="px-3 py-1.5 border border-[#e5f2f4] text-[#6b828c] rounded-lg text-xs font-medium hover:bg-[#f6f6f6] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveQuery}
                            className="px-3 py-1.5 bg-[#2A96A8] text-white rounded-lg text-xs font-medium hover:bg-[#237f8e] transition-colors flex items-center gap-2"
                          >
                            <Save className="w-3 h-3" />
                            Save Query
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <textarea
                        value={kqlQuery}
                        onChange={(e) => setKqlQuery(e.target.value)}
                        readOnly={!isEditingQuery}
                        className={`w-full h-64 p-4 font-mono text-xs bg-gray-900 text-green-400 rounded-lg border ${
                          isEditingQuery ? 'border-[#2A96A8]' : 'border-gray-700'
                        } focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/50`}
                        style={{ resize: 'vertical' }}
                      />
                      {!isEditingQuery && (
                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-1 bg-gray-700 text-[#d6d6d6] rounded text-[10px]">
                            <Eye className="w-3 h-3 inline mr-1" />
                            Read-only
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Changelog Section */}
              <div>
                <button
                  onClick={() => toggleSection('changelog')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Change History</h3>
                  </div>
                  {expandedSections.changelog ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.changelog && (
                  <div className="mb-6">
                    <div className="space-y-3">
                      {changelog.map((entry) => (
                        <div key={entry.id} className="bg-[#f6f6f6] rounded-lg p-4 border-l-2 border-[#2A96A8]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-[#2A96A8] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {entry.user.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-[#092E3F]">{entry.user}</div>
                                <div className="text-xs text-[#6b828c]">{entry.timestamp}</div>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-[#092E3F]/80 pl-10">{entry.changes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <button
                  onClick={() => toggleSection('comments')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Comments</h3>
                    <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-full">
                      {comments.length}
                    </span>
                  </div>
                  {expandedSections.comments ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.comments && (
                  <div className="mb-6">
                    {/* Add Comment */}
                    <div className="bg-[#f6f6f6] rounded-lg p-4 mb-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full p-3 border border-[#e5f2f4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] resize-none bg-[#f6f6f6]"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          className="px-4 py-2 bg-[#092e3f] hover:bg-[#092e3f]/90 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Add Comment
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className="bg-white border border-[#e5f2f4] rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[#2A96A8] to-[#1d7080] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {comment.user.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-medium text-[#092E3F]">{comment.user}</span>
                                <span className="text-xs text-[#6b828c]">{comment.timestamp}</span>
                              </div>
                              <p className="text-sm text-[#092E3F]/80 leading-relaxed">{comment.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Clients Section */}
              <div>
                <button
                  onClick={() => toggleSection('clients')}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#2A96A8]" />
                    <h3 className="text-lg text-[#092E3F]">Clients</h3>
                    <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-full">
                      {totalCount}
                    </span>
                  </div>
                  {expandedSections.clients ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                  )}
                </button>
                {expandedSections.clients && (
                  <div className="mb-6 space-y-4">
                    {/* Apply to All Clients */}
                    <div className="pb-4 border-b border-[#e5f2f4]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-[#092E3F] mb-1">Apply to All Clients</h3>
                          <p className="text-xs text-[#092E3F]/60">
                            Enable or disable across all {totalCount} clients
                          </p>
                        </div>
                        <button
                          onClick={handleApplyAll}
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

                    {/* Individual Clients */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-[#092E3F]">Individual Clients</h3>
                        <p className="text-xs text-[#092E3F]/60">
                          Showing {filteredClients.length} • {filteredClients.filter(c => c.enabled).length} enabled
                        </p>
                      </div>

                {/* Filter Tabs */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'all'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('enabled')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'enabled'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    Enabled ({enabledCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('disabled')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'disabled'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    Disabled ({totalCount - enabledCount})
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-[#f6f6f6] border border-[#e5f2f4] rounded text-xs text-[#092E3F] placeholder:text-[#979394] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all"
                  />
                </div>

                {/* Client List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-[#f6f6f6] hover:bg-[#e5f2f4]/30 rounded-lg transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#092E3F]">{client.name}</span>
                          <span className="px-2 py-0.5 bg-[#e5f2f4] text-[#6b828c] text-[10px] rounded-full">
                            {client.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-[#6b828c]">
                          <span>FP Rate: <span className={`font-medium ${
                            parseFloat(client.fpRate || '0') > 4 ? 'text-red-500' : 'text-green-600'
                          }`}>{client.fpRate}</span></span>
                          <span>Score: <span className={`font-medium ${
                            (client.score || 0) > 90 ? 'text-green-600' : 'text-orange-500'
                          }`}>{client.score}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleClient(client.id)}
                        className={`relative inline-block w-12 h-6 transition-colors rounded-full ${
                          client.enabled ? 'bg-[#4caf50]' : 'bg-[#e5f2f4]'
                        }`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          client.enabled ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}

                  {filteredClients.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-[#d6d6d6] mx-auto mb-3" />
                      <p className="text-sm text-[#6b828c]">No clients found</p>
                      <p className="text-xs text-[#6b828c]/60 mt-1">Try adjusting your filters</p>
                    </div>
                  )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Distribution Mode Content */}
          {mode === 'distribution' && (
            <>
              {/* Apply to All Clients */}
              <div className="pb-4 border-b border-[#e5f2f4]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[#092E3F] mb-1">Select All Tenants</h3>
                    <p className="text-xs text-[#092E3F]/60">
                      Select or deselect all {totalCount} target tenants
                    </p>
                  </div>
                  <button
                    onClick={handleApplyAll}
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

              {/* Individual Clients */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[#092E3F]">Individual Clients</h3>
                  <p className="text-xs text-[#092E3F]/60">
                    Showing {filteredClients.length} • {filteredClients.filter(c => c.enabled).length} enabled
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'all'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('enabled')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'enabled'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    Enabled ({enabledCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('disabled')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      filterTab === 'disabled'
                        ? 'bg-[#092E3F] text-white'
                        : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#d0e8ec]'
                    }`}
                  >
                    Disabled ({totalCount - enabledCount})
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-[#f6f6f6] border border-[#e5f2f4] rounded text-xs text-[#092E3F] placeholder:text-[#979394] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all"
                  />
                </div>

                {/* Client List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 bg-[#f6f6f6] hover:bg-[#e5f2f4]/30 rounded-lg transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#092E3F]">{client.name}</span>
                          <span className="px-2 py-0.5 bg-[#e5f2f4] text-[#6b828c] text-[10px] rounded-full">
                            {client.level}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-[#6b828c]">
                          <span>FP Rate: <span className={`font-medium ${
                            parseFloat(client.fpRate || '0') > 4 ? 'text-red-500' : 'text-green-600'
                          }`}>{client.fpRate}</span></span>
                          <span>Score: <span className={`font-medium ${
                            (client.score || 0) > 90 ? 'text-green-600' : 'text-orange-500'
                          }`}>{client.score}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleClient(client.id)}
                        className={`relative inline-block w-12 h-6 transition-colors rounded-full ${
                          client.enabled ? 'bg-[#4caf50]' : 'bg-[#e5f2f4]'
                        }`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          client.enabled ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  ))}

                  {filteredClients.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-[#d6d6d6] mx-auto mb-3" />
                      <p className="text-sm text-[#6b828c]">No clients found</p>
                      <p className="text-xs text-[#6b828c]/60 mt-1">Try adjusting your filters</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors"
            >
              {mode === 'single' ? 'Close' : 'Cancel'}
            </button>
            <div className="flex items-center gap-2">
              {(mode === 'distribution' || (mode === 'single' && expandedSections.clients)) && (
                <button
                  onClick={() => {
                    if (mode === 'distribution') {
                      if (enabledCount === 0) {
                        toast.error('Please select at least one target tenant');
                        return;
                      }
                      const selectedClientIds = clients.filter(c => c.enabled).map(c => c.id);
                      onDistribute?.(selectedClientIds);
                      toast.success(
                        `Distributing ${rules.length} rule${rules.length !== 1 ? 's' : ''} to ${enabledCount} tenant${enabledCount !== 1 ? 's' : ''}`
                      );
                    } else {
                      toast.success(`Applied changes to ${enabledCount} clients`);
                    }
                    onClose();
                  }}
                  disabled={mode === 'distribution' && enabledCount === 0}
                  className={`px-6 py-2 rounded-[4px] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
                    mode === 'single' && onAction && rule
                      ? 'bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#f6f6f6]'
                      : 'bg-[#092e3f] hover:bg-[#092e3f]/90 text-white'
                  }`}
                >
                  {mode === 'distribution' && <ArrowRight className="w-4 h-4" />}
                  {mode === 'distribution' ? 'Distribute Alert Rules' : 'Apply Changes'}
                </button>
              )}
              {/* Primary recommended action — the same flow the table action button opens */}
              {mode === 'single' && onAction && rule && (() => {
                const primary = getAttentionQueue(rule)[0];
                return (
                  <button
                    onClick={() => onAction(primary)}
                    className="px-6 py-2 bg-[#092e3f] hover:bg-[#092e3f]/90 text-white rounded-[4px] text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {primary.action}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}