import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import {  
  PiggyBank,
  Search, 
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Scale,
  Database,
  Settings,
  Gauge,
  Filter,
  X,
  Zap,
  BookMarked,
  Plus,
  Pencil,
  Trash2,
  Users,
  PlayCircle,
  Check,
  Package,
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_TH_INTERACTIVE, TABLE_BODY, TABLE_ROW, TABLE_TD } from './tableStyles';

// Speedometer Gauge Component
const SpeedometerGauge = ({ 
  current, 
  max, 
  label 
}: { 
  current: number; 
  max: number; 
  label: string;
}) => {
  const percentage = (current / max) * 100;
  const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees
  
  // Determine color based on percentage
  const getColor = () => {
    if (percentage >= 80) return '#10b981'; // emerald-500
    if (percentage >= 60) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };
  
  const color = getColor();
  
  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110" className="overflow-visible">
        {/* Background arc - gray */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="16"
          strokeLinecap="round"
        />
        
        {/* Progress arc - colored based on score */}
        <path
          d="M 20 90 A 70 70 0 0 1 160 90"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * 220} 220`}
          className="transition-all duration-1000"
        />
        
        {/* Needle/Indicator */}
        <g transform={`rotate(${angle} 90 90)`}>
          <line
            x1="90"
            y1="90"
            x2="90"
            y2="35"
            stroke="#092E3F"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="90" cy="90" r="6" fill="#092E3F" />
        </g>
        
        {/* Center circle for score display */}
        <circle cx="90" cy="90" r="4" fill="white" stroke="#092E3F" strokeWidth="2" />
      </svg>
      
      <div className="text-center -mt-2">
        <div className="text-2xl font-semibold text-[#092E3F]">
          {current.toFixed(2)}
          <span className="text-lg text-[#092E3F]/40">/{max}</span>
        </div>
        <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mt-1">
          {label}
        </div>
      </div>
    </div>
  );
};

type AttentionItem = {
  label: string;
  priority: number; // 1 = High Value Log Source, 2 = Low Value Log Source, 3 = Outdated Alert Rules
};

type CostFilter = {
  id: string;
  source: string;   // the Sentinel table it applies to
  title: string;
  kql: string;
  saving: number;   // $/mo this one alone unlocks
};

// Realistic recommendations drawn from the same corpus Data Collection uses, so
// the two pages tell one story.
const COST_FILTER_POOL: Omit<CostFilter, 'id' | 'saving'>[] = [
  { source: 'SecurityEvent', title: 'Exclude EventID 4688 from workstation endpoints', kql: 'SecurityEvent | where not(EventID == 4688 and Computer startswith "WKS-")' },
  { source: 'CommonSecurityLog', title: 'Drop allowed traffic to internal DNS resolvers', kql: 'CommonSecurityLog | where not(DeviceAction == "allow" and DestinationIP in ("10.4.0.10","10.4.0.11"))' },
  { source: 'SecurityEvent', title: 'Drop 5156 Filtering Platform connection events', kql: 'SecurityEvent | where EventID != 5156' },
  { source: 'Syslog', title: 'Exclude facility cron at severity info', kql: 'Syslog | where not(Facility == "cron" and SeverityLevel == "info")' },
  { source: 'Perf', title: 'Exclude counters sampled more often than 60s', kql: 'Perf | where not(CounterName in ("% Processor Time","Available MBytes") and SampleInterval < 60s)' },
  { source: 'AzureDiagnostics', title: 'Exclude Key Vault SecretGet by managed identities', kql: 'AzureDiagnostics | where not(OperationName == "SecretGet" and identity_claim_appid_g != "")' },
  { source: 'OfficeActivity', title: 'Exclude SharePoint FileAccessed events', kql: 'OfficeActivity | where Operation != "FileAccessed"' },
  { source: 'SecurityEvent', title: 'Exclude 4634 logoff events from service accounts', kql: 'SecurityEvent | where not(EventID == 4634 and Account endswith "$")' },
  { source: 'CommonSecurityLog', title: 'Exclude traffic logs under 1 KB', kql: 'CommonSecurityLog | where not(Activity == "TRAFFIC" and toint(SentBytes) < 1024)' },
  { source: 'AzureDiagnostics', title: 'Drop Load Balancer probe health events', kql: 'AzureDiagnostics | where Category != "LoadBalancerProbeHealthStatus"' },
  { source: 'SigninLogs', title: 'Exclude sign-ins from trusted named locations', kql: 'SigninLogs | where not(ResultType == 0 and NetworkLocationDetails has "trustedNamedLocation")' },
];

// Split a tenant's total saving across its filters, biggest win first, with the
// last one taking the remainder so the parts always sum to the whole.
function buildCostFilters(clientId: string, count: number, total: number): CostFilter[] {
  const weights = Array.from({ length: count }, (_, i) => count - i);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  return Array.from({ length: count }, (_, i) => {
    const saving = i === count - 1
      ? total - allocated
      : Math.round((total * weights[i]) / weightSum / 10) * 10;
    allocated += saving;
    return { id: `${clientId}-cf${i + 1}`, ...COST_FILTER_POOL[i % COST_FILTER_POOL.length], saving };
  });
}

// openFilters and monthlySaving are derived, never typed in — the list is the
// only source of truth.
function costBlock(
  clientId: string,
  current: number,
  status: 'good' | 'warning' | 'bad',
  count: number,
  total: number
) {
  const filters = buildCostFilters(clientId, count, total);
  return {
    current, max: 50, status, filters,
    openFilters: filters.length,
    monthlySaving: filters.reduce((sum, f) => sum + f.saving, 0),
  };
}

// Tenant accordions over the same filter rows the per-client modal uses, so
// picking works identically whether you calibrate one tenant or all of them.
function CostFilterPicker({ clients, selected, onToggle, onToggleAll, expanded, onExpand }: {
  clients: ClientCalibration[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  expanded: string[];
  onExpand: (id: string) => void;
}) {
  if (clients.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[#092E3F]/50">
        Every identified saving has already been applied.
      </p>
    );
  }
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
      {clients.map(client => {
        const ids = client.cost.filters.map(f => f.id);
        const picked = ids.filter(id => selected.includes(id));
        const saving = client.cost.filters
          .filter(f => selected.includes(f.id))
          .reduce((sum, f) => sum + f.saving, 0);
        const open = expanded.includes(client.id);
        const allOn = picked.length === ids.length;
        return (
          <div key={client.id}>
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={allOn}
                ref={el => { if (el) el.indeterminate = picked.length > 0 && !allOn; }}
                onChange={() => onToggleAll(ids, !allOn)}
                onClick={e => e.stopPropagation()}
                className="w-4 h-4 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
              />
              <button
                onClick={() => onExpand(client.id)}
                className="flex-1 flex items-center gap-3 min-w-0 text-left"
              >
                {open
                  ? <ChevronUp className="w-4 h-4 text-[#092E3F]/40 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-[#092E3F]/40 shrink-0" />}
                <img src={client.clientLogo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                <span className="text-sm text-[#092E3F] truncate">{client.clientName}</span>
                <div className="flex-1" />
                <span className="text-xs text-[#092E3F]/50 whitespace-nowrap">
                  {picked.length} of {ids.length}
                </span>
                <span className="text-sm text-[#2f7d52] w-[104px] text-right whitespace-nowrap">
                  +${saving.toLocaleString('en-US')}/mo
                </span>
                <span className="text-xs text-[#092E3F]/50 w-[86px] text-right whitespace-nowrap">
                  {client.cost.current} &rarr; {allOn ? client.cost.max : '…'}
                </span>
              </button>
            </div>

            {open && (
              <div className="bg-gray-50/70 divide-y divide-gray-100 border-t border-gray-100">
                {client.cost.filters.map(f => {
                  const on = selected.includes(f.id);
                  return (
                    <label key={f.id} className="flex items-start gap-3 pl-12 pr-4 py-2.5 cursor-pointer hover:bg-gray-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(f.id)}
                        className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
                      />
                      <span className={`flex-1 min-w-0 ${on ? '' : 'opacity-50'}`}>
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-[#092E3F]">{f.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-200 text-[#092E3F]/60">{f.source}</span>
                        </span>
                        <span className="block font-mono text-[11px] text-[#092E3F]/50 mt-0.5 truncate">{f.kql}</span>
                      </span>
                      <span className={`text-sm text-[#2f7d52] whitespace-nowrap shrink-0 ${on ? '' : 'opacity-40'}`}>
                        +${f.saving.toLocaleString('en-US')}/mo
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type ClientCalibration = {
  id: string;
  clientName: string;
  clientLogo: string;
  tenantUrl: string;
  overallScore: {
    current: number;
    max: number;
    status: 'good' | 'warning' | 'bad';
  };
  alertRules: {
    current: number;
    max: number;
    status: 'good' | 'warning' | 'bad';
  };
  logSources: {
    current: number;
    max: number;
    status: 'good' | 'warning' | 'bad';
  };
  configurations: {
    current: number;
    max: number;
    status: 'good' | 'warning' | 'bad';
  };
  // How well this tenant's data collection rules are tuned — the share of the
  // savings Cost has already identified that has actually been applied. It sits
  // in Calibrate because an unapplied filter is a configuration deficiency, not
  // a billing number.
  cost: {
    current: number;
    max: number;
    status: 'good' | 'warning' | 'bad';
    filters: CostFilter[];  // the individual recommendations, still unapplied
    openFilters: number;    // = filters.length
    monthlySaving: number;  // = sum of their savings
  };
  attentions: AttentionItem[];
};

const mockClients: ClientCalibration[] = [
  {
    id: '1',
    clientName: 'Nike Inc.',
    clientLogo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop',
    tenantUrl: 'https://nike.sentinel.microsoft.com/logsources',
    overallScore: { current: 197, max: 250, status: 'warning' },
    alertRules: { current: 73, max: 100, status: 'warning' },
    logSources: { current: 75, max: 80, status: 'good' },
    configurations: { current: 18, max: 20, status: 'good' },
    cost: costBlock('1', 31, 'warning', 6, 9400),
    attentions: [
      { label: 'High Value Log Source Disabled', priority: 1 },
      { label: 'Outdated Alert Rules', priority: 3 }
    ]
  },
  {
    id: '2',
    clientName: 'Adidas',
    clientLogo: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=100&h=100&fit=crop',
    tenantUrl: 'https://adidas.sentinel.microsoft.com/logsources',
    overallScore: { current: 157, max: 250, status: 'warning' },
    alertRules: { current: 58, max: 100, status: 'warning' },
    logSources: { current: 62, max: 80, status: 'good' },
    configurations: { current: 15, max: 20, status: 'good' },
    cost: costBlock('2', 22, 'bad', 10, 17880),
    attentions: [
      { label: 'High Value Log Source Enabled', priority: 1 },
      { label: 'Low Value Log Source Disabled', priority: 2 }
    ]
  },
  {
    id: '3',
    clientName: 'Puma',
    clientLogo: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=100&h=100&fit=crop',
    tenantUrl: 'https://puma.sentinel.microsoft.com/logsources',
    overallScore: { current: 238, max: 250, status: 'good' },
    alertRules: { current: 95, max: 100, status: 'good' },
    logSources: { current: 78, max: 80, status: 'good' },
    configurations: { current: 19, max: 20, status: 'good' },
    cost: costBlock('3', 46, 'good', 1, 780),
    attentions: [
      { label: 'High Value Log Source Disabled', priority: 1 },
      { label: 'Low Value Log Source Enabled', priority: 2 },
      { label: 'Outdated Alert Rules', priority: 3 }
    ]
  },
  {
    id: '4',
    clientName: 'Under Armour',
    clientLogo: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=100&h=100&fit=crop',
    tenantUrl: 'https://underarmour.sentinel.microsoft.com/logsources',
    overallScore: { current: 190, max: 250, status: 'warning' },
    alertRules: { current: 68, max: 100, status: 'warning' },
    logSources: { current: 70, max: 80, status: 'good' },
    configurations: { current: 18, max: 20, status: 'good' },
    cost: costBlock('4', 34, 'warning', 5, 6200),
    attentions: [
      { label: 'Low Value Log Source Disabled', priority: 2 },
      { label: 'Outdated Alert Rules', priority: 3 }
    ]
  },
  {
    id: '5',
    clientName: 'Reebok',
    clientLogo: 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=100&h=100&fit=crop',
    tenantUrl: 'https://reebok.sentinel.microsoft.com/logsources',
    overallScore: { current: 231, max: 250, status: 'good' },
    alertRules: { current: 92, max: 100, status: 'good' },
    logSources: { current: 76, max: 80, status: 'good' },
    configurations: { current: 20, max: 20, status: 'good' },
    cost: costBlock('5', 43, 'good', 2, 1940),
    attentions: []
  },
  {
    id: '6',
    clientName: 'New Balance',
    clientLogo: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=100&h=100&fit=crop',
    tenantUrl: 'https://newbalance.sentinel.microsoft.com/logsources',
    overallScore: { current: 153, max: 250, status: 'warning' },
    alertRules: { current: 52, max: 100, status: 'warning' },
    logSources: { current: 65, max: 80, status: 'good' },
    configurations: { current: 17, max: 20, status: 'good' },
    cost: costBlock('6', 19, 'bad', 11, 21300),
    attentions: [
      { label: 'High Value Log Source Disabled', priority: 1 },
      { label: 'Low Value Log Source Enabled', priority: 2 },
      { label: 'Outdated Alert Rules', priority: 3 }
    ]
  },
  {
    id: '7',
    clientName: 'Asics',
    clientLogo: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=100&h=100&fit=crop',
    tenantUrl: 'https://asics.sentinel.microsoft.com/logsources',
    overallScore: { current: 210, max: 250, status: 'good' },
    alertRules: { current: 85, max: 100, status: 'good' },
    logSources: { current: 72, max: 80, status: 'good' },
    configurations: { current: 15, max: 20, status: 'good' },
    cost: costBlock('7', 38, 'warning', 4, 4600),
    attentions: [
      { label: 'High Value Log Source Disabled', priority: 1 }
    ]
  },
  {
    id: '8',
    clientName: 'Converse',
    clientLogo: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=100&h=100&fit=crop',
    tenantUrl: 'https://converse.sentinel.microsoft.com/logsources',
    overallScore: { current: 194, max: 250, status: 'warning' },
    alertRules: { current: 78, max: 100, status: 'warning' },
    logSources: { current: 68, max: 80, status: 'good' },
    configurations: { current: 19, max: 20, status: 'good' },
    cost: costBlock('8', 29, 'bad', 7, 11750),
    attentions: [
      { label: 'Low Value Log Source Disabled', priority: 2 }
    ]
  },
  {
    id: '9',
    clientName: 'Vans',
    clientLogo: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=100&h=100&fit=crop',
    tenantUrl: 'https://vans.sentinel.microsoft.com/logsources',
    overallScore: { current: 216, max: 250, status: 'good' },
    alertRules: { current: 100, max: 100, status: 'good' },
    logSources: { current: 60, max: 80, status: 'warning' },
    configurations: { current: 15, max: 20, status: 'good' },
    cost: costBlock('9', 41, 'good', 3, 2850),
    attentions: []
  }
];

type SortField = 'clientName' | 'overallScore' | 'alertRules' | 'logSources' | 'configurations' | 'cost' | 'attention';
type SortDirection = 'asc' | 'desc' | null;

// ── Presets ────────────────────────────────────────────────────────────────
type ClientPreset = {
  id: string;
  name: string;
  description: string;
  clientIds: string[];
  createdAt: string;
};

// Use a consistent teal color scheme for all presets
const PRESET_COLORS = { 
  bg: 'bg-teal-50', 
  text: 'text-teal-700', 
  border: 'border-teal-200', 
  dot: 'bg-teal-500' 
};

const initialPresets: ClientPreset[] = [
  {
    id: 'p1',
    name: 'High Priority',
    description: 'Clients with critical attentions requiring immediate action',
    clientIds: ['1', '4', '6'],
    createdAt: '2026-01-15',
  },
  {
    id: 'p2',
    name: 'Needs Attention',
    description: 'All clients with at least one open observation',
    clientIds: ['1', '2', '3', '4', '6', '7', '8'],
    createdAt: '2026-01-20',
  },
  {
    id: 'p3',
    name: 'Retail Leaders',
    description: 'Top-tier retail brand clients',
    clientIds: ['1', '2', '3'],
    createdAt: '2026-02-01',
  },
  {
    id: 'p4',
    name: 'Clean Sheet',
    description: 'Clients with no open observations',
    clientIds: ['5'],
    createdAt: '2026-02-10',
  },
];

// Mock alert rules data for pending changes
type AlertRuleChange = {
  id: string;
  name: string;
  currentStatus: string;
  newStatus: string;
  scoreImpact: number;
  packages?: string[]; // Optional: Content Hub packages required for this rule
};

const mockAlertRuleChanges: Record<'update' | 'enable' | 'disable', AlertRuleChange[]> = {
  update: [
    { id: '1', name: 'Brute Force Authentication Attempt', currentStatus: 'v1.2', newStatus: 'v2.1', scoreImpact: 0.4, packages: ['Azure AD Identity Protection', 'Microsoft Sentinel UEBA'] },
    { id: '2', name: 'Suspicious Login from Unknown Location', currentStatus: 'v1.0', newStatus: 'v2.0', scoreImpact: 0.3 },
    { id: '3', name: 'Multiple Failed Login Attempts', currentStatus: 'v1.5', newStatus: 'v2.1', scoreImpact: 0.35, packages: ['Azure AD Identity Protection'] },
    { id: '4', name: 'Privilege Escalation Detected', currentStatus: 'v1.1', newStatus: 'v2.0', scoreImpact: 0.32 },
    { id: '5', name: 'Unauthorized Access to Sensitive Data', currentStatus: 'v1.3', newStatus: 'v2.2', scoreImpact: 0.3, packages: ['Microsoft Defender for Cloud'] }
  ],
  enable: [
    { id: '6', name: 'SQL Injection Attempt Detected', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.7, packages: ['Web Application Firewall Analytics', 'Azure SQL Security'] },
    { id: '7', name: 'Cross-Site Scripting (XSS) Attack', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.65, packages: ['Web Application Firewall Analytics'] },
    { id: '8', name: 'DDoS Attack Pattern Identified', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.68, packages: ['Azure DDoS Protection', 'Network Security Analytics'] },
    { id: '9', name: 'Malware Download Attempt', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.72, packages: ['Microsoft Defender for Endpoint'] },
    { id: '10', name: 'Ransomware Activity Detected', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.75, packages: ['Microsoft Defender for Endpoint', 'Azure Storage Security'] },
    { id: '11', name: 'Phishing Email Detected', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.63 },
    { id: '12', name: 'Port Scanning Activity', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.61, packages: ['Network Security Analytics'] },
    { id: '13', name: 'Unusual Outbound Traffic', currentStatus: 'Disabled', newStatus: 'Enabled', scoreImpact: 0.69 }
  ],
  disable: [
    { id: '14', name: 'Low Priority File Access', currentStatus: 'Enabled', newStatus: 'Disabled', scoreImpact: 0.68 },
    { id: '15', name: 'Non-Critical System Warning', currentStatus: 'Enabled', newStatus: 'Disabled', scoreImpact: 0.66 },
    { id: '16', name: 'Routine Maintenance Alert', currentStatus: 'Enabled', newStatus: 'Disabled', scoreImpact: 0.67 }
  ]
};

// Helper to get color class for an attention label
const getAttentionColor = (label: string): string => {
  if (label.includes('High Value')) return 'bg-red-50 text-red-700';
  if (label.includes('Low Value')) return 'bg-amber-50 text-amber-700';
  if (label.includes('Outdated')) return 'bg-blue-50 text-blue-700';
  return 'bg-[#e5f2f4] text-[#092E3F]';
};

// Helper function to get action type from rule data
const getActionType = (rule: AlertRuleChange): 'update' | 'enable' | 'disable' => {
  if (rule.currentStatus.startsWith('v') && rule.newStatus.startsWith('v')) {
    return 'update';
  } else if (rule.currentStatus === 'Disabled' && rule.newStatus === 'Enabled') {
    return 'enable';
  } else if (rule.currentStatus === 'Enabled' && rule.newStatus === 'Disabled') {
    return 'disable';
  }
  return 'update';
};

export default function Calibrate() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [hoveredAttentionId, setHoveredAttentionId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [columnWidths, setColumnWidths] = useState({
    select: 48,
    clientName: 280,
    overallScore: 180,
    alertRules: 150,
    logSources: 150,
    configurations: 150,
    cost: 150,
    attention: 180,
    action: 180,
    more: 60
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // ── Presets state ──────────────────────────────────────────────────────
  const [presets, setPresets] = useState<ClientPreset[]>(initialPresets);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(false);
  const [isManagePresetsOpen, setIsManagePresetsOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const presetBtnRef = useRef<HTMLButtonElement>(null);
  const [presetPanelPos, setPresetPanelPos] = useState({ top: 0, left: 0 });
  const [presetDraft, setPresetDraft] = useState<{
    name: string;
    description: string;
    clientIds: string[];
  }>({ name: '', description: '', clientIds: [] });

  const activePreset = presets.find(p => p.id === activePresetId) ?? null;
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'update' | 'enable' | 'disable' | 'all' | 'cost' | null>(null);
  const [calibratingClient, setCalibratingClient] = useState<ClientCalibration | null>(null);
  // Which savings filters ride along with a calibration. Pre-selected like the
  // alert-rule changes, but individually removable — they delete data and the
  // rule changes do not, so "all or nothing" is the wrong granularity.
  const [selectedCostFilters, setSelectedCostFilters] = useState<string[]>([]);
  const [expandedCostTenants, setExpandedCostTenants] = useState<string[]>([]);
  const [costSectionOpen, setCostSectionOpen] = useState(false);
  const [selectedChanges, setSelectedChanges] = useState<string[]>([]);
  const [expandedClients, setExpandedClients] = useState<string[]>([]);
  const [packageBannerExpanded, setPackageBannerExpanded] = useState(false);
  const [packageBannerExpandedBulk, setPackageBannerExpandedBulk] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualModalType, setManualModalType] = useState<'enable' | 'disable' | null>(null);

  // Build grouped change sections for a single client based on its attentions
  const getClientChangeSections = (client: ClientCalibration): { type: 'enable' | 'disable' | 'update'; label: string; rules: AlertRuleChange[] }[] => {
    const sections: { type: 'enable' | 'disable' | 'update'; label: string; rules: AlertRuleChange[] }[] = [];
    const sorted = [...client.attentions].sort((a, b) => a.priority - b.priority);
    const seen = new Set<'enable' | 'disable' | 'update'>();
    sorted.forEach(att => {
      if (att.label.includes('Disabled') && !seen.has('enable')) {
        seen.add('enable');
        const sectionLabel = att.label.includes('High Value')
          ? 'Enable High Value Log Sources'
          : 'Enable Low Value Log Sources';
        sections.push({ type: 'enable', label: sectionLabel, rules: mockAlertRuleChanges.enable });
      } else if (att.label.includes('Enabled') && !seen.has('disable')) {
        seen.add('disable');
        const sectionLabel = att.label.includes('High Value')
          ? 'Disable High Value Log Sources'
          : 'Disable Low Value Log Sources';
        sections.push({ type: 'disable', label: sectionLabel, rules: mockAlertRuleChanges.disable });
      } else if (att.label.includes('Outdated') && !seen.has('update')) {
        seen.add('update');
        sections.push({ type: 'update', label: 'Update Alert Rules', rules: mockAlertRuleChanges.update });
      }
    });
    return sections;
  };

  // Get current changes based on modal type (bulk / all mode)
  const currentChanges = useMemo(() => {
    if (!modalType) return [];
    if (modalType === 'all') {
      return [
        ...mockAlertRuleChanges.update,
        ...mockAlertRuleChanges.enable,
        ...mockAlertRuleChanges.disable
      ];
    }
    // 'cost' applies savings filters, not alert-rule changes — there is no
    // entry for it in the rule set, and indexing blind returns undefined.
    if (modalType === 'cost') return [];
    return mockAlertRuleChanges[modalType];
  }, [modalType]);

  // Calculate average calibration scores across selected or all clients
  const averageScores = useMemo(() => {
    const clientsToAnalyze = clientFilter.length > 0 
      ? mockClients.filter(client => clientFilter.includes(client.id))
      : mockClients;
    
    const totalClients = clientsToAnalyze.length;
    
    if (totalClients === 0) {
      return {
        overall: { current: 0, max: 250, status: 'bad' as const },
        alertRules: { current: 0, max: 100, status: 'bad' as const },
        logSources: { current: 0, max: 80, status: 'bad' as const },
        configurations: { current: 0, max: 20, status: 'bad' as const },
        cost: { current: 0, max: 50, status: 'bad' as const, openFilters: 0, monthlySaving: 0 }
      };
    }
    
    const avgOverall = clientsToAnalyze.reduce((sum, client) => sum + client.overallScore.current, 0) / totalClients;
    const avgAlertRules = clientsToAnalyze.reduce((sum, client) => sum + client.alertRules.current, 0) / totalClients;
    const avgLogSources = clientsToAnalyze.reduce((sum, client) => sum + client.logSources.current, 0) / totalClients;
    const avgConfigurations = clientsToAnalyze.reduce((sum, client) => sum + client.configurations.current, 0) / totalClients;
    const avgCost = clientsToAnalyze.reduce((sum, client) => sum + client.cost.current, 0) / totalClients;
    // Filters and savings are totals across the selection, not averages — the
    // question is how much is on the table, not how much per tenant.
    const openFilters = clientsToAnalyze.reduce((sum, client) => sum + client.cost.openFilters, 0);
    const monthlySaving = clientsToAnalyze.reduce((sum, client) => sum + client.cost.monthlySaving, 0);
    
    // Determine status based on percentage
    const getStatus = (current: number, max: number): 'good' | 'warning' | 'bad' => {
      const percentage = (current / max) * 100;
      if (percentage >= 80) return 'good';
      if (percentage >= 60) return 'warning';
      return 'bad';
    };
    
    return {
      overall: { current: avgOverall, max: 250, status: getStatus(avgOverall, 250) },
      alertRules: { current: avgAlertRules, max: 100, status: getStatus(avgAlertRules, 100) },
      logSources: { current: avgLogSources, max: 80, status: getStatus(avgLogSources, 80) },
      configurations: { current: avgConfigurations, max: 20, status: getStatus(avgConfigurations, 20) },
      cost: { current: avgCost, max: 50, status: getStatus(avgCost, 50), openFilters, monthlySaving }
    };
  }, [clientFilter]);

  const handleMouseDown = (column: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = columnWidths[column as keyof typeof columnWidths];

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.pageX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [column]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedClients = useMemo(() => {
    let filtered = mockClients.filter(client => {
      const matchesSearch = client.clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPreset = activePresetId
        ? (presets.find(p => p.id === activePresetId)?.clientIds ?? []).includes(client.id)
        : true;
      return matchesSearch && matchesPreset;
    });

    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'clientName':
            aValue = a.clientName.toLowerCase();
            bValue = b.clientName.toLowerCase();
            break;
          case 'overallScore':
            aValue = a.overallScore.current / a.overallScore.max;
            bValue = b.overallScore.current / b.overallScore.max;
            break;
          case 'alertRules':
            aValue = a.alertRules.current / a.alertRules.max;
            bValue = b.alertRules.current / b.alertRules.max;
            break;
          case 'cost':
            aValue = a.cost.current / a.cost.max;
            bValue = b.cost.current / b.cost.max;
            break;
          case 'logSources':
            aValue = a.logSources.current / a.logSources.max;
            bValue = b.logSources.current / b.logSources.max;
            break;
          case 'configurations':
            aValue = a.configurations.current / a.configurations.max;
            bValue = b.configurations.current / b.configurations.max;
            break;
          case 'attention':
            aValue = a.attentions.length;
            bValue = b.attentions.length;
            break;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [searchQuery, sortField, sortDirection, activePresetId, presets]);

  const totalPages = Math.ceil(filteredAndSortedClients.length / itemsPerPage);
  const paginatedClients = filteredAndSortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectAll = () => {
    if (selectedClients.length === paginatedClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(paginatedClients.map(c => c.id));
    }
  };

  const handleSelectClient = (id: string) => {
    setSelectedClients(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const getScoreColor = (status: 'good' | 'warning' | 'bad') => {
    switch (status) {
      case 'good':
        return 'text-emerald-600 bg-emerald-50';
      case 'warning':
        return 'text-amber-600 bg-amber-50';
      case 'bad':
        return 'text-red-600 bg-red-50';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const currentRef = filterButtonRef.current;
    if (currentRef && isClientFilterOpen) {
      const rect = currentRef.getBoundingClientRect();
      setDropdownPosition({ 
        top: rect.bottom + 8, 
        right: window.innerWidth - rect.right 
      });
    }
  }, [isClientFilterOpen]);

  useEffect(() => {
    const ref = presetBtnRef.current;
    if (ref && isPresetPanelOpen) {
      const rect = ref.getBoundingClientRect();
      setPresetPanelPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [isPresetPanelOpen]);

  // Preset CRUD helpers
  const openCreatePreset = (fromClients?: string[]) => {
    setEditingPresetId(null);
    setIsCreatingPreset(true);
    setPresetDraft({ name: '', description: '', clientIds: fromClients ?? [] });
    setIsManagePresetsOpen(true);
    setIsPresetPanelOpen(false);
  };

  const openEditPreset = (preset: ClientPreset) => {
    setEditingPresetId(preset.id);
    setIsCreatingPreset(false);
    setPresetDraft({ name: preset.name, description: preset.description, clientIds: [...preset.clientIds] });
    setIsManagePresetsOpen(true);
    setIsPresetPanelOpen(false);
  };

  const savePreset = () => {
    if (!presetDraft.name.trim()) { toast.error('Preset name is required'); return; }
    if (presetDraft.clientIds.length === 0) { toast.error('Select at least one client'); return; }
    if (editingPresetId) {
      setPresets(prev => prev.map(p => p.id === editingPresetId ? { ...p, ...presetDraft } : p));
      toast.success(`Preset "${presetDraft.name}" updated`);
    } else {
      const newPreset: ClientPreset = {
        id: `p${Date.now()}`,
        ...presetDraft,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setPresets(prev => [...prev, newPreset]);
      setActivePresetId(newPreset.id);
      toast.success(`Preset "${presetDraft.name}" created`);
    }
    setIsManagePresetsOpen(false);
    setEditingPresetId(null);
    setIsCreatingPreset(false);
  };

  const deletePreset = (id: string) => {
    const preset = presets.find(p => p.id === id);
    setPresets(prev => prev.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
    toast.success(`Preset "${preset?.name}" deleted`);
    if (editingPresetId === id) {
      setIsCreatingPreset(false);
      setEditingPresetId(null);
    }
  };

  const calibratePreset = (preset: ClientPreset) => {
    // Select all clients in preset
    setSelectedClients(preset.clientIds);
    setModalType('all');
    setSelectedCostFilters(mockClients.flatMap(c => c.cost.filters.map(f => f.id)));
    setExpandedCostTenants([]);
    setCostSectionOpen(false);
    const allChanges = [
      ...mockAlertRuleChanges.update.map(r => r.id),
      ...mockAlertRuleChanges.enable.map(r => r.id),
      ...mockAlertRuleChanges.disable.map(r => r.id),
    ];
    setSelectedChanges(allChanges);
    setIsChangesModalOpen(true);
    setIsPresetPanelOpen(false);
    toast.info(`Calibrating ${preset.clientIds.length} clients in "${preset.name}"`, { duration: 2000 });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFB] overflow-auto">
      {/* Attention overflow tooltip */}
      {hoveredAttentionId && (() => {
        const client = mockClients.find(c => c.id === hoveredAttentionId);
        if (!client) return null;
        const sorted = [...client.attentions].sort((a, b) => a.priority - b.priority);
        const extra = sorted.slice(1);
        if (extra.length === 0) return null;

        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y + 15}px`
            }}
          >
            <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-2 min-w-[220px] flex flex-col gap-1">
              {extra.map((item) => (
                <span
                  key={item.label}
                  className={`px-2.5 py-1 rounded-lg text-xs ${getAttentionColor(item.label)}`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Calibrate / Pending Changes Modal */}
      {isChangesModalOpen && (calibratingClient || modalType) && (() => {
        // ── per-client mode ──────────────────────────────────────────────────
        if (calibratingClient) {
          const sections = getClientChangeSections(calibratingClient);
          const allRules = sections.flatMap(s => s.rules);
          const totalImpact = allRules
            .filter(r => selectedChanges.includes(r.id))
            .reduce((sum, r) => sum + r.scoreImpact, 0);
          const currentScore = calibratingClient.alertRules.current;
          const predicted = Math.min(currentScore + totalImpact, calibratingClient.alertRules.max);
          const pickedFilters = calibratingClient.cost.filters.filter(f => selectedCostFilters.includes(f.id));
          const pickedSaving = pickedFilters.reduce((sum, f) => sum + f.saving, 0);

          // Collect unique packages required from selected changes
          const requiredPackages = Array.from(new Set(
            allRules
              .filter(r => selectedChanges.includes(r.id) && r.packages)
              .flatMap(r => r.packages || [])
          ));

          const sectionBadge = (type: 'enable' | 'disable' | 'update') =>
            type === 'enable'
              ? 'bg-emerald-100 text-emerald-700'
              : type === 'disable'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700';

          const closeModal = () => {
            setIsChangesModalOpen(false);
            setCalibratingClient(null);
            setSelectedChanges([]);
          };

          return (
            <div
              className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={calibratingClient.clientLogo}
                        alt={calibratingClient.clientName}
                        className="w-10 h-10 rounded-xl object-cover border border-gray-200"
                      />
                      <div>
                        <h2 className="text-xl text-[#092E3F]">
                          Calibrate — {calibratingClient.clientName}
                        </h2>
                        <p className="text-sm text-[#092E3F]/60 mt-0.5">
                          {sections.length} action type{sections.length !== 1 ? 's' : ''} · {allRules.length} total changes
                        </p>
                      </div>
                    </div>
                    <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-[#092E3F]/60" />
                    </button>
                  </div>

                  {/* Score Impact Strip */}
                  <div className="flex items-center gap-4 p-4 bg-[#2A96A8]/5 rounded-xl border border-[#2A96A8]/20">
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mb-1">Current Score</div>
                      <div className="text-2xl text-[#092E3F]">
                        {currentScore.toFixed(2)}
                        <span className="text-sm text-[#092E3F]/40 ml-1">/ {calibratingClient.alertRules.max}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-px bg-gray-300" />
                      <ArrowUp className="w-5 h-5 text-emerald-600" />
                      <div className="h-12 w-px bg-gray-300" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mb-1">Predicted Score</div>
                      <div className="text-2xl text-emerald-600">
                        {predicted.toFixed(2)}
                        <span className="text-sm text-[#092E3F]/40 ml-1">/ {calibratingClient.alertRules.max}</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg">
                      <div className="text-xs uppercase tracking-wider mb-0.5">Impact</div>
                      <div className="text-lg">+{totalImpact.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Package Requirements Banner - Compact */}
                  {requiredPackages.length > 0 && (
                    <div className="mt-3">
                      <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2 group relative">
                        <Package className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                        <span className="text-xs text-amber-900 font-medium">Requires {requiredPackages.length} Content Hub package{requiredPackages.length !== 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {packageBannerExpanded ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {requiredPackages.map((pkg, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-900" title={pkg}>
                                  {pkg}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <>
                              {requiredPackages.slice(0, 2).map((pkg, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-900 whitespace-nowrap" title={pkg}>
                                  {pkg}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                        {requiredPackages.length > 2 && (
                          <button
                            onClick={() => setPackageBannerExpanded(!packageBannerExpanded)}
                            className="text-xs text-amber-700 hover:text-amber-900 font-medium underline decoration-dotted hover:decoration-solid transition-colors flex-shrink-0"
                          >
                            {packageBannerExpanded ? 'Show Less' : `+${requiredPackages.length - 2} more`}
                          </button>
                        )}
                        <div className="relative group/info">
                          <Info className="w-3.5 h-3.5 text-amber-600 cursor-help flex-shrink-0" />
                          <div className="absolute right-0 top-6 w-80 bg-[#092E3F] text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 shadow-xl">
                            <div className="font-medium mb-2">Package Installation Required</div>
                            <div className="text-[#2A96A8]/90 mb-2">These packages must be installed on your Sentinel Content Hub before applying changes.</div>
                            <div className="space-y-1">
                              {requiredPackages.map((pkg, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <Package className="w-3 h-3 text-[#2A96A8]" />
                                  <span className="text-white/90">{pkg}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Body — grouped sections */}
                <div className="flex-1 overflow-auto">
                  {calibratingClient.cost.filters.length > 0 && (
                    <div className="mx-6 mt-4 border border-[#2A96A8]/30 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 bg-[#e5f2f4]/60 border-b border-[#2A96A8]/20">
                        <PiggyBank className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                        <span className="text-sm font-medium text-[#092E3F]">Savings filters</span>
                        <span className="text-sm text-[#2f7d52]">
                          +${pickedSaving.toLocaleString('en-US')}/mo
                        </span>
                        <span className="text-xs text-[#092E3F]/50">
                          {pickedFilters.length} of {calibratingClient.cost.filters.length} selected
                        </span>
                        <div className="flex-1" />
                        <button
                          onClick={() => setSelectedCostFilters(
                            pickedFilters.length === calibratingClient.cost.filters.length
                              ? []
                              : calibratingClient.cost.filters.map(f => f.id)
                          )}
                          className="text-xs text-[#2A96A8] hover:underline"
                        >
                          {pickedFilters.length === calibratingClient.cost.filters.length ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>

                      <p className="px-5 pt-3 pb-1 text-xs text-[#092E3F]/60 leading-relaxed">
                        Top savings opportunities Data Collection found on {calibratingClient.clientName} and nobody
                        has applied. Each drops matching events before they reach Sentinel — they cannot be
                        recovered afterwards, so pick them one by one.
                      </p>

                      <div className="divide-y divide-gray-100">
                        {calibratingClient.cost.filters.map(f => {
                          const on = selectedCostFilters.includes(f.id);
                          return (
                            <label
                              key={f.id}
                              className={`flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors ${on ? 'hover:bg-gray-50' : 'bg-gray-50/60'}`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => setSelectedCostFilters(prev =>
                                  prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                                )}
                                className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
                              />
                              <span className={`flex-1 min-w-0 ${on ? '' : 'opacity-50'}`}>
                                <span className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-[#092E3F]">{f.title}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-[#092E3F]/60">{f.source}</span>
                                </span>
                                <span className="block font-mono text-[11px] text-[#092E3F]/50 mt-1 truncate">{f.kql}</span>
                              </span>
                              <span className={`text-sm text-[#2f7d52] whitespace-nowrap shrink-0 ${on ? '' : 'opacity-40'}`}>
                                +${f.saving.toLocaleString('en-US')}/mo
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-12">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <Check className="w-8 h-8 text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#092E3F] mb-2">Alert Rules Are Perfect!</h3>
                      <p className="text-sm text-[#092E3F]/60 text-center max-w-md mb-6">Your alert rules are at 100/100. Great job! However, you still need to calibrate the following items at your tenant workspace.</p>
                      
                      {calibratingClient && (
                        <div className="w-full max-w-md space-y-3 mb-6">
                          {/* Log Sources Score */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                calibratingClient.logSources.status === 'good' ? 'bg-emerald-100' :
                                calibratingClient.logSources.status === 'warning' ? 'bg-amber-100' : 'bg-red-100'
                              }`}>
                                <Database className={`w-5 h-5 ${
                                  calibratingClient.logSources.status === 'good' ? 'text-emerald-600' :
                                  calibratingClient.logSources.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                                }`} />
                              </div>
                              <span className="text-sm font-medium text-[#092E3F]">Log Sources</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-semibold ${
                                calibratingClient.logSources.status === 'good' ? 'text-emerald-600' :
                                calibratingClient.logSources.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {calibratingClient.logSources.current}/{calibratingClient.logSources.max}
                              </span>
                            </div>
                          </div>

                          {/* Configurations Score */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                calibratingClient.configurations.status === 'good' ? 'bg-emerald-100' :
                                calibratingClient.configurations.status === 'warning' ? 'bg-amber-100' : 'bg-red-100'
                              }`}>
                                <Settings className={`w-5 h-5 ${
                                  calibratingClient.configurations.status === 'good' ? 'text-emerald-600' :
                                  calibratingClient.configurations.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                                }`} />
                              </div>
                              <span className="text-sm font-medium text-[#092E3F]">Configurations</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-semibold ${
                                calibratingClient.configurations.status === 'good' ? 'text-emerald-600' :
                                calibratingClient.configurations.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {calibratingClient.configurations.current}/{calibratingClient.configurations.max}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

<p className="text-sm text-[#092E3F]/60 text-center max-w-md mb-6">
                        Please visit your tenant URLs to adjust or fix these configurations:
                      </p>
                      
                      <div className="flex flex-col gap-3 w-full max-w-md">
                        <a
                          href="https://portal.azure.com/#view/Microsoft_Azure_Security"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-[#2A96A8] text-white rounded-lg hover:bg-[#237d8d] transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Go to Main Tenant Portal
                        </a>
                        
                        <div className="flex gap-3">
                          <a
                            href="https://portal.azure.com/#view/Microsoft_Azure_Security/DataConnectorsBlade"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2.5 bg-white border-2 border-[#2A96A8] text-[#2A96A8] rounded-lg hover:bg-[#2A96A8]/5 transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                          >
                            <Database className="w-4 h-4" />
                            Log Sources
                          </a>
                          
                          <a
                            href="https://portal.azure.com/#view/Microsoft_Azure_Security/SecurityMenuBlade/~/6"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-2.5 bg-white border-2 border-[#2A96A8] text-[#2A96A8] rounded-lg hover:bg-[#2A96A8]/5 transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            Configurations
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    sections.map((section, si) => (
                      <div key={section.type}>
                        {/* Section Header */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs ${sectionBadge(section.type)}`}>
                              {section.type === 'enable' ? 'Enable' : section.type === 'disable' ? 'Disable' : 'Update'}
                            </span>
                            <span className="text-sm text-[#092E3F]">{section.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#092E3F]/50">{section.rules.length} rules</span>
                            <button
                              onClick={() => {
                                const ids = section.rules.map(r => r.id);
                                const allSelected = ids.every(id => selectedChanges.includes(id));
                                if (allSelected) {
                                  setSelectedChanges(prev => prev.filter(id => !ids.includes(id)));
                                } else {
                                  setSelectedChanges(prev => [...new Set([...prev, ...ids])]);
                                }
                              }}
                              className="text-xs text-[#2A96A8] hover:text-[#237d8d] transition-colors"
                            >
                              {section.rules.every(r => selectedChanges.includes(r.id)) ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                        </div>
                        {/* Section Rows */}
                        <table className="w-full">
                          {si === 0 && (
                            <thead className="hidden">
                              <tr>
                                <th className="w-12" />
                                <th />
                                <th />
                                <th />
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {section.rules.map(rule => (
                              <tr
                                key={rule.id}
                                className={`transition-colors border-b border-gray-50 ${
                                  selectedChanges.includes(rule.id) ? 'bg-[#2A96A8]/5' : 'hover:bg-[#fafbfb]'
                                }`}
                              >
                                <td className={`${TABLE_TD} w-12`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedChanges.includes(rule.id)}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setSelectedChanges(prev => [...prev, rule.id]);
                                      } else {
                                        setSelectedChanges(prev => prev.filter(id => id !== rule.id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
                                  />
                                </td>
                                <td className={TABLE_TD}>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm text-[#092E3F]">{rule.name}</span>
                                    {rule.packages && rule.packages.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <Package className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                        <span className="text-xs text-amber-700">
                                          Requires: {rule.packages.join(', ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className={TABLE_TD}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[#092E3F]/60">{rule.currentStatus}</span>
                                    <ArrowUp className="w-3.5 h-3.5 text-[#092E3F]/40 rotate-90" />
                                    <span className="text-sm text-[#2A96A8]">{rule.newStatus}</span>
                                  </div>
                                </td>
                                <td className={`${TABLE_TD} text-right`}>
                                  <span className="text-sm text-emerald-600">+{rule.scoreImpact.toFixed(2)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-[#092E3F]/60">
                    {selectedChanges.length} of {allRules.length} changes selected
                    {pickedFilters.length > 0 &&
                      ` · ${pickedFilters.length} savings filter${pickedFilters.length !== 1 ? 's' : ''} (+$${pickedSaving.toLocaleString('en-US')}/mo)`}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={closeModal}
                      className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const parts = [`${selectedChanges.length} change${selectedChanges.length !== 1 ? 's' : ''}`];
                        if (pickedFilters.length > 0) parts.push(`${pickedFilters.length} savings filter${pickedFilters.length !== 1 ? 's' : ''} ($${pickedSaving.toLocaleString('en-US')}/mo)`);
                        toast.success(`Calibrated ${calibratingClient.clientName} — ${parts.join(' and ')} applied`);
                        closeModal();
                      }}
                      disabled={selectedChanges.length === 0 && pickedFilters.length === 0}
                      className="px-5 py-2.5 bg-[#2A96A8] text-white rounded-lg text-sm hover:bg-[#237d8d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply Changes ({selectedChanges.length + pickedFilters.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── bulk / 'all' mode ─────────────────────────────────��──────────────
        // Collect unique packages required from selected changes
        const requiredPackagesBulk = Array.from(new Set(
          currentChanges
            .filter(r => selectedChanges.includes(r.id) && r.packages)
            .flatMap(r => r.packages || [])
        ));

        const closeModal = () => {
          setIsChangesModalOpen(false);
          setModalType(null);
          setSelectedChanges([]);
        };

        // Tenants in scope that still have unapplied savings. Calibrate All
        // includes these, so the score it moves is the whole score, not the
        // three-quarters of it that predates Cost.
        const costTargets = (selectedClients.length > 0
          ? mockClients.filter(c => selectedClients.includes(c.id))
          : mockClients
        ).filter(c => c.cost.openFilters > 0);
        const costPicked = costTargets.flatMap(c => c.cost.filters).filter(f => selectedCostFilters.includes(f.id));
        const costFilterCount = costPicked.length;
        const costSaving = costPicked.reduce((n, f) => n + f.saving, 0);
        const toggleCostFilter = (id: string) =>
          setSelectedCostFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        const toggleCostTenant = (ids: string[], on: boolean) =>
          setSelectedCostFilters(prev => on
            ? Array.from(new Set([...prev, ...ids]))
            : prev.filter(x => !ids.includes(x)));
        const expandCostTenant = (id: string) =>
          setExpandedCostTenants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

        return (
          <div
            className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2A96A8]/10 flex items-center justify-center">
                      <Scale className="w-5 h-5 text-[#2A96A8]" />
                    </div>
                    <div>
                      <h2 className="text-xl text-[#092E3F]">
                        {modalType === 'update' && 'Update Alert Rules'}
                        {modalType === 'enable' && 'Enable Alert Rules'}
                        {modalType === 'disable' && 'Disable Alert Rules'}
                        {modalType === 'all' && 'Calibrate All at Once'}
                        {modalType === 'cost' && 'Apply Savings Filters'}
                      </h2>
                      <p className="text-sm text-[#092E3F]/60 mt-0.5">
                        {selectedClients.length > 0
                          ? `Review and apply changes for ${selectedClients.length} selected client${selectedClients.length > 1 ? 's' : ''}`
                          : 'Review and apply pending changes'}
                      </p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-[#092E3F]/60" />
                  </button>
                </div>

                {/* Score Impact Preview */}
                <div className="flex items-center gap-4 p-4 bg-[#2A96A8]/5 rounded-xl border border-[#2A96A8]/20">
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mb-1">
                      {modalType === 'cost' ? 'Current cost score' : 'Current Score'}
                    </div>
                    <div className="text-2xl text-[#092E3F]">
                      {(modalType === 'cost' ? averageScores.cost : averageScores.alertRules).current.toFixed(2)}
                      <span className="text-sm text-[#092E3F]/40 ml-1">/ {(modalType === 'cost' ? averageScores.cost : averageScores.alertRules).max}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-px bg-gray-300" />
                    <ArrowUp className="w-5 h-5 text-emerald-600" />
                    <div className="h-12 w-px bg-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mb-1">
                      {modalType === 'cost' ? 'After applying' : 'Predicted Score'}
                    </div>
                    <div className="text-2xl text-emerald-600">
                      {(() => {
                        // Applying every open filter takes each tenant to a full
                        // cost score, so the predicted average is simply the max.
                        if (modalType === 'cost') return averageScores.cost.max.toFixed(2);
                        const totalImpact = currentChanges
                          .filter(c => selectedChanges.includes(c.id))
                          .reduce((sum, c) => sum + c.scoreImpact, 0);
                        return (averageScores.alertRules.current + totalImpact).toFixed(2);
                      })()}
                      <span className="text-sm text-[#092E3F]/40 ml-1">/ {(modalType === 'cost' ? averageScores.cost : averageScores.alertRules).max}</span>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <div className="text-xs uppercase tracking-wider mb-0.5">
                      {modalType === 'cost' ? 'Saving' : 'Impact'}
                    </div>
                    <div className="text-lg whitespace-nowrap">
                      {modalType === 'cost'
                        ? `+$${costSaving.toLocaleString('en-US')}/mo`
                        : `+${currentChanges
                            .filter(c => selectedChanges.includes(c.id))
                            .reduce((sum, c) => sum + c.scoreImpact, 0)
                            .toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {/* Package Requirements Banner - Compact */}
                {requiredPackagesBulk.length > 0 && (
                  <div className="mt-3">
                    <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2 group relative">
                      <Package className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                      <span className="text-xs text-amber-900 font-medium">Requires {requiredPackagesBulk.length} Content Hub package{requiredPackagesBulk.length !== 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {packageBannerExpandedBulk ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {requiredPackagesBulk.map((pkg, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-900" title={pkg}>
                                {pkg}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <>
                            {requiredPackagesBulk.slice(0, 2).map((pkg, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-xs text-amber-900 whitespace-nowrap" title={pkg}>
                                {pkg}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                      {requiredPackagesBulk.length > 2 && (
                        <button
                          onClick={() => setPackageBannerExpandedBulk(!packageBannerExpandedBulk)}
                          className="text-xs text-amber-700 hover:text-amber-900 font-medium underline decoration-dotted hover:decoration-solid transition-colors flex-shrink-0"
                        >
                          {packageBannerExpandedBulk ? 'Show Less' : `+${requiredPackagesBulk.length - 2} more`}
                        </button>
                      )}
                      <div className="relative group/info">
                        <Info className="w-3.5 h-3.5 text-amber-600 cursor-help flex-shrink-0" />
                        <div className="absolute right-0 top-6 w-80 bg-[#092E3F] text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 shadow-xl">
                          <div className="font-medium mb-2">Package Installation Required</div>
                          <div className="text-[#2A96A8]/90 mb-2">These packages must be installed on your Sentinel Content Hub before applying changes.</div>
                          <div className="space-y-1">
                            {requiredPackagesBulk.map((pkg, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <Package className="w-3 h-3 text-[#2A96A8]" />
                                <span className="text-white/90">{pkg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto">
                {modalType === 'cost' ? (
                  <div className="px-6 py-4">
                    <p className="text-sm text-[#092E3F]/70 mb-4 max-w-[62ch]">
                      These are the top savings opportunities Data Collection has identified and nobody has
                      applied yet. Applying one creates a transformation filter on that log source — matching
                      events are dropped before they reach Sentinel and cannot be recovered afterwards.
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs uppercase tracking-wider text-[#092E3F]/50">
                        Expand a tenant to choose individual filters
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => setExpandedCostTenants(
                          expandedCostTenants.length === costTargets.length ? [] : costTargets.map(c => c.id)
                        )}
                        className="text-xs text-[#2A96A8] hover:underline"
                      >
                        {expandedCostTenants.length === costTargets.length ? 'Collapse all' : 'Expand all'}
                      </button>
                      <button
                        onClick={() => {
                          const all = costTargets.flatMap(c => c.cost.filters.map(f => f.id));
                          setSelectedCostFilters(costFilterCount === all.length ? [] : all);
                        }}
                        className="text-xs text-[#2A96A8] hover:underline"
                      >
                        {costFilterCount === costTargets.flatMap(c => c.cost.filters).length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <CostFilterPicker
                      clients={costTargets}
                      selected={selectedCostFilters}
                      onToggle={toggleCostFilter}
                      onToggleAll={toggleCostTenant}
                      expanded={expandedCostTenants}
                      onExpand={expandCostTenant}
                    />
                    <div className="flex items-start gap-2.5 mt-4 px-4 py-3 bg-amber-50 border-l-2 border-amber-500 rounded">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Dropped events will not appear in hunting queries, analytics rules or investigations.
                        Each filter was checked against the tenant&rsquo;s enabled detections before being recommended.
                      </p>
                    </div>
                  </div>
                ) : modalType === 'all' ? (
                  <div className="px-6 space-y-2 py-4">
                    {costTargets.length > 0 && (
                      <div className="mb-4 border border-[#2A96A8]/30 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setCostSectionOpen(o => !o)}
                          className="w-full flex items-start gap-3 px-4 py-3 bg-[#e5f2f4] text-left hover:bg-[#d8ebee] transition-colors"
                        >
                          <PiggyBank className="w-4 h-4 text-[#1e7d8f] shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#092E3F]">
                              Also applying <span className="font-medium">{costFilterCount} savings filter{costFilterCount !== 1 ? 's' : ''}</span> across{' '}
                              {costTargets.length} tenant{costTargets.length !== 1 ? 's' : ''} —{' '}
                              <span className="text-[#2f7d52] font-medium">+${costSaving.toLocaleString('en-US')}/mo</span>
                            </p>
                            <p className="text-xs text-[#092E3F]/60 mt-0.5">
                              These drop matching events before ingestion and cannot be undone retroactively.
                              {costSectionOpen ? '' : ' Expand to choose which.'}
                            </p>
                          </div>
                          {costSectionOpen
                            ? <ChevronUp className="w-4 h-4 text-[#092E3F]/50 shrink-0 mt-0.5" />
                            : <ChevronDown className="w-4 h-4 text-[#092E3F]/50 shrink-0 mt-0.5" />}
                        </button>
                        {costSectionOpen && (
                          <div className="p-3 bg-white">
                            <CostFilterPicker
                              clients={costTargets}
                              selected={selectedCostFilters}
                              onToggle={toggleCostFilter}
                              onToggleAll={toggleCostTenant}
                              expanded={expandedCostTenants}
                              onExpand={expandCostTenant}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {(selectedClients.length > 0
                      ? mockClients.filter(c => selectedClients.includes(c.id))
                      : mockClients
                    ).map((client) => {
                      const isExpanded = expandedClients.includes(client.id);
                      const totalImpact = currentChanges
                        .filter(c => selectedChanges.includes(c.id))
                        .reduce((sum, c) => sum + c.scoreImpact, 0);
                      const currentScore = client.alertRules.current;
                      const predictedScore = Math.min(currentScore + totalImpact, client.alertRules.max);

                      return (
                        <div key={client.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                          <button
                            onClick={() => {
                              setExpandedClients(prev =>
                                prev.includes(client.id)
                                  ? prev.filter(id => id !== client.id)
                                  : [...prev, client.id]
                              );
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          >
                            <img
                              src={client.clientLogo}
                              alt={client.clientName}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            />
                            <span className="text-sm text-[#092E3F] font-medium">{client.clientName}</span>
                            <div className="ml-auto flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <div className="text-xs text-[#092E3F]/60">Current</div>
                                  <div className="text-sm text-[#092E3F]">{currentScore.toFixed(2)}</div>
                                </div>
                                <ArrowUp className="w-4 h-4 text-emerald-600" />
                                <div className="text-right">
                                  <div className="text-xs text-[#092E3F]/60">After</div>
                                  <div className="text-sm text-emerald-600">{predictedScore.toFixed(2)}</div>
                                </div>
                                <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                                  +{(predictedScore - currentScore).toFixed(2)}
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-[#092E3F]/60" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />
                              )}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-gray-200 bg-gray-50 p-4">
                              <div className="space-y-2">
                                <div className="text-xs uppercase tracking-wider text-[#092E3F]/60 mb-2">
                                  Pending Changes
                                </div>
                                {currentChanges.slice(0, 5).map((rule) => {
                                  const actionType = getActionType(rule);
                                  const actionBadgeClass = actionType === 'update' ? 'bg-blue-100 text-blue-700' : actionType === 'enable' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
                                  const actionLabel = actionType === 'update' ? 'Update' : actionType === 'enable' ? 'Enable' : 'Disable';
                                  return (
                                    <div key={rule.id} className="flex flex-col gap-1 py-2 px-3 bg-white rounded-lg">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-[#092E3F]">{rule.name}</span>
                                          <span className={`px-2 py-0.5 rounded text-xs ${actionBadgeClass}`}>
                                            {actionLabel}
                                          </span>
                                        </div>
                                        <span className="text-xs text-emerald-600">+{rule.scoreImpact.toFixed(2)}</span>
                                      </div>
                                      {rule.packages && rule.packages.length > 0 && (
                                        <div className="flex items-center gap-1 ml-0">
                                          <Package className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                          <span className="text-xs text-amber-700">
                                            Requires: {rule.packages.join(', ')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {currentChanges.length > 5 && (
                                  <div className="text-xs text-[#092E3F]/60 text-center py-2">
                                    +{currentChanges.length - 5} more changes
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={`${TABLE_HEAD} sticky top-0 z-10`}>
                      <tr>
                        <th className={`${TABLE_TH} w-12`}>
                          <input
                            type="checkbox"
                            checked={selectedChanges.length === currentChanges.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedChanges(currentChanges.map(r => r.id));
                              } else {
                                setSelectedChanges([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
                          />
                        </th>
                        <th className={TABLE_TH}>
                          Alert Rule
                        </th>
                        <th className={TABLE_TH}>
                          Pending Change
                        </th>
                        <th className={`${TABLE_TH} text-right`}>
                          Score Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className={TABLE_BODY}>
                      {currentChanges.map((rule) => (
                        <tr
                          key={rule.id}
                          className={`transition-colors ${
                            selectedChanges.includes(rule.id) ? 'bg-[#2A96A8]/5' : 'hover:bg-[#fafbfb]'
                          }`}
                        >
                          <td className={TABLE_TD}>
                            <input
                              type="checkbox"
                              checked={selectedChanges.includes(rule.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChanges(prev => [...prev, rule.id]);
                                } else {
                                  setSelectedChanges(prev => prev.filter(id => id !== rule.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-2 border-gray-300 text-[#2A96A8] focus:ring-[#2A96A8]"
                            />
                          </td>
                          <td className={TABLE_TD}>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-[#092E3F]">{rule.name}</span>
                              {rule.packages && rule.packages.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Package className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span className="text-xs text-amber-700">
                                    Requires: {rule.packages.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={TABLE_TD}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#092E3F]/60">{rule.currentStatus}</span>
                              <ArrowUp className="w-3.5 h-3.5 text-[#092E3F]/40 rotate-90" />
                              <span className="text-sm text-[#2A96A8]">{rule.newStatus}</span>
                            </div>
                          </td>
                          <td className={`${TABLE_TD} text-right`}>
                            <span className="text-sm text-emerald-600">+{rule.scoreImpact.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-[#092E3F]/60">
                  {modalType === 'cost'
                    ? `${costFilterCount} filter${costFilterCount !== 1 ? 's' : ''} across ${costTargets.length} tenant${costTargets.length !== 1 ? 's' : ''}`
                    : `${selectedChanges.length} of ${currentChanges.length} changes selected`}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeModal}
                    className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const clientText = selectedClients.length > 0
                        ? ` for ${selectedClients.length} client${selectedClients.length > 1 ? 's' : ''}`
                        : '';
                      if (modalType === 'cost') {
                        toast.success(`Applied ${costFilterCount} savings filters — $${costSaving.toLocaleString('en-US')}/mo${clientText}`);
                      } else {
                        toast.success(`Applied ${selectedChanges.length} changes successfully${clientText}`);
                      }
                      closeModal();
                      setSelectedClients([]);
                    }}
                    disabled={modalType === 'cost' ? costFilterCount === 0 : selectedChanges.length === 0}
                    className="px-5 py-2.5 bg-[#2A96A8] text-white rounded-lg text-sm hover:bg-[#237d8d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {modalType === 'cost' ? `Apply ${costFilterCount} filters` : `Apply Changes (${selectedChanges.length})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Preset Quick Panel ─────────────────────────────────────────── */}
      {isPresetPanelOpen && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setIsPresetPanelOpen(false)} />
          <div
            className="fixed z-[151] w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            style={{ top: presetPanelPos.top, left: presetPanelPos.left }}
          >
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#2A96A8]" />
                <span className="text-sm text-[#092E3F]">Client Presets</span>
                <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] rounded-full text-xs">{presets.length}</span>
              </div>
              <button
                onClick={() => { openCreatePreset(); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2A96A8] text-white rounded-lg text-xs hover:bg-[#237d8d] transition-colors"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {/* All Clients option */}
            <button
              onClick={() => { setActivePresetId(null); setIsPresetPanelOpen(false); }}
              className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${!activePresetId ? 'bg-[#2A96A8]/5' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full bg-gray-400`} />
              <span className="text-sm text-[#092E3F] flex-1 text-left">All Clients</span>
              <span className="text-xs text-[#092E3F]/40">{mockClients.length} clients</span>
              {!activePresetId && <Check className="w-3.5 h-3.5 text-[#2A96A8]" />}
            </button>

            {/* Preset list */}
            <div className="max-h-72 overflow-auto">
              {presets.map(preset => {
                const isActive = activePresetId === preset.id;
                return (
                  <div key={preset.id} className={`group flex items-center gap-0 border-b border-gray-50 ${isActive ? 'bg-[#2A96A8]/5' : 'hover:bg-gray-50'} transition-colors`}>
                    <button
                      onClick={() => { setActivePresetId(isActive ? null : preset.id); setIsPresetPanelOpen(false); }}
                      className="flex-1 px-4 py-2.5 flex items-center gap-3 text-left min-w-0"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${PRESET_COLORS.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[#092E3F] truncate">{preset.name}</div>
                        <div className="text-xs text-[#092E3F]/50 truncate">{preset.clientIds.length} client{preset.clientIds.length !== 1 ? 's' : ''}</div>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-[#2A96A8] shrink-0" />}
                    </button>
                    {/* Quick actions on hover */}
                    <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => calibratePreset(preset)}
                        title="Calibrate preset"
                        className="p-1.5 hover:bg-[#2A96A8]/10 rounded-lg transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-[#2A96A8]" />
                      </button>
                      <button
                        onClick={() => openEditPreset(preset)}
                        title="Edit preset"
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#092E3F]/50" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {presets.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-[#092E3F]/40">No presets yet</div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => { setIsManagePresetsOpen(true); setIsPresetPanelOpen(false); }}
                className="w-full text-xs text-[#2A96A8] hover:text-[#237d8d] transition-colors text-center"
              >
                Manage all presets →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Manage Presets Modal ────────────────────────────────────────── */}
      {isManagePresetsOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
          onClick={() => { setIsManagePresetsOpen(false); setIsCreatingPreset(false); setEditingPresetId(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2A96A8]/10 flex items-center justify-center">
                  <BookMarked className="w-5 h-5 text-[#2A96A8]" />
                </div>
                <div>
                  <h2 className="text-xl text-[#092E3F]">
                    {editingPresetId ? 'Edit Preset' : isCreatingPreset ? 'New Preset' : 'Manage Presets'}
                  </h2>
                  <p className="text-sm text-[#092E3F]/60 mt-0.5">Organise clients into reusable groups for bulk calibration</p>
                </div>
              </div>
              <button onClick={() => { setIsManagePresetsOpen(false); setIsCreatingPreset(false); setEditingPresetId(null); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#092E3F]/60" />
              </button>
            </div>

            {/* Modal Body: left list + right editor */}
            <div className="flex flex-1 overflow-hidden">
              {/* LEFT — preset list */}
              <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#092E3F]/50">Presets ({presets.length})</span>
                  <button
                    onClick={() => openCreatePreset()}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${isCreatingPreset ? 'bg-[#092E3F] text-white' : 'bg-[#2A96A8] text-white hover:bg-[#237d8d]'}`}
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                  {/* New Preset placeholder row while creating */}
                  {isCreatingPreset && (
                    <div className="px-3 py-2.5 rounded-xl bg-[#2A96A8]/10 border border-[#2A96A8]/30 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${PRESET_COLORS.bg} ${PRESET_COLORS.border} border flex items-center justify-center shrink-0`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${PRESET_COLORS.dot}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[#2A96A8] truncate italic">
                          {presetDraft.name || 'New Preset…'}
                        </div>
                        <div className="text-xs text-[#2A96A8]/60">{presetDraft.clientIds.length} client{presetDraft.clientIds.length !== 1 ? 's' : ''} selected</div>
                      </div>
                    </div>
                  )}
                  {presets.map(preset => {
                    const isEditing = editingPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => openEditPreset(preset)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3 group ${isEditing ? 'bg-[#2A96A8]/10 border border-[#2A96A8]/30' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${PRESET_COLORS.bg} ${PRESET_COLORS.border} border flex items-center justify-center shrink-0`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${PRESET_COLORS.dot}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-[#092E3F] truncate">{preset.name}</div>
                          <div className="text-xs text-[#092E3F]/50">{preset.clientIds.length} client{preset.clientIds.length !== 1 ? 's' : ''}</div>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    );
                  })}
                  {presets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <BookMarked className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm text-[#092E3F]/40">No presets yet. Create your first one.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — editor */}
              <div className="flex-1 flex flex-col overflow-auto">
                {(isCreatingPreset || editingPresetId !== null) ? (
                  <>
                    <div className="flex-1 overflow-auto p-6 space-y-6">
                      {/* Name */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[#092E3F]/50 mb-2">Preset Name *</label>
                        <input
                          type="text"
                          value={presetDraft.name}
                          onChange={e => setPresetDraft(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. High Priority Clients"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#092E3F] placeholder:text-[#092E3F]/30 focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[#092E3F]/50 mb-2">Description</label>
                        <textarea
                          value={presetDraft.description}
                          onChange={e => setPresetDraft(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe what this preset is for..."
                          rows={2}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#092E3F] placeholder:text-[#092E3F]/30 focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all resize-none"
                        />
                      </div>

                      {/* Clients */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs uppercase tracking-wider text-[#092E3F]/50">
                            Clients * <span className="normal-case text-[#2A96A8]">({presetDraft.clientIds.length} selected)</span>
                          </label>
                          <button
                            onClick={() => {
                              const allIds = mockClients.map(c => c.id);
                              setPresetDraft(prev => ({
                                ...prev,
                                clientIds: prev.clientIds.length === allIds.length ? [] : allIds,
                              }));
                            }}
                            className="text-xs text-[#2A96A8] hover:text-[#237d8d] transition-colors"
                          >
                            {presetDraft.clientIds.length === mockClients.length ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-auto pr-1">
                          {mockClients.map(client => {
                            const isSelected = presetDraft.clientIds.includes(client.id);
                            return (
                              <button
                                key={client.id}
                                onClick={() => {
                                  setPresetDraft(prev => ({
                                    ...prev,
                                    clientIds: isSelected
                                      ? prev.clientIds.filter(id => id !== client.id)
                                      : [...prev.clientIds, client.id],
                                  }));
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isSelected ? 'bg-[#2A96A8]/10 border border-[#2A96A8]/20' : 'hover:bg-gray-50 border border-transparent'}`}
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <img
                                  src={client.clientLogo}
                                  alt={client.clientName}
                                  className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                                />
                                <span className="text-sm text-[#092E3F] flex-1 text-left truncate">{client.clientName}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${client.overallScore.status === 'good' ? 'bg-emerald-500' : client.overallScore.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                  <span className={`text-xs px-2 py-0.5 rounded ${getScoreColor(client.overallScore.status)}`}>
                                    {client.overallScore.current}/{client.overallScore.max}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Editor Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                      {editingPresetId ? (
                        <button
                          onClick={() => deletePreset(editingPresetId)}
                          className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete preset
                        </button>
                      ) : <div />}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (isCreatingPreset) {
                              // Just discard the new preset form, stay in modal to show preset list
                              setIsCreatingPreset(false);
                              setEditingPresetId(null);
                              setPresetDraft({ name: '', description: '', clientIds: [] });
                            } else {
                              setIsManagePresetsOpen(false);
                              setEditingPresetId(null);
                            }
                          }}
                          className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                        >
                          {isCreatingPreset ? 'Discard' : 'Cancel'}
                        </button>
                        <button
                          onClick={savePreset}
                          className="px-5 py-2.5 bg-[#2A96A8] text-white rounded-lg text-sm hover:bg-[#237d8d] transition-colors"
                        >
                          {editingPresetId ? 'Save changes' : 'Create preset'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Empty state — no preset selected / no draft */
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="w-16 h-16 bg-[#2A96A8]/10 rounded-2xl flex items-center justify-center mb-4">
                      <BookMarked className="w-8 h-8 text-[#2A96A8]" />
                    </div>
                    <h3 className="text-lg text-[#092E3F] mb-2">Select or create a preset</h3>
                    <p className="text-sm text-[#092E3F]/50 mb-6">Choose a preset from the left to edit it, or create a new one to group your clients.</p>
                    <button
                      onClick={() => openCreatePreset()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#2A96A8] text-white rounded-xl text-sm hover:bg-[#237d8d] transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create first preset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full flex flex-col p-[16px]">
        <div className="mb-3 m-[0px]">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-[#092E3F]">Calibrate Overview</h1>
            <span className="px-3 py-1 bg-[#2A96A8]/10 text-[#2A96A8] rounded-full text-sm">
              {filteredAndSortedClients.length}
            </span>
          </div>

          {/* Calibration Score Accordion */}
          <div className="mb-6 bg-white rounded-xl border border-white overflow-hidden">
            <div className="w-full px-6 py-4 flex items-center justify-between">
              <button 
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-lg bg-[#2A96A8]/10 flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-[#2A96A8]" />
                </div>
                <div className="text-left">
                  <h3 className="text-[#092E3F]">Average Calibration Score</h3>
                  <p className="text-sm text-[#092E3F]/60">
                    {clientFilter.length > 0 
                      ? `Across ${clientFilter.length} selected client${clientFilter.length > 1 ? 's' : ''}`
                      : `Across all ${mockClients.length} clients`}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-3">
                {/* Client Filter Dropdown */}
                <div className="relative">
                  <button
                    ref={filterButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsClientFilterOpen(!isClientFilterOpen);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-[#2A96A8] transition-all text-sm text-[#092E3F]"
                  >
                    <Filter className="w-4 h-4 text-[#092E3F]/60" />
                    <span>
                      {clientFilter.length > 0
                        ? `${clientFilter.length} ${clientFilter.length > 1 ? 'clients' : 'client'}`
                        : 'All clients'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#092E3F]/60 transition-transform ${isClientFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isClientFilterOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsClientFilterOpen(false)}
                      />
                      <div 
                        className="fixed w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[101] max-h-96 overflow-auto"
                        style={{
                          top: `${dropdownPosition.top}px`,
                          right: `${dropdownPosition.right}px`
                        }}
                      >
                        <div className="p-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                          <span className="text-sm text-[#092E3F]">Filter Clients</span>
                          {clientFilter.length > 0 && (
                            <button
                              onClick={() => {
                                setClientFilter([]);
                                toast.success('Filter cleared');
                              }}
                              className="text-xs text-[#2A96A8] hover:text-[#237d8d] transition-colors"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div className="p-2">
                          {mockClients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setClientFilter(prev =>
                                  prev.includes(client.id)
                                    ? prev.filter(id => id !== client.id)
                                    : [...prev, client.id]
                                );
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                              <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                                clientFilter.includes(client.id)
                                  ? 'bg-[#2A96A8] border-[#2A96A8]'
                                  : 'border-white'
                              }`}>
                                {clientFilter.includes(client.id) && (
                                  <svg 
                                    className="w-2.5 h-2.5 text-white"
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor" 
                                    strokeWidth="3"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <img
                                src={client.clientLogo}
                                alt={client.clientName}
                                className="w-6 h-6 rounded-full object-cover border border-white"
                              />
                              <span className="text-sm text-[#092E3F] flex-1 text-left truncate">
                                {client.clientName}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${getScoreColor(client.overallScore.status)}`}>
                                {client.overallScore.current}/{client.overallScore.max}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className={`px-4 py-2 rounded-lg ${getScoreColor(averageScores.overall.status)}`}>
                  <span className="text-lg">{averageScores.overall.current.toFixed(2)}/{averageScores.overall.max}</span>
                </div>

                <button 
                  onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                  className="hover:bg-gray-100 rounded-lg p-1 transition-colors"
                >
                  {isAccordionOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#092E3F]/40" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#092E3F]/40" />
                  )}
                </button>
              </div>
            </div>

            {isAccordionOpen && (
              <div className="px-6 pb-6 pt-4 border-t border-white">
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-5">
                  {/* Speedometer Gauge - Main Calibration Score */}
                  <div className="flex flex-col items-center justify-center bg-gray-50 rounded-[7px] p-6">
                    <SpeedometerGauge 
                      current={averageScores.overall.current}
                      max={averageScores.overall.max}
                      label="CALIBRATION SCORE"
                    />
                  </div>

                  {/* Alert Rules Score */}
                  <div className="bg-gray-50 rounded-[7px] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Scale className="w-5 h-5 text-[#092E3F]/60" />
                      <h4 className="text-sm uppercase tracking-wider text-[#092E3F]/70">Alert Rules Score</h4>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-2xl text-[#092E3F] mb-1">
                        {averageScores.alertRules.current.toFixed(2)}
                        <span className="text-lg text-[#092E3F]/40"> / {averageScores.alertRules.max}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          averageScores.alertRules.status === 'good' ? 'bg-emerald-500' :
                          averageScores.alertRules.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                        <span className="text-sm text-[#092E3F]/60 capitalize">{averageScores.alertRules.status}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button 
                        onClick={() => {
                          setModalType('update');
                          setIsChangesModalOpen(true);
                          setSelectedChanges(mockAlertRuleChanges.update.map(r => r.id));
                        }}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white"
                      >
                        Update 5 <span className="text-[#092E3F]/50">(+ 1.67)</span>
                      </button>
                      <button 
                        onClick={() => {
                          setModalType('enable');
                          setIsChangesModalOpen(true);
                          setSelectedChanges(mockAlertRuleChanges.enable.map(r => r.id));
                        }}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white"
                      >
                        Enable 8 <span className="text-[#092E3F]/50">(+ 5.36)</span>
                      </button>
                      <button 
                        onClick={() => {
                          setModalType('disable');
                          setIsChangesModalOpen(true);
                          setSelectedChanges(mockAlertRuleChanges.disable.map(r => r.id));
                        }}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white"
                      >
                        Disable 3 <span className="text-[#092E3F]/50">(+ 2.01)</span>
                      </button>
                    </div>
                  </div>

                  {/* Log Sources Score */}
                  <div className="bg-gray-50 rounded-[7px] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Database className="w-5 h-5 text-[#092E3F]/60" />
                      <h4 className="text-sm uppercase tracking-wider text-[#092E3F]/70">Log Sources Score</h4>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-2xl text-[#092E3F] mb-1">
                        {averageScores.logSources.current.toFixed(2)}
                        <span className="text-lg text-[#092E3F]/40"> / {averageScores.logSources.max}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          averageScores.logSources.status === 'good' ? 'bg-emerald-500' :
                          averageScores.logSources.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                        <span className="text-sm text-[#092E3F]/60 capitalize">{averageScores.logSources.status}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button 
                        onClick={() => {
                          setManualModalType('enable');
                          setIsManualModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white"
                      >
                        Enable manually 1
                      </button>
                      <button 
                        onClick={() => {
                          setManualModalType('disable');
                          setIsManualModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white"
                      >
                        Disable manually 3
                      </button>
                    </div>
                  </div>

                  {/* Configuration Score */}
                  <div className="bg-gray-50 rounded-[7px] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="w-5 h-5 text-[#092E3F]/60" />
                      <h4 className="text-sm uppercase tracking-wider text-[#092E3F]/70">Configuration Score</h4>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-2xl text-[#092E3F] mb-1">
                        {averageScores.configurations.current.toFixed(2)}
                        <span className="text-lg text-[#092E3F]/40"> / {averageScores.configurations.max}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          averageScores.configurations.status === 'good' ? 'bg-emerald-500' :
                          averageScores.configurations.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                        <span className="text-sm text-[#092E3F]/60 capitalize">{averageScores.configurations.status}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button className="w-full text-left px-3 py-2 bg-gray-200 rounded-lg text-xs text-[#092E3F]/40 cursor-not-allowed border border-white">
                        Enable manually 0
                      </button>
                    </div>
                  </div>

                  {/* Cost Score — how much of the savings Cost has already found
                      has actually been applied to the data collection rules. */}
                  <div className="bg-gray-50 rounded-[7px] p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <PiggyBank className="w-5 h-5 text-[#092E3F]/60" />
                      <h4 className="text-sm uppercase tracking-wider text-[#092E3F]/70">Cost Score</h4>
                    </div>

                    <div className="mb-4">
                      <div className="text-2xl text-[#092E3F] mb-1">
                        {averageScores.cost.current.toFixed(2)}
                        <span className="text-lg text-[#092E3F]/40"> / {averageScores.cost.max}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          averageScores.cost.status === 'good' ? 'bg-emerald-500' :
                          averageScores.cost.status === 'warning' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`} />
                        <span className="text-sm text-[#092E3F]/60 capitalize">{averageScores.cost.status}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setModalType('cost');
                          setIsChangesModalOpen(true);
                          setSelectedChanges([]);
                          setSelectedCostFilters(mockClients.flatMap(c => c.cost.filters.map(f => f.id)));
                          setExpandedCostTenants([]);
                          setCostSectionOpen(false);
                        }}
                        disabled={averageScores.cost.openFilters === 0}
                        className="w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-[#092E3F] hover:bg-gray-100 transition-colors border border-white disabled:bg-gray-200 disabled:text-[#092E3F]/40 disabled:cursor-not-allowed"
                      >
                        Apply {averageScores.cost.openFilters} filters{' '}
                        <span className="text-[#2f7d52]">(+${averageScores.cost.monthlySaving.toLocaleString('en-US')}/mo)</span>
                      </button>
                      <p className="px-3 text-[11px] leading-snug text-[#092E3F]/45">
                        Top savings opportunities from Data Collection, not yet applied.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-6">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#092E3F]/40" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-[48px] pr-[16px] py-3.5 bg-white border border-white rounded-xl text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] transition-all pt-[10px] pb-[8px]"
              />
            </div>

            {/* Presets button */}
            <div className="relative">
              <button
                ref={presetBtnRef}
                onClick={() => setIsPresetPanelOpen(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-[10px] rounded-xl border transition-all text-sm ${
                  activePreset
                    ? `${PRESET_COLORS.bg} ${PRESET_COLORS.text} ${PRESET_COLORS.border} border`
                    : 'bg-white border-white text-[#092E3F] hover:border-[#2A96A8]'
                }`}
              >
                <BookMarked className="w-4 h-4" />
                {activePreset ? (
                  <span>{activePreset.name}</span>
                ) : (
                  <span>Presets</span>
                )}
                {presets.length > 0 && !activePreset && (
                  <span className="px-1.5 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] rounded-full text-xs">{presets.length}</span>
                )}
                {activePreset && (
                  <span className="text-xs opacity-60">({activePreset.clientIds.length})</span>
                )}
                <ChevronDown className={`w-4 h-4 opacity-60 transition-transform ${isPresetPanelOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Active preset clear badge */}
            {activePreset && (
              <button
                onClick={() => setActivePresetId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-[#092E3F]/60 transition-colors"
                title="Clear preset filter"
              >
                <X className="w-3 h-3" />
                Clear filter
              </button>
            )}

            <button 
              onClick={() => {
                setModalType('all');
    setSelectedCostFilters(mockClients.flatMap(c => c.cost.filters.map(f => f.id)));
    setExpandedCostTenants([]);
    setCostSectionOpen(false);
                setIsChangesModalOpen(true);
                const allChanges = [
                  ...mockAlertRuleChanges.update.map(r => r.id),
                  ...mockAlertRuleChanges.enable.map(r => r.id),
                  ...mockAlertRuleChanges.disable.map(r => r.id)
                ];
                setSelectedChanges(allChanges);
              }}
              className="flex items-center gap-2 px-[20px] py-[8px] bg-[#2A96A8] text-white rounded-xl hover:bg-[#237d8d] transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Calibrate All at Once</span>
            </button>

            <button className="flex items-center gap-2 px-[20px] py-[10px] bg-white border border-white rounded-xl hover:border-[#2A96A8] transition-all text-sm text-[#092E3F]">
              <RefreshCw className="w-4 h-4 text-[#092E3F]/60" />
              <span>Refresh</span>
            </button>

            {selectedClients.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8]/10 rounded-xl border border-[#2A96A8]/20">
                <Users className="w-4 h-4 text-[#2A96A8]" />
                <span className="text-sm text-[#092E3F]">{selectedClients.length} selected</span>
                <div className="h-4 w-px bg-[#2A96A8]/30" />
                <button 
                  onClick={() => {
                    setModalType('all');
    setSelectedCostFilters(mockClients.flatMap(c => c.cost.filters.map(f => f.id)));
    setExpandedCostTenants([]);
    setCostSectionOpen(false);
                    setIsChangesModalOpen(true);
                    const allChanges = [
                      ...mockAlertRuleChanges.update.map(r => r.id),
                      ...mockAlertRuleChanges.enable.map(r => r.id),
                      ...mockAlertRuleChanges.disable.map(r => r.id)
                    ];
                    setSelectedChanges(allChanges);
                  }}
                  className="px-3 py-1 bg-[#2A96A8] text-white text-xs rounded-lg hover:bg-[#237d8d] transition-colors"
                >
                  Calibrate
                </button>
                <button
                  onClick={() => openCreatePreset(selectedClients)}
                  className="px-3 py-1 border border-[#2A96A8] text-[#2A96A8] text-xs rounded-lg hover:bg-[#2A96A8]/10 transition-colors flex items-center gap-1"
                  title="Save current selection as a preset"
                >
                  <BookMarked className="w-3 h-3" />
                  Save as Preset
                </button>
                <button
                  onClick={() => setSelectedClients([])}
                  className="p-1 hover:bg-[#2A96A8]/20 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#2A96A8]" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={TABLE_SHELL}>
          <table className="w-full">
            <thead className={`${TABLE_HEAD} sticky top-0 z-10`}>
              <tr>
                <th 
                  className={TABLE_TH}
                  style={{ width: columnWidths.select }}
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedClients.length === paginatedClients.length && paginatedClients.length > 0}
                      onChange={handleSelectAll}
                      className="peer sr-only"
                    />
                    <div 
                      onClick={handleSelectAll}
                      className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center cursor-pointer ${
                        selectedClients.length === paginatedClients.length && paginatedClients.length > 0
                          ? 'bg-[#2A96A8] border-[#2A96A8]'
                          : 'border-gray-300 hover:border-[#2A96A8]'
                      }`}
                    >
                      <svg 
                        className={`w-3 h-3 text-white transition-all duration-200 ${
                          selectedClients.length === paginatedClients.length && paginatedClients.length > 0
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                        }`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth="3"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.clientName }}
                  onClick={() => handleSort('clientName')}
                >
                  <div className="flex items-center gap-2">
                    Client Name
                    {sortField === 'clientName' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('clientName')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.overallScore }}
                  onClick={() => handleSort('overallScore')}
                >
                  <div className="flex items-center gap-2">
                    Overall Score
                    {sortField === 'overallScore' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('overallScore')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.alertRules }}
                  onClick={() => handleSort('alertRules')}
                >
                  <div className="flex items-center gap-2">
                    Alert Rules
                    {sortField === 'alertRules' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('alertRules')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.logSources }}
                  onClick={() => handleSort('logSources')}
                >
                  <div className="flex items-center gap-2">
                    Log Sources
                    {sortField === 'logSources' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('logSources')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.configurations }}
                  onClick={() => handleSort('configurations')}
                >
                  <div className="flex items-center gap-2">
                    Configurations
                    {sortField === 'configurations' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('configurations')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.cost }}
                  onClick={() => handleSort('cost')}
                >
                  <div className="flex items-center gap-2">
                    Cost
                    {sortField === 'cost' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('cost')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={`${TABLE_TH} ${TABLE_TH_INTERACTIVE}`}
                  style={{ width: columnWidths.attention }}
                  onClick={() => handleSort('attention')}
                >
                  <div className="flex items-center gap-2">
                    Attention
                    {sortField === 'attention' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-[#2A96A8]" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-[#2A96A8]" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-[#092E3F]/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#2A96A8] transition-colors flex items-center justify-center"
                    onMouseDown={handleMouseDown('attention')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-4 bg-gray-300 group-hover:bg-[#2A96A8]" />
                  </div>
                </th>

                <th 
                  className={TABLE_TH}
                  style={{ width: columnWidths.action }}
                >
                  Action
                </th>

                <th 
                  className={TABLE_TH}
                  style={{ width: columnWidths.more }}
                >
                </th>
              </tr>
            </thead>

            <tbody className={TABLE_BODY}>
              {paginatedClients.map((client) => (
                <tr 
                  key={client.id}
                  className={`transition-colors group ${
                    selectedClients.includes(client.id)
                      ? 'bg-[#2A96A8]/5 hover:bg-[#2A96A8]/10'
                      : 'hover:bg-[#fafbfb]'
                  }`}
                >
                  <td className={TABLE_TD} onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={() => handleSelectClient(client.id)}
                        className="peer sr-only"
                      />
                      <div
                        onClick={() => handleSelectClient(client.id)}
                        className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center cursor-pointer ${
                          selectedClients.includes(client.id)
                            ? 'bg-[#2A96A8] border-[#2A96A8]'
                            : 'border-gray-300 hover:border-[#2A96A8]'
                        }`}
                      >
                        <svg 
                          className={`w-3 h-3 text-white transition-all duration-200 ${
                            selectedClients.includes(client.id)
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-50'
                          }`}
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth="3"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img 
                        src={client.clientLogo} 
                        alt={client.clientName}
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-white"
                      />
                      <span className="text-sm text-[#092E3F] truncate">{client.clientName}</span>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm whitespace-nowrap ${getScoreColor(client.overallScore.status)}`}>
                      <span>{client.overallScore.current}/{client.overallScore.max}</span>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm whitespace-nowrap ${getScoreColor(client.alertRules.status)}`}>
                      <span>{client.alertRules.current}/{client.alertRules.max}</span>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm whitespace-nowrap ${getScoreColor(client.logSources.status)}`}>
                      <span>{client.logSources.current}/{client.logSources.max}</span>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm whitespace-nowrap ${getScoreColor(client.configurations.status)}`}>
                      <span>{client.configurations.current}/{client.configurations.max}</span>
                    </div>
                  </td>

                  <td className={TABLE_TD}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-sm whitespace-nowrap ${getScoreColor(client.cost.status)}`}>
                      <span>{client.cost.current}/{client.cost.max}</span>
                    </div>
                    {client.cost.openFilters > 0 && (
                      <p className="text-[11px] text-[#092E3F]/45 mt-1 whitespace-nowrap">
                        {client.cost.openFilters} filter{client.cost.openFilters !== 1 ? 's' : ''} · ${client.cost.monthlySaving.toLocaleString('en-US')}/mo
                      </p>
                    )}
                  </td>

                  <td className={TABLE_TD}>
                    {(() => {
                      const sorted = [...client.attentions].sort((a, b) => a.priority - b.priority);
                      if (sorted.length === 0) {
                        return (
                          <span className="inline-block px-2.5 py-1 bg-gray-50 text-[#092E3F]/50 rounded-lg text-xs">
                            No Observation
                          </span>
                        );
                      }
                      const primary = sorted[0];
                      const extraCount = sorted.length - 1;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs truncate max-w-[140px] ${getAttentionColor(primary.label)}`}>
                            {primary.label}
                          </span>
                          {extraCount > 0 && (
                            <span
                              className="inline-flex items-center px-2 py-1 bg-[#2A96A8]/10 text-[#2A96A8] rounded-lg text-xs shrink-0 cursor-pointer hover:bg-[#2A96A8]/20 transition-all"
                              onMouseEnter={() => setHoveredAttentionId(client.id)}
                              onMouseLeave={() => setHoveredAttentionId(null)}
                              onMouseMove={handleMouseMove}
                            >
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  <td className={TABLE_TD}>
                    {client.attentions.length === 0 && client.overallScore.current === client.overallScore.max ? (
                      <span className="px-3 py-1.5 text-xs text-[#092E3F]/40 whitespace-nowrap">—</span>
                    ) : (
                      <button
                        onClick={() => {
                          const sections = getClientChangeSections(client);
                          const allRules = sections.flatMap(s => s.rules);
                          setCalibratingClient(client);
                          setSelectedCostFilters(client.cost.filters.map(f => f.id));
                          setModalType(null);
                          setSelectedChanges(allRules.map(r => r.id));
                          setIsChangesModalOpen(true);
                        }}
                        className="w-full px-3 py-1.5 bg-[#2A96A8] text-white text-xs rounded-lg hover:bg-[#237d8d] transition-colors whitespace-nowrap"
                      >
                        Calibrate
                      </button>
                    )}
                  </td>

                  <td className={TABLE_TD}>
                    <div className="relative">
                      <button 
                        onClick={() => setOpenDropdownId(openDropdownId === client.id ? null : client.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4 text-[#092E3F]/60" />
                      </button>

                      {openDropdownId === client.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setOpenDropdownId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-white z-50 py-1">
                            <button
                              onClick={() => {
                                toast.success(`Navigating to ${client.clientName} on Seculyze`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              Go to Client.Seculyze
                            </button>
                            <button
                              onClick={() => {
                                toast.success(`Enabling high value alert rules for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              Enable high value Alert Rules
                            </button>
                            <button
                              onClick={() => {
                                toast.success(`Disabling low value alert rules for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              Disable low value Alert Rules
                            </button>
                            <button
                              onClick={() => {
                                toast.success(`Viewing alert rules for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              View Alert Rules
                            </button>
                            <button
                              onClick={() => {
                                toast.success(`Viewing log sources for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              View Log Sources
                            </button>
                            <button
                              onClick={() => {
                                toast.success(`Viewing configurations for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#092E3F] hover:bg-gray-50 transition-colors"
                            >
                              View Configurations
                            </button>
                            <div className="border-t border-white my-1" />
                            <button
                              onClick={() => {
                                toast.success(`Acknowledged and removed attention for ${client.clientName}`);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              Acknowledge and remove Attention
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg text-[#092E3F] mb-2">No clients found</h3>
              <p className="text-sm text-[#092E3F]/60">Try adjusting your search query</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-[#092E3F]/60">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedClients.length)} of {filteredAndSortedClients.length} clients
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-white rounded-lg text-sm text-[#092E3F] hover:border-[#2A96A8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-[#2A96A8] text-white'
                        : 'bg-white border border-white text-[#092E3F] hover:border-[#2A96A8]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-white rounded-lg text-sm text-[#092E3F] hover:border-[#2A96A8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Enable/Disable Modal */}
      {isManualModalOpen && manualModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#092E3F] to-[#2A96A8] px-6 py-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl text-white mb-1">
                    {manualModalType === 'enable' ? 'Enable Log Sources Manually' : 'Disable Log Sources Manually'}
                  </h2>
                  <p className="text-sm text-white/80">
                    Visit each client's tenant workspace to {manualModalType} log sources
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setManualModalType(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Info Banner */}
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    These log sources need to be {manualModalType === 'enable' ? 'enabled' : 'disabled'} manually in each client's tenant workspace. 
                    Click the button next to each client to navigate to their configuration page.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body - Client List */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-3">
                {mockClients.map((client) => (
                  <div 
                    key={client.id} 
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2A96A8]/30 transition-all"
                  >
                    {/* Client Logo */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 border-white shadow-sm">
                      <img 
                        src={client.clientLogo} 
                        alt={client.clientName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Client Info */}
                    <div className="flex-1">
                      <h3 className="text-[#092E3F] font-medium mb-1">{client.clientName}</h3>
                      <p className="text-xs text-[#092E3F]/60">
                        Log Sources: {client.logSources.current}/{client.logSources.max}
                      </p>
                    </div>

                    {/* Action Button */}
                    <a
                      href={client.tenantUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-lg hover:bg-[#237d8d] transition-all text-sm shrink-0"
                    >
                      Go to Workspace
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#092E3F]/60">
                  {mockClients.length} client{mockClients.length !== 1 ? 's' : ''} require manual configuration
                </p>
                <button
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setManualModalType(null);
                  }}
                  className="px-6 py-2 bg-white border border-gray-300 text-[#092E3F] rounded-lg hover:bg-gray-100 transition-all text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}