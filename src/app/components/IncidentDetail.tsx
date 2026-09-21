import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Calendar,
  User,
  Building2,
  Shield,
  AlertTriangle,
  Clock,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  UserPlus,
  Edit,
  Bell,
  Ticket,
  Play,
  ExternalLink,
  Copy,
  Check,
  Send,
  Target,
  Zap,
  Activity,
  Monitor,
  Globe,
  Mail,
  Terminal,
  FileCheck,
  Maximize2,
  Minimize2,
  Tag,
  Plus,
  Hash,
  Link,
  Sparkles,
  Ban,
  KeyRound,
  LogOut,
  UserX,
  ShieldAlert,
  Loader2,
  Clipboard,
  Search,
  CheckCircle,
  RotateCw,
  Layers
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import ITSMTicketSidebar from './ITSMTicketSidebar';
import imgSentinelPng from "figma:asset/a3774409e98c46ca03515e5bba6f515d1b11173c.png";
import imgAutotaskPng from "figma:asset/da8b49536731a0deeacc8c8a6cd1a32815de7120.png";
import imgSeculyzePng from "figma:asset/f059048282c6434b0ecb2f73ac4a8d51c0755afb.png";

type IncidentStatus = 'New' | 'Active' | 'Closed';
type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
type AttentionType = 'New Alerts' | 'Waiting on customer' | 'New logs';
type Classification = 'TruePositive' | 'FalsePositive' | 'BenignPositive' | 'Undetermined';

// ─── Similar incidents (historical, resolved) ─────────────────────────────────
// Prototype-only: deterministically derived from the incident type so an analyst
// can see how comparable past incidents were classified and stay consistent.
// Always scoped to the incident's own tenant — comparing across tenants would
// leak between customers, and entity overlap is meaningless across them anyway.
interface SimilarIncident {
  id: string;
  ref: string;
  ageLabel: string;
  severity: 'Low' | 'Medium' | 'High';
  classification: Classification;
  // Aggregated threat-intel score for the whole incident, not per entity.
  // null when the feeds returned nothing for it.
  tiScore: number | null;
  analyst: string;
  // How many of the incident's shared indicators are dropped (0 = exact match).
  drop: number;
  // How many entities this incident involves that the current one does not.
  extras: number;
}

const SIMILAR_ANALYSTS = ['Sarah Chen', 'David Martinez', 'Jessica Park', 'Mike Johnson', 'Emily Rodriguez', 'Robert Williams'];
const SIMILAR_AGES = ['2d ago', '5d ago', '1w ago', '2w ago', '3w ago', '1mo ago', '6w ago', '2mo ago'];
const SIMILAR_SEV: ('Low' | 'Medium' | 'High')[] = ['Medium', 'Medium', 'Low', 'Medium', 'High', 'Medium', 'Low', 'Medium'];
// Most rows are an exact match; a couple share fewer indicators (lower match %).
const SIMILAR_DROP = [0, 0, 0, 0, 0, 1, 1, 2];
// Incident-level threat-intel scores. Nulls are deliberate — an incident can
// have no threat intel at all, and the UI has to read sensibly when it doesn't.
const SIMILAR_TI: (number | null)[] = [82, 74, null, 88, 71, null, 91, 46];
// How many entities each past incident involves beyond this one's. Independent
// of `drop` — an incident can match every entity here and still bring its own.
// Zeros are deliberate, so the "nothing extra" case gets exercised.
const SIMILAR_EXTRA = [0, 1, 0, 2, 1, 0, 3, 2];

// Composite similarity as a ring. One ratio against 100, so one hue on a lighter
// track of the same hue; no risk ramp, because similarity is not severity.
function MatchRing({ pct }: { pct: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center w-[40px] h-[40px] shrink-0">
      <svg width="40" height="40" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="#e5f2f4" strokeWidth="1.6" />
        <circle
          cx="12" cy="12" r={r} fill="none" stroke="#2A96A8" strokeWidth="1.6" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums text-[#092E3F]">{pct}</span>
    </span>
  );
}

// Small hover explainer. Opens downward because it sits in a list header near
// the top of its scroll container.
function InfoTip({ children, wide, align = 'center' }: { children: React.ReactNode; wide?: boolean; align?: 'center' | 'left' }) {
  const pos = align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className="relative group/tip inline-flex align-middle">
      <Info className="w-3 h-3 text-[#092E3F]/35 hover:text-[#2A96A8] cursor-help transition-colors" />
      <span className={`absolute ${pos} top-full mt-2 ${wide ? 'w-80' : 'w-64'} p-3 bg-[#092E3F] text-white text-[11px] normal-case tracking-normal font-normal leading-relaxed rounded-[8px] shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-20 pointer-events-none`}>
        {children}
      </span>
    </span>
  );
}

type SimilarSortKey = 'ref' | 'age' | 'severity' | 'entities' | 'intel' | 'match' | 'closed';

const SEV_ORDER: Record<'Low' | 'Medium' | 'High', number> = { Low: 0, Medium: 1, High: 2 };
// SIMILAR_AGES is ordered youngest first, so its index is the age rank.
const ageRank = (label: string) => {
  const i = SIMILAR_AGES.indexOf(label);
  return i === -1 ? 99 : i;
};

const clsLabel = (c: Classification) => c.replace(/([A-Z])/g, ' $1').trim();

// The historical classification mix leans by alert type — noisy rules skew false
// positive, destructive ones skew true positive. Makes the guidance realistic.
function classificationLean(type: string): Classification[] {
  const t = type.toLowerCase();
  const F: Classification = 'FalsePositive', T: Classification = 'TruePositive', B: Classification = 'BenignPositive';
  if (/(brute|password|spray|failed login|legacy auth|sign-?in|multiple failed|cryptomin)/.test(t)) return [F, F, F, F, F, B, T, F];
  if (/(malware|ransom|exfil|powershell|lolbin|lateral|c2|zero-?day|encrypt|sql injection|exploit)/.test(t)) return [T, T, T, T, T, F, T, B];
  if (/(phish|oauth|consent|inbox rule|credential|guest|token|privilege|api)/.test(t)) return [T, T, F, T, B, F, T, T];
  return [T, F, T, B, F, T, F, T];
}

function buildSimilarIncidents(type: string, seedStr: string) {
  const seed = seedStr.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const items: SimilarIncident[] = classificationLean(type).map((cls, i) => ({
    id: `sim-${seedStr}-${i}`,
    ref: String(1000 + ((seed * 7 + i * 137) % 8999)),
    ageLabel: SIMILAR_AGES[(seed + i * 2) % SIMILAR_AGES.length],
    severity: SIMILAR_SEV[i],
    classification: cls,
    tiScore: SIMILAR_TI[i],
    analyst: SIMILAR_ANALYSTS[(seed + i) % SIMILAR_ANALYSTS.length],
    drop: SIMILAR_DROP[i],
    extras: SIMILAR_EXTRA[i],
  })).sort((a, b) => a.drop - b.drop);

  const counts = items.reduce((acc, it) => {
    acc[it.classification] = (acc[it.classification] || 0) + 1;
    return acc;
  }, {} as Record<Classification, number>);
  const total = items.length;
  const firings = total * 6 + (seed % 9); // "N firings of this rule checked"
  const [majorityClass, majorityCount] = (Object.entries(counts) as [Classification, number][])
    .sort((a, b) => b[1] - a[1])[0];
  return { items, counts, total, firings, majorityClass, majorityCount };
}

// Build the current incident's shared-indicator chips from its entities:
// same rule + the concrete IOCs (IP, ASN, subnet, account, host).
// An AS number on its own tells an analyst nothing — the owning network does.
// Entities a compared incident involves that this one does not. The mock rows
// carry no entity list of their own, so these are derived from the row's ref —
// deterministic, so a given row always shows the same extras.
const EXTRA_USERS = ['m.keller@acmecorp.com', 'svc_backup@acmecorp.com', 'a.novak@acmecorp.com', 'j.tan@acmecorp.com'];
const EXTRA_HOSTS = ['SRV-FILE02', 'LAPTOP-K21H8', 'DESKTOP-Q9WTZ3', 'SRV-DC01'];
const EXTRA_PROCS = ['rundll32.exe', 'wmic.exe', 'certutil.exe', 'mshta.exe'];

function buildExtraFacts(ref: string, count: number): MatchFact[] {
  if (count <= 0) return [];
  const seed = ref.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  const pool: MatchFact[] = [
    { kind: 'User', value: EXTRA_USERS[seed % EXTRA_USERS.length], mono: false },
    { kind: 'Host', value: EXTRA_HOSTS[seed % EXTRA_HOSTS.length], mono: false },
    { kind: 'IP', value: `10.${seed % 200}.${(seed * 3) % 250}.${(seed * 7) % 250}`, mono: true },
    { kind: 'Process', value: EXTRA_PROCS[seed % EXTRA_PROCS.length], mono: false },
  ];
  // Rotate the start so different rows lead with different kinds.
  const start = seed % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

const ASN_ORGS = ['Microsoft', 'Cloudflare', 'Amazon AWS', 'Google Cloud', 'Telia', 'Hetzner', 'DigitalOcean'];
function asnOrg(ip: string): string {
  const seed = ip.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  return ASN_ORGS[seed % ASN_ORGS.length];
}

// The comparable facts two incidents can actually have in common. Alert type is
// deliberately NOT in here — it is the matching criterion, stated once at the top
// of the section, not a variable the overlap count should include.
interface MatchFact { kind: string; value: string; mono: boolean }

// Overall similarity, deliberately simple so it can be explained in a tooltip:
// entity overlap, and — only when both incidents have threat intel — how close the
// two aggregate scores are. Averaged over the components that actually apply.
function similarityScore(shared: number, total: number, tiScore: number | null, incidentTi: number | null) {
  const entityPct = total === 0 ? 0 : Math.round((shared / total) * 100);
  const intelPct = tiScore != null && incidentTi != null
    ? Math.max(0, 100 - Math.abs(tiScore - incidentTi))
    : null;
  const overall = intelPct == null ? entityPct : Math.round((entityPct + intelPct) / 2);
  return { overall, entityPct, intelPct };
}

function buildMatchFacts(entities: { name: string; type: string; score?: number | null }[]): MatchFact[] {
  const ip = entities.find(e => e.type === 'IP');
  const acct = entities.find(e => e.type === 'Account' || e.type === 'Mailbox');
  const host = entities.find(e => e.type === 'Host');
  const hash = entities.find(e => e.type === 'FileHash');
  const proc = entities.find(e => e.type === 'Process');
  const subnet = ip
    ? (ip.name.includes(':')
        ? ip.name.split(':').slice(0, 4).join(':') + '::/64'
        : ip.name.split('.').slice(0, 3).join('.') + '.0/24')
    : null;
  const facts: MatchFact[] = [];
  if (acct) facts.push({ kind: 'User', value: acct.name, mono: false });
  if (ip) facts.push(
    { kind: 'IP', value: ip.name, mono: true },
    { kind: 'ASN', value: asnOrg(ip.name), mono: false },
    { kind: 'Subnet', value: subnet!, mono: true },
  );
  if (host) facts.push({ kind: 'Host', value: host.name, mono: false });
  if (hash) facts.push({ kind: 'File hash', value: hash.name, mono: true });
  if (proc) facts.push({ kind: 'Process', value: proc.name, mono: false });
  return facts;
}

// Distribution-bar / legend dot colour per classification.
// Verdict colours. The brand red is reserved for the one verdict that means a
// real threat; the rest step down the turquoise ramp in the order they deserve
// attention (benign-but-real → not real), and undetermined sits out in neutral.
const CLASS_BAR: Record<Classification, string> = {
  TruePositive: 'bg-[#b73520]',
  BenignPositive: 'bg-[#399193]',
  FalsePositive: 'bg-[#66c1bf]',
  Undetermined: 'bg-[#d0d5dc]',
};

// Primary MITRE ATT&CK tactic for an incident, derived from its alert type.
function getMitreTactic(type: string): string {
  const t = type.toLowerCase();
  if (/(guest user|invited|new inviter|phish|access credential added|oauth|consent|sql injection|exploit|zero-?day)/.test(t)) return 'Initial Access';
  if (/(password|brute|spray|failed login|credential|legacy auth|sign-?in)/.test(t)) return 'Credential Access';
  if (/(privilege escalation|elevat|admin role|sudo)/.test(t)) return 'Privilege Escalation';
  if (/(lateral|psexec)/.test(t)) return 'Lateral Movement';
  if (/(exfil|data exfiltration|mass download)/.test(t)) return 'Exfiltration';
  if (/(ransom|encrypt|insider|file deletion)/.test(t)) return 'Impact';
  if (/(persistence|scheduled task|registry|service principal|api access|resource deployment)/.test(t)) return 'Persistence';
  if (/(c2|command and control|beacon|network traffic)/.test(t)) return 'Command & Control';
  if (/(mailbox|inbox rule|email attachment)/.test(t)) return 'Collection';
  if (/(cryptomin|obfuscat|disable)/.test(t)) return 'Defense Evasion';
  return 'Execution';
}

// ─── Evidence collected (basis for the classification) ────────────────────────
// Inline-highlight IOC-like tokens (emails, IPs, ASNs, hashes, result codes) in mono.
const IOC = /([\w.+-]+@[\w.-]+\.\w{2,}|\b\d{1,3}(?:\.\d{1,3}){3}\b|\bASN\s?\d{3,6}\b|\basn:\d{3,6}\b|\b[0-9a-f]{12,}\b|\b\d{5,6}\b)/gi;
function renderWithCode(text: string) {
  return text.split(IOC).map((p, i) => {
    if (!p) return null;
    const isCode = new RegExp('^(?:' + IOC.source.slice(1, -1) + ')$', 'i').test(p);
    return isCode
      ? <code key={i} className="px-1 py-0.5 rounded-[8px] bg-[#092E3F]/[0.06] text-[#1e7d8f] font-mono text-[12px]">{p}</code>
      : <span key={i}>{p}</span>;
  });
}

// Deterministic evidence trail derived from the incident + its classification —
// what the classification was based on. Shown in its own collapsed section.
function buildEvidence(type: string, classification: Classification, entities: { name: string; type: string }[]): string[] {
  const ip = entities.find(e => e.type === 'IP')?.name ?? '203.0.113.10';
  const user = entities.find(e => e.type === 'Mailbox')?.name ?? entities.find(e => e.type === 'Account')?.name ?? 'the user';
  const host = entities.find(e => e.type === 'Host')?.name ?? 'the host';
  const proc = entities.find(e => e.type === 'Process')?.name;
  const hash = entities.find(e => e.type === 'FileHash')?.name;

  if (classification === 'FalsePositive') return [
    `Triage agent leaning false_positive (ML score 0.06); human review decision = approve.`,
    `${user} signed in from ${ip} (ASN ${asnOrg(ip)}) within the alert window — consistent with the tenant's known network.`,
    `User baseline shows CountryPct 100 and IPSubnetPct 100 for this location — fully consistent with prior activity.`,
    `Failures in the window map to expired/invalid refresh tokens (result 70000) — app/token misconfiguration, not credential compromise.`,
    `Threat intel returned no hits on ${ip}${hash ? ` or ${hash}` : ''}, and history shows no prior similar incidents.`,
  ];
  if (classification === 'TruePositive') return [
    `Triage agent leaning true_positive (ML score 0.91) with high-risk indicators in the alert window.`,
    `${ip} flagged by threat intel${hash ? `; file hash ${hash} matches known malware signatures` : ''}.`,
    `${user} activity deviates from the 30-day baseline (new geography / new ASN / off-hours sign-in).`,
    proc ? `Suspicious process ${proc} observed on ${host}, consistent with hands-on-keyboard activity.` : `Anomalous execution observed on ${host}.`,
    `Successful actions followed initial access — indicates active compromise rather than a failed attempt.`,
  ];
  if (classification === 'BenignPositive') return [
    `Triage agent detected the technique, but it maps to a known maintenance / tooling pattern.`,
    `${user} performing the action is a recognised admin / service identity for this tenant.`,
    `Activity originates from ${ip} (ASN ${asnOrg(ip)}), a known internal / management network.`,
    proc ? `${proc} on ${host} matches an approved administrative tool signature.` : `Host ${host} activity matches an approved change window.`,
    `No threat-intel hits and no deviation from the change-management baseline.`,
  ];
  return [
    `Triage agent score is inconclusive; indicators point in both directions.`,
    `${user} activity partially matches baseline but includes an unexplained sign-in from ${ip}.`,
    `Threat intel is inconclusive for ${ip}${hash ? ` / ${hash}` : ''}.`,
    `Insufficient log coverage in the alert window to confirm success or failure of the activity.`,
  ];
}

interface RecommendedAction {
  id: string;
  action: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  icon: string;
  description: string;
  target?: string;
}

interface Alert {
  id: string;
  name: string;
  severity: SeverityLevel;
  timestamp: string;
  source: string;
  description: string;
}

interface TimelineEvent {
  id: string;
  type: 'created' | 'status_change' | 'assigned' | 'comment' | 'alert' | 'playbook';
  timestamp: string;
  user?: string;
  description: string;
  details?: string;
}

interface Comment {
  id: string;
  user: string;
  role: string;
  timestamp: string;
  content: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  event: string;
  ip?: string;
  user?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  rawData?: Record<string, any>;
}

interface IncidentDetailProps {
  incident: {
    id: string;
    client: { name: string; logo: string };
    incident: string;
    status: IncidentStatus;
    type: string;
    created: string;
    entities: number;
    logs: number;
    severity: SeverityLevel;
    owner: { name: string; role: string } | null;
    attention: AttentionType[];
    tags?: string[];
    classification?: Classification;
  };
  onClose: () => void;
  onUpdateTags?: (incidentId: string, tags: string[]) => void;
  onAutomationComplete?: (incidentId: string) => void;
  // What the deep analysis actually concludes. Applied to `classification` once
  // analysis finishes, so the badge moves from triage's initial guess to the
  // real verdict.
  analysisOutcome?: Classification;
  // The analysis engine's state for this incident, owned by the table so both
  // surfaces always agree. Response Flows (SOAR) are out of scope for now.
  resolve?: {
    feature: string;   // the product name, so it lives in one place
    eta: string;       // how long a real run takes, for the progress copy
    phase: 'idle' | 'analyzing' | 'ready' | 'executing' | 'partial' | 'closed' | 'open';
    closedBy?: 'resolve' | 'analyst';
    done: string[];
    log: string[];
    actions: {
      id: string;
      label: string;
      target?: string;
      tier: 'high' | 'medium' | 'low';
      closes: boolean;
      manualOnly?: boolean;
      cta?: string;   // the verb on the button, e.g. "Investigate"
    }[];
    onAnalyze: () => void;
    onRunAction: (id: string) => void;
    // Verification is a human call, so closing an open incident is too.
    onCloseIncident: () => void;
    // Present only in the "run all" variant under test.
    onRunAll?: () => void;
    progress?: { current: number; total: number };
  };
}

export default function IncidentDetail({ incident, onClose, onUpdateTags, onAutomationComplete, analysisOutcome, resolve }: IncidentDetailProps) {
  const [expandedSections, setExpandedSections] = useState({
    alerts: true,
    timeline: true,
    comments: true,
    logs: false,
    mitre: true,
    entities: true,
    tags: true,
    analysis: true,
    evidence: false,
    similar: true
  });
  const [newComment, setNewComment] = useState('');
  const [copiedLog, setCopiedLog] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isFullScreenLogs, setIsFullScreenLogs] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [assignToAnalyst, setAssignToAnalyst] = useState<string>('');
  const [newStatus, setNewStatus] = useState<IncidentStatus>('Active');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('Medium');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSeverityDropdown, setShowSeverityDropdown] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<IncidentStatus>(incident.status);
  const [currentSeverity, setCurrentSeverity] = useState<SeverityLevel>(incident.severity);
  const [localTags, setLocalTags] = useState<string[]>(incident.tags || []);
  const [newTag, setNewTag] = useState('');
  const [showITSMSidebar, setShowITSMSidebar] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [runningActions, setRunningActions] = useState<string[]>([]);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [classification, setClassification] = useState<Classification>(incident.classification || 'TruePositive');
  // Historical similar incidents (deterministic mock) + their classification mix.
  const similar = useMemo(() => buildSimilarIncidents(incident.type, incident.id), [incident.type, incident.id]);
  const similarPct = Math.round((similar.majorityCount / similar.total) * 100);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [recommendedActions, setRecommendedActions] = useState<RecommendedAction[]>([]);
  // One answer to "has this been analysed". When Resolve owns the panel its
  // phase decides; the local simulation only speaks for the legacy path.
  const analysed = resolve ? resolve.phase !== 'idle' && resolve.phase !== 'analyzing' : analysisComplete;
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [showQueryInterface, setShowQueryInterface] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [copiedEntity, setCopiedEntity] = useState<string | null>(null);
  // Rows whose entity-overlap breakdown is expanded.
  const [openShares, setOpenShares] = useState<Set<string>>(new Set());
  // A full-screen table of the same rows. The sidebar list is fine for a
  // handful; comparing a dozen across four dimensions needs width and sorting.
  const [similarFull, setSimilarFull] = useState(false);
  const [sortKey, setSortKey] = useState<SimilarSortKey>('match');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleShares = (id: string) => setOpenShares(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Mock data for detailed view
  const alerts: Alert[] = [
    {
      id: 'ALT-001',
      name: 'Suspicious PowerShell Execution',
      severity: 'Critical',
      timestamp: '2024-01-15 14:23:45',
      source: 'EDR - Endpoint 192.168.1.45',
      description: 'PowerShell executed with encoded command from unusual process'
    },
    {
      id: 'ALT-002',
      name: 'Unusual Outbound Connection',
      severity: 'High',
      timestamp: '2024-01-15 14:25:12',
      source: 'Firewall - Office Network',
      description: 'Connection to suspicious IP address in known malicious range'
    },
    {
      id: 'ALT-003',
      name: 'File Modification Detected',
      severity: 'Medium',
      timestamp: '2024-01-15 14:27:33',
      source: 'EDR - Endpoint 192.168.1.45',
      description: 'Multiple system files modified in short timeframe'
    }
  ];

  const timeline: TimelineEvent[] = [
    {
      id: 'TL-001',
      type: 'created',
      timestamp: '2024-01-15 14:23:00',
      description: 'Incident created',
      details: 'Automatically generated from correlation engine'
    },
    {
      id: 'TL-002',
      type: 'alert',
      timestamp: '2024-01-15 14:23:45',
      description: 'Alert added: Suspicious PowerShell Execution',
      details: 'Severity: Critical'
    },
    {
      id: 'TL-003',
      type: 'assigned',
      timestamp: '2024-01-15 14:30:00',
      user: 'Sarah Mitchell',
      description: 'Incident assigned to Sarah Mitchell',
      details: 'Auto-assigned based on rotation schedule'
    },
    {
      id: 'TL-004',
      type: 'status_change',
      timestamp: '2024-01-15 14:35:00',
      user: 'Sarah Mitchell',
      description: 'Status changed from New to Active',
    },
    {
      id: 'TL-005',
      type: 'comment',
      timestamp: '2024-01-15 14:40:00',
      user: 'Sarah Mitchell',
      description: 'Comment added',
      details: 'Investigating potential malware infection'
    },
    {
      id: 'TL-006',
      type: 'playbook',
      timestamp: '2024-01-15 14:45:00',
      user: 'Sarah Mitchell',
      description: 'Malware Response playbook started',
      details: 'Endpoint isolation in progress'
    }
  ];

  const comments: Comment[] = [
    {
      id: 'COM-001',
      user: 'Sarah Mitchell',
      role: 'Senior Analyst',
      timestamp: '2024-01-15 14:40:00',
      content: 'Investigating potential malware infection. Initial analysis shows PowerShell was executed with encoded commands. Isolating endpoint and running forensic analysis.'
    },
    {
      id: 'COM-002',
      user: 'James Rodriguez',
      role: 'SOC Analyst',
      timestamp: '2024-01-15 15:15:00',
      content: 'Forensic analysis complete. Found evidence of Cobalt Strike beacon. Malware hash added to blocklist across all customer endpoints.'
    }
  ];

  const logs: LogEntry[] = [
    {
      id: 'LOG-001',
      timestamp: '2024-01-15 14:23:45',
      source: 'Windows Security',
      event: 'Process Creation: powershell.exe -enc SGVsbG8gV29ybGQ=',
      ip: '192.168.1.45',
      user: 'SYSTEM',
      severity: 'High',
      rawData: {
        EventID: 4688,
        EventType: 'ProcessCreation',
        Computer: 'DESKTOP-A45FG21',
        ProcessName: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        CommandLine: 'powershell.exe -enc SGVsbG8gV29ybGQ=',
        ParentProcessName: 'C:\\Windows\\explorer.exe',
        User: 'SYSTEM',
        LogonID: '0x3e7',
        SourceIP: '192.168.1.45',
        DestinationIP: null,
        Port: null,
        Protocol: null,
        Action: 'Allowed',
        RuleName: null
      }
    },
    {
      id: 'LOG-002',
      timestamp: '2024-01-15 14:25:12',
      source: 'Firewall',
      event: 'Outbound connection blocked to 185.220.101.45:443',
      ip: '192.168.1.45',
      severity: 'Critical',
      rawData: {
        EventID: 5157,
        EventType: 'NetworkConnection',
        Computer: 'DESKTOP-A45FG21',
        ProcessName: 'C:\\Windows\\System32\\svchost.exe',
        SourceIP: '192.168.1.45',
        SourcePort: 49823,
        DestinationIP: '185.220.101.45',
        DestinationPort: 443,
        Protocol: 'TCP',
        Action: 'Blocked',
        RuleName: 'Suspicious_Outbound_Block',
        Direction: 'Outbound',
        Application: 'System'
      }
    },
    {
      id: 'LOG-003',
      timestamp: '2024-01-15 14:27:33',
      source: 'File Integrity Monitor',
      event: 'File modified: C:\\Windows\\System32\\drivers\\etc\\hosts',
      ip: '192.168.1.45',
      user: 'SYSTEM',
      severity: 'Medium',
      rawData: {
        EventID: 4663,
        EventType: 'FileModification',
        Computer: 'DESKTOP-A45FG21',
        FilePath: 'C:\\Windows\\System32\\drivers\\etc\\hosts',
        AccessMask: '0x2',
        ProcessName: 'C:\\Windows\\System32\\notepad.exe',
        User: 'SYSTEM',
        PreviousHash: 'a3e5f8c9d2b1e6f4c8a7b3d5e1f9c2a4',
        NewHash: 'b4f6g9d0e3c2f7a5d9b8e4c1f0d3a6b5',
        FileSize: 1024,
        Operation: 'WriteData'
      }
    },
    {
      id: 'LOG-004',
      timestamp: '2024-01-15 14:28:01',
      source: 'Windows Security',
      event: 'Registry modification: HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      ip: '192.168.1.45',
      user: 'SYSTEM',
      severity: 'High',
      rawData: {
        EventID: 4657,
        EventType: 'RegistryModification',
        Computer: 'DESKTOP-A45FG21',
        RegistryPath: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        ValueName: 'WindowsUpdate',
        ValueType: 'REG_SZ',
        NewValue: 'C:\\Users\\Public\\update.exe',
        OldValue: null,
        ProcessName: 'C:\\Windows\\regedit.exe',
        User: 'SYSTEM',
        Operation: 'SetValue'
      }
    },
    {
      id: 'LOG-005',
      timestamp: '2024-01-15 14:30:22',
      source: 'Azure AD',
      event: 'Failed login attempt from unusual location',
      ip: '203.45.67.89',
      user: 'john.doe@acmecorp.com',
      severity: 'Medium',
      rawData: {
        EventID: 50126,
        EventType: 'SignInActivity',
        User: 'john.doe@acmecorp.com',
        Application: 'Office 365',
        IPAddress: '203.45.67.89',
        Location: 'Moscow, Russia',
        DeviceInfo: 'Windows 10 - Chrome 120.0.6099.129',
        Status: 'Failed',
        FailureReason: 'InvalidPasswordError',
        Timestamp: '2024-01-15T14:30:22Z',
        CorrelationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      }
    },
    {
      id: 'LOG-006',
      timestamp: '2024-01-15 14:32:55',
      source: 'EDR',
      event: 'Suspicious process injection detected',
      ip: '192.168.1.45',
      user: 'SYSTEM',
      severity: 'Critical',
      rawData: {
        EventID: 8,
        EventType: 'CreateRemoteThread',
        Computer: 'DESKTOP-A45FG21',
        SourceProcessName: 'C:\\Windows\\System32\\svchost.exe',
        SourceProcessId: 2348,
        TargetProcessName: 'C:\\Windows\\System32\\lsass.exe',
        TargetProcessId: 652,
        StartAddress: '0x7FFE2A3B1000',
        ThreadId: 4532,
        User: 'SYSTEM',
        Technique: 'ProcessInjection',
        MitreTactic: 'DefenseEvasion'
      }
    },
    {
      id: 'LOG-007',
      timestamp: '2024-01-15 14:35:18',
      source: 'DNS',
      event: 'Query to known C2 domain blocked',
      ip: '192.168.1.45',
      severity: 'High',
      rawData: {
        EventID: 22,
        EventType: 'DNSQuery',
        Computer: 'DESKTOP-A45FG21',
        QueryName: 'malicious-c2-server.evil.com',
        QueryType: 'A',
        QueryResult: 'BLOCKED',
        ProcessName: 'C:\\Windows\\System32\\svchost.exe',
        SourceIP: '192.168.1.45',
        DNSServer: '8.8.8.8',
        ThreatCategory: 'C2Communication',
        BlockReason: 'ThreatIntelligenceMatch'
      }
    },
    {
      id: 'LOG-008',
      timestamp: '2024-01-15 14:38:42',
      source: 'Email Gateway',
      event: 'Phishing email delivered to mailbox',
      user: 'john.doe@acmecorp.com',
      severity: 'Medium',
      rawData: {
        EventID: 1001,
        EventType: 'EmailDelivery',
        Recipient: 'john.doe@acmecorp.com',
        Sender: 'noreply@fake-microsoft.com',
        Subject: 'Urgent: Verify Your Account',
        AttachmentCount: 1,
        AttachmentNames: ['invoice.pdf.exe'],
        AttachmentHashes: ['c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'],
        PhishingScore: 87,
        MalwareDetected: true,
        Action: 'Quarantined',
        Timestamp: '2024-01-15T14:38:42Z'
      }
    }
  ];

  const mitreAttacks = [
    { id: 'T1059.001', name: 'PowerShell', tactic: 'Execution' },
    { id: 'T1071.001', name: 'Web Protocols', tactic: 'Command and Control' },
    { id: 'T1547.001', name: 'Registry Run Keys', tactic: 'Persistence' },
    { id: 'T1027', name: 'Obfuscated Files or Information', tactic: 'Defense Evasion' }
  ];

  const entities = [
    { name: 'DESKTOP-A45FG21', type: 'Host', score: null },
    { name: '192.168.1.45', type: 'IP', score: 85 },
    { name: 'john.doe@acmecorp.com', type: 'Mailbox', score: null },
    { name: 'powershell.exe', type: 'Process', score: 72 },
    { name: 'a3e5f8c9d2b1...', type: 'FileHash', score: 91 },
    { name: 'ACME\\\\jdoe', type: 'Account', score: null }
  ];

  // Auto-analyze TruePositives on mount — legacy path only. Resolve seeds its
  // own state in the table, so running this too would contradict it.
  useEffect(() => {
    if (!resolve && classification === 'TruePositive' && !analysisComplete) {
      performAnalysis();
    }
  }, []);

  // When every recommended action has been executed, tell the parent so the
  // incident's table row can flip to the "Automation has run" state.
  useEffect(() => {
    if (recommendedActions.length > 0 && completedActions.length === recommendedActions.length) {
      onAutomationComplete?.(incident.id);
    }
  }, [completedActions, recommendedActions]);

  // Initialize selectedLog when logs section is expanded
  useEffect(() => {
    if (expandedSections.logs && !selectedLog && logs.length > 0) {
      setSelectedLog(logs[0]);
    }
  }, [expandedSections.logs]);

  // Perform analysis
  const performAnalysis = () => {
    setIsAnalyzing(true);
    const isReanalysis = analysisComplete;
    
    // Simulate AI analysis
    setTimeout(() => {
      const actions: RecommendedAction[] = [
        {
          id: 'act-1',
          action: 'Block-AADUser',
          priority: 'Critical',
          icon: 'userx',
          description: 'Block compromised Azure AD user account to prevent further unauthorized access',
          target: 'john.doe@acmecorp.com'
        },
        {
          id: 'act-2',
          action: 'Disable user',
          priority: 'Critical',
          icon: 'userx',
          description: 'Disable user account in Active Directory to revoke all access permissions',
          target: 'ACME\\jdoe'
        },
        {
          id: 'act-3',
          action: 'Revoke-AADSignInSessions',
          priority: 'High',
          icon: 'logout',
          description: 'Revoke all active Azure AD sign-in sessions for the compromised account',
          target: 'john.doe@acmecorp.com'
        },
        {
          id: 'act-4',
          action: 'Confirm-EntraIDRiskyUser',
          priority: 'High',
          icon: 'shieldalert',
          description: 'Confirm user as risky in Entra ID to trigger additional security measures',
          target: 'john.doe@acmecorp.com'
        },
        {
          id: 'act-5',
          action: 'Isolate-MDEMachine',
          priority: 'Critical',
          icon: 'shieldalert',
          description: 'Isolate endpoint from network using Microsoft Defender for Endpoint',
          target: 'DESKTOP-A45FG21'
        },
        {
          id: 'act-6',
          action: 'Make incident in ITSM',
          priority: 'Medium',
          icon: 'clipboard',
          description: 'Create incident ticket in IT Service Management system for tracking',
          target: 'INC-2024-0245'
        },
        {
          id: 'act-7',
          action: 'Block IP In infrastructure',
          priority: 'Critical',
          icon: 'ban',
          description: 'Block malicious IP address at firewall and infrastructure level',
          target: '192.168.1.45'
        }
      ];
      
      setRecommendedActions(actions);
      setAnalysisComplete(true);
      setIsAnalyzing(false);
      // Move from the triage's initial "True Positive" guess to what the analysis
      // actually concluded (manual, no-playbook true positives only).
      if (analysisOutcome) setClassification(analysisOutcome);

      if (isReanalysis) {
        toast.success('Re-analysis complete - Recommendations updated');
      } else {
        toast.success('Analysis complete - Recommended actions identified');
      }
    }, 2500);
  };

  const handleManualAnalyze = () => {
    performAnalysis();
  };

  const runSingleAction = (actionId: string, actionName: string) => {
    if (runningActions.includes(actionId) || completedActions.includes(actionId)) return;
    setRunningActions(prev => [...prev, actionId]);
    setTimeout(() => {
      setRunningActions(prev => prev.filter(id => id !== actionId));
      setCompletedActions(prev => [...prev, actionId]);
      setSelectedActions(prev => prev.filter(id => id !== actionId));
      toast.success(`Action executed: ${actionName}`);
    }, 1800);
  };

  const runSelectedActions = () => {
    if (selectedActions.length === 0) return;
    const toRun = selectedActions.filter(id => !runningActions.includes(id) && !completedActions.includes(id));
    setRunningActions(prev => [...prev, ...toRun]);
    toRun.forEach((id, i) => {
      setTimeout(() => {
        const action = recommendedActions.find(a => a.id === id);
        setRunningActions(prev => prev.filter(rid => rid !== id));
        setCompletedActions(prev => [...prev, id]);
        setSelectedActions(prev => prev.filter(sid => sid !== id));
        if (action) toast.success(`Action executed: ${action.action}`);
      }, 1800 + i * 600);
    });
  };

  const toggleActionSelection = (id: string) => {
    if (runningActions.includes(id) || completedActions.includes(id)) return;
    setSelectedActions(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Handler functions
  const handleAssign = () => {
    if (!assignToAnalyst) return;
    toast.success(`Incident assigned to ${assignToAnalyst}`);
    setActiveModal(null);
    setAssignToAnalyst('');
  };

  const handleChangeStatus = () => {
    toast.success(`Status changed to ${newStatus} with ${newSeverity} severity`);
    setActiveModal(null);
  };

  const handleNotify = () => {
    if (!notificationMessage) return;
    toast.success('Customer notification sent successfully');
    setActiveModal(null);
    setNotificationMessage('');
  };

  const handleCreateTicket = () => {
    toast.success('Support ticket created successfully');
    setActiveModal(null);
  };

  const handleRunPlaybook = () => {
    if (!selectedPlaybook) return;
    toast.success(`${selectedPlaybook} playbook started`);
    setActiveModal(null);
    setSelectedPlaybook('');
  };

  const handleOpenSentinel = () => {
    toast.success('Opening incident in Microsoft Sentinel...');
    window.open('https://portal.azure.com', '_blank');
  };

  const handleOpenAutotask = () => {
    toast.success('Opening ticket in Autotask...');
    window.open('https://ww15.autotask.net', '_blank');
  };

  const handleOpenSeculyze = () => {
    toast.success(`Opening in ${incident.client.name}.Seculyze...`);
    window.open('https://seculyze.com', '_blank');
  };

  const handleGenerateReport = () => {
    toast.success('Generating incident report...');
  };

  const handleStatusChange = (status: IncidentStatus) => {
    setCurrentStatus(status);
    setShowStatusDropdown(false);
    toast.success(`Status changed to ${status}`);
  };

  const handleSeverityChange = (severity: SeverityLevel) => {
    setCurrentSeverity(severity);
    setShowSeverityDropdown(false);
    toast.success(`Severity changed to ${severity}`);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowStatusDropdown(false);
        setShowSeverityDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCopyLog = (logId: string, logText: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(logText).then(() => {
          setCopiedLog(logId);
          setTimeout(() => setCopiedLog(null), 2000);
        }).catch(() => {
          // Fallback if clipboard API fails
          copyToClipboardFallback(logText, logId);
        });
      } else {
        // Fallback for browsers/contexts where clipboard API is blocked
        copyToClipboardFallback(logText, logId);
      }
    } catch (error) {
      copyToClipboardFallback(logText, logId);
    }
  };

  const copyToClipboardFallback = (text: string, logId: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedLog(logId);
      setTimeout(() => setCopiedLog(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
    document.body.removeChild(textArea);
  };

  const handleCopyRawLog = (log: LogEntry) => {
    const rawText = JSON.stringify(log.rawData || log, null, 2);
    const textArea = document.createElement('textarea');
    textArea.value = rawText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success('Log copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error('Failed to copy log');
    }
    document.body.removeChild(textArea);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    toast.success('Comment added successfully');
    setNewComment('');
  };

  // Simple search filter (real-time) - searches through all fields including raw data
  const filterLogsBySearch = (log: LogEntry): boolean => {
    if (!logSearchQuery.trim()) return true;
    
    const lowerQuery = logSearchQuery.toLowerCase();
    
    // Search in basic fields
    if (log.event.toLowerCase().includes(lowerQuery) ||
        log.source.toLowerCase().includes(lowerQuery) ||
        log.timestamp.toLowerCase().includes(lowerQuery) ||
        log.user?.toLowerCase().includes(lowerQuery) ||
        log.ip?.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in raw data (JSON) including EventID and other fields
    if (log.rawData) {
      const rawDataString = JSON.stringify(log.rawData).toLowerCase();
      return rawDataString.includes(lowerQuery);
    }
    
    return false;
  };

  // Advanced query filter (searches raw data)
  const filterLogsByQuery = (log: LogEntry): boolean => {
    if (!activeQuery.trim()) return true;
    
    const lowerQuery = activeQuery.toLowerCase();
    
    // Search in basic fields
    if (log.event.toLowerCase().includes(lowerQuery) ||
        log.source.toLowerCase().includes(lowerQuery) ||
        log.timestamp.toLowerCase().includes(lowerQuery) ||
        log.user?.toLowerCase().includes(lowerQuery) ||
        log.ip?.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in raw data (JSON)
    if (log.rawData) {
      const rawDataString = JSON.stringify(log.rawData).toLowerCase();
      return rawDataString.includes(lowerQuery);
    }
    
    return false;
  };

  const handleRunQuery = () => {
    setActiveQuery(queryText);
    setShowQueryInterface(false);
    const filteredCount = logs.filter(filterLogsByQuery).length;
    toast.success(`Query executed - ${filteredCount} log(s) found`);
  };

  const getFilteredLogs = () => {
    let filtered = logs;
    
    // Apply search filter
    filtered = filtered.filter(filterLogsBySearch);
    
    // Apply query filter if active
    if (activeQuery) {
      filtered = filtered.filter(filterLogsByQuery);
    }
    
    return filtered;
  };

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-700';
      case 'Active': return 'bg-orange-100 text-orange-700';
      case 'Closed': return 'bg-green-100 text-green-700';
    }
  };

  const getSeverityColor = (severity: SeverityLevel) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getTimelineIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created': return <Zap className="w-4 h-4 text-blue-600" />;
      case 'status_change': return <Activity className="w-4 h-4 text-orange-600" />;
      case 'assigned': return <UserPlus className="w-4 h-4 text-purple-600" />;
      case 'comment': return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'playbook': return <Play className="w-4 h-4 text-[#2A96A8]" />;
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    setLocalTags([...localTags, newTag]);
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setLocalTags(localTags.filter(t => t !== tag));
  };

  const handleSaveTags = () => {
    if (onUpdateTags) {
      onUpdateTags(incident.id, localTags);
    }
    toast.success('Tags updated successfully');
  };

  const handleCopyEntity = (entityName: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = entityName;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedEntity(entityName);
      setTimeout(() => setCopiedEntity(null), 2000);
      toast.success('Entity copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast.error('Failed to copy entity');
    }
    document.body.removeChild(textArea);
  };

  // Helper function to get score color and label
  // Threat-intel risk ramp — the brand's threat-intelligence colours: one hue
  // family darkening with risk (light turquoise → navy), not a red/amber/green
  // traffic light. Red is reserved for a *verdict* (True Positive), never for a
  // score band. `bar` fills a meter, `track` is its lighter step of the same
  // ramp, `bg`/`text` are for chips.
  const getScoreColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-[#092E3F]', text: 'text-white', bar: 'bg-[#092E3F]', track: 'bg-[#d7f0ee]', label: 'High Risk' };
    if (score >= 50) return { bg: 'bg-[#d7f0ee]', text: 'text-[#224a4d]', bar: 'bg-[#399193]', track: 'bg-[#e8f6f5]', label: 'Medium Risk' };
    if (score >= 30) return { bg: 'bg-[#e8f6f5]', text: 'text-[#2b7376]', bar: 'bg-[#66c1bf]', track: 'bg-[#f3faf9]', label: 'Low Risk' };
    return { bg: 'bg-[#f3faf9]', text: 'text-[#727b8d]', bar: 'bg-[#aee1de]', track: 'bg-[#f3faf9]', label: 'Safe' };
  };

  const getClassificationColor = (cls: Classification) => {
    switch (cls) {
      case 'TruePositive': return 'bg-red-100 text-red-700 border-red-200';
      case 'FalsePositive': return 'bg-green-100 text-green-700 border-green-200';
      case 'BenignPositive': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Undetermined': return 'bg-gray-100 text-gray-700 border-[var(--stroke)]';
    }
  };

  const getActionIcon = (iconName: string) => {
    switch (iconName) {
      case 'ban': return <Ban className="w-4 h-4" />;
      case 'keyround': return <KeyRound className="w-4 h-4" />;
      case 'logout': return <LogOut className="w-4 h-4" />;
      case 'shieldalert': return <ShieldAlert className="w-4 h-4" />;
      case 'userx': return <UserX className="w-4 h-4" />;
      case 'clipboard': return <Clipboard className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-[var(--stroke)]';
    }
  };

  // Mock threat intel scores
  const threatIntelScores = {
    overall: 78,
    ip: 85,
    url: 62,
    hash: 91
  };

  return (
    <>
      {/* Full-Screen Logs View */}
      {isFullScreenLogs && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[60] animate-in fade-in duration-200"
            onClick={() => setIsFullScreenLogs(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-[8px] shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-[#092E3F] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-[8px]">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-white" />
                  <div>
                    <h2 className="text-xl text-white">All Logs - Incident {incident.incident}</h2>
                    <p className="text-white/70 text-sm">{logs.length} log entries</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFullScreenLogs(false)}
                  className="p-2 rounded-[8px] hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Full-Screen Logs Content */}
              <div className="flex-1 overflow-hidden">
                <div className="flex flex-col h-full p-4 gap-4">
                  {/* Query Interface */}
                  {showQueryInterface && (
                    <div className="border border-[#2A96A8] rounded-[8px] bg-white overflow-hidden flex-shrink-0">
                      <div className="bg-[#092E3F] px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-5 h-5 text-white" />
                          <h4 className="text-base text-white font-medium">Query Logs</h4>
                        </div>
                        <button
                          onClick={() => setShowQueryInterface(false)}
                          className="p-1 hover:bg-white/10 rounded-[8px] transition-colors"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                      <div className="p-4">
                        <textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder="Enter query (e.g., EventID: 4688, ProcessCreation, powershell.exe, C:\Windows\System32)..."
                          className="w-full h-32 px-3 py-2 text-sm font-mono border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] resize-none"
                        />
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-sm text-[#092E3F]/60">Query searches through all raw log data including EventID, ProcessName, CommandLine, DestinationIP, and more.</p>
                          <button
                            onClick={handleRunQuery}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            Run Query
                          </button>
                        </div>
                        {activeQuery && (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-[8px] flex items-center justify-between">
                            <p className="text-sm text-green-700">Active query: <span className="font-mono font-medium">{activeQuery}</span></p>
                            <button
                              onClick={() => { setActiveQuery(''); setQueryText(''); }}
                              className="text-sm text-green-700 hover:text-green-900 underline"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-[30%_70%] gap-4 flex-1 overflow-hidden">
                    {/* Left: Log List */}
                    <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
                      <div className="sticky top-0 bg-white border-b border-[var(--stroke)] px-4 py-3 flex-shrink-0">
                        <h4 className="text-sm font-medium text-[#092E3F] mb-3">Log Entries ({getFilteredLogs().length})</h4>
                        
                        {/* Search Bar */}
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#092E3F]/40" />
                          <input
                            type="text"
                            placeholder="Search logs..."
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8]"
                          />
                        </div>

                        {/* Run Query Button */}
                        <button
                          onClick={() => setShowQueryInterface(!showQueryInterface)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#092E3F] text-white rounded-[8px] hover:bg-[#092E3F]/90 transition-colors"
                        >
                          <Terminal className="w-4 h-4" />
                          {showQueryInterface ? 'Hide Query' : 'Run Query'}
                        </button>
                      </div>
                      <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {getFilteredLogs().map((log) => (
                        <button
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className={`w-full p-3 rounded-[8px] text-left transition-colors ${
                            selectedLog?.id === log.id 
                              ? 'bg-[#2A96A8]/10 border border-[#2A96A8]' 
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs text-[#092E3F]/60 font-mono">{log.timestamp}</span>
                            {log.severity && (
                              <span className={`px-2 py-0.5 rounded-[8px] text-xs border ${getSeverityColor(log.severity)}`}>
                                {log.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#2A96A8] font-medium mb-1">{log.source}</p>
                          <p className="text-sm text-[#092E3F] line-clamp-2">{log.event}</p>
                          {log.ip && <p className="text-xs text-[#092E3F]/50 font-mono mt-1">IP: {log.ip}</p>}
                          {log.user && <p className="text-xs text-[#092E3F]/50 font-mono">User: {log.user}</p>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Raw Log Details */}
                  <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
                    <div className="sticky top-0 bg-white border-b border-[var(--stroke)] px-4 py-3 flex items-center justify-between flex-shrink-0">
                      <h4 className="text-sm font-medium text-[#092E3F]">Raw Log Data</h4>
                      {selectedLog && (
                        <button
                          onClick={() => handleCopyRawLog(selectedLog)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#2A96A8] hover:bg-[#2A96A8]/10 rounded-[8px] transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {selectedLog ? (
                        <div className="p-6">
                          {/* Basic Info */}
                          <div className="mb-6 pb-6 border-b border-[var(--stroke)]">
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`px-3 py-1 rounded-[8px] text-sm border ${getSeverityColor(selectedLog.severity || 'Medium')}`}>
                                {selectedLog.severity || 'Medium'}
                              </span>
                              <span className="text-sm text-[#2A96A8] font-medium">{selectedLog.source}</span>
                            </div>
                            <p className="text-base text-[#092E3F] mb-2">{selectedLog.event}</p>
                            <p className="text-sm text-[#092E3F]/60 font-mono">{selectedLog.timestamp}</p>
                          </div>

                          {/* Raw JSON Data */}
                          <div className="bg-[#092E3F] rounded-[8px] p-6 overflow-x-auto">
                            <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                              {JSON.stringify(selectedLog.rawData || {
                                id: selectedLog.id,
                                timestamp: selectedLog.timestamp,
                                source: selectedLog.source,
                                event: selectedLog.event,
                                ...(selectedLog.ip && { ip: selectedLog.ip }),
                                ...(selectedLog.user && { user: selectedLog.user }),
                                ...(selectedLog.severity && { severity: selectedLog.severity })
                              }, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#092E3F]/60">
                          Select a log entry to view details
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className={`fixed top-0 right-0 h-full w-full bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col transition-all ${
        isExpanded ? 'max-w-[95vw]' : 'max-w-3xl'
      }`}>
        {/* Header */}
        <div className="bg-[#092E3F] px-8 py-6 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <img 
                src={incident.client.logo} 
                alt={incident.client.name}
                className="w-12 h-12 rounded-full bg-white p-1"
              />
              <div>
                <h2 className="text-2xl text-white mb-1">Incident {incident.incident}</h2>
                <p className="text-white/70 text-sm">{incident.client.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-[8px] hover:bg-white/10 transition-colors"
                title={isExpanded ? 'Collapse panel' : 'Expand panel'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-6 h-6 text-white" />
                ) : (
                  <Maximize2 className="w-6 h-6 text-white" />
                )}
              </button>
              <button 
                onClick={onClose}
                className="p-2 rounded-[8px] hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-3">
            {/* Status Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowStatusDropdown(!showStatusDropdown);
                  setShowSeverityDropdown(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-sm cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(currentStatus)}`}
              >
                {currentStatus}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-[8px] shadow-lg border border-[var(--stroke)] py-1 z-50 min-w-[120px]">
                  {(['New', 'Active', 'Closed'] as IncidentStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        currentStatus === status ? 'bg-gray-100 font-medium text-[#2A96A8]' : 'text-[#092E3F]'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Severity Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowSeverityDropdown(!showSeverityDropdown);
                  setShowStatusDropdown(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[8px] text-sm border cursor-pointer hover:opacity-80 transition-opacity ${getSeverityColor(currentSeverity)}`}
              >
                {currentSeverity}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showSeverityDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-[8px] shadow-lg border border-[var(--stroke)] py-1 z-50 min-w-[120px]">
                  {(['Critical', 'High', 'Medium', 'Low'] as SeverityLevel[]).map((severity) => (
                    <button
                      key={severity}
                      onClick={() => handleSeverityChange(severity)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        currentSeverity === severity ? 'bg-gray-100 font-medium text-[#2A96A8]' : 'text-[#092E3F]'
                      }`}
                    >
                      {severity}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="px-3 py-1 rounded-[8px] text-sm bg-white/20 text-white">
              {incident.type}
            </span>
          </div>
        </div>

        {/* External Actions Bar — uniform, equal-width buttons */}
        <div className="px-8 py-3 border-b border-[var(--stroke)] flex items-center gap-2 flex-shrink-0 bg-white">
          <span className="text-xs text-[#092E3F]/45 shrink-0 whitespace-nowrap">Open in</span>
          <button
            onClick={handleOpenSentinel}
            title="Open in Microsoft Sentinel"
            className="flex-1 flex items-center justify-start gap-2 px-3 py-1.5 whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <img src={imgSentinelPng} alt="" className="h-4 w-auto object-contain shrink-0" />
            Sentinel
          </button>
          <button
            onClick={handleOpenAutotask}
            title="Open in Autotask"
            className="flex-1 flex items-center justify-start gap-2 px-3 py-1.5 whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <img src={imgAutotaskPng} alt="" className="h-4 w-auto object-contain shrink-0" />
            Autotask
          </button>
          <button
            onClick={handleOpenSeculyze}
            title={`Open in ${incident.client.name}.Seculyze`}
            className="flex-1 flex items-center justify-start gap-2 px-3 py-1.5 whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <img src={imgSeculyzePng} alt="Seculyze" className="h-3.5 w-auto object-contain shrink-0" />
            {incident.client.name}
          </button>
          <button
            onClick={handleGenerateReport}
            title="Generate report"
            className="flex-1 flex items-center justify-start gap-2 px-3 py-1.5 whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <FileCheck className="w-4 h-4 shrink-0 text-[#092E3F]/40" />
            Report
          </button>
          <button
            onClick={() => setShowITSMSidebar(true)}
            title="Create ITSM ticket"
            className="flex-1 flex items-center justify-start gap-2 px-3 py-1.5 whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] hover:border-[#2A96A8] hover:text-[#2A96A8] transition-all text-xs"
          >
            <Ticket className="w-4 h-4 shrink-0 text-[#092E3F]/40" />
            ITSM Ticket
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          {/* Metadata Panel — compact; client/type/owner already shown in the header */}
          <div className="bg-gray-50 rounded-[8px] px-5 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-[#2A96A8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#092E3F]/50">Created</p>
                  <p className="text-sm text-[#092E3F] truncate">{incident.created}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <Target className="w-4 h-4 text-[#2A96A8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#092E3F]/50">MITRE Tactic</p>
                  <p className="text-sm text-[#092E3F] truncate">{getMitreTactic(incident.type)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-[#2A96A8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#092E3F]/50">Alerts</p>
                  <p className="text-sm text-[#092E3F] truncate">{alerts.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-[#2A96A8] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#092E3F]/50">Logs</p>
                  <p className="text-sm text-[#092E3F] truncate">{incident.logs}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Threat Intel Scores Section */}
          <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs text-[#092E3F]/60 uppercase tracking-wider">Threat Intelligence Scores</h3>
              <span className="text-[10px] text-[#092E3F]/40 italic">Hover for details</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Overall Threat Intel Score */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-[8px] group relative">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#092E3F]/60" />
                  <span className="text-xs text-[#092E3F]/70">Overall</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-[#e8f6f5] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(threatIntelScores.overall).bar} transition-all duration-500`}
                      style={{ width: `${threatIntelScores.overall}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#092E3F] font-medium min-w-[2rem] text-right">{threatIntelScores.overall}/100</span>
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-[#092E3F] text-white text-xs rounded-[8px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                  <p className="font-medium mb-1">Overall Threat Score</p>
                  <p className="text-white/80">Aggregated threat intelligence score based on all indicators. Higher scores indicate greater threat level (0-100).</p>
                </div>
              </div>

              {/* IP Score */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-[8px] group relative">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-[#092E3F]/60" />
                  <span className="text-xs text-[#092E3F]/70">IP</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-[#e8f6f5] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(threatIntelScores.ip).bar} transition-all duration-500`}
                      style={{ width: `${threatIntelScores.ip}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#092E3F] font-medium min-w-[2rem] text-right">{threatIntelScores.ip}/100</span>
                </div>
                {/* Tooltip */}
                <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-[#092E3F] text-white text-xs rounded-[8px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                  <p className="font-medium mb-1">IP Reputation Score</p>
                  <p className="text-white/80">Threat score for IP addresses involved in this incident based on global threat intelligence feeds.</p>
                </div>
              </div>

              {/* URL Score */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-[8px] group relative">
                <div className="flex items-center gap-2">
                  <Link className="w-3.5 h-3.5 text-[#092E3F]/60" />
                  <span className="text-xs text-[#092E3F]/70">URL</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-[#e8f6f5] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(threatIntelScores.url).bar} transition-all duration-500`}
                      style={{ width: `${threatIntelScores.url}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#092E3F] font-medium min-w-[2rem] text-right">{threatIntelScores.url}/100</span>
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-[#092E3F] text-white text-xs rounded-[8px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                  <p className="font-medium mb-1">URL Reputation Score</p>
                  <p className="text-white/80">Threat score for URLs and domains detected in this incident based on malicious activity patterns.</p>
                </div>
              </div>

              {/* Hash Score */}
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-[8px] group relative">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-[#092E3F]/60" />
                  <span className="text-xs text-[#092E3F]/70">Hash</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-[#e8f6f5] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(threatIntelScores.hash).bar} transition-all duration-500`}
                      style={{ width: `${threatIntelScores.hash}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#092E3F] font-medium min-w-[2rem] text-right">{threatIntelScores.hash}/100</span>
                </div>
                {/* Tooltip */}
                <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-[#092E3F] text-white text-xs rounded-[8px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                  <p className="font-medium mb-1">File Hash Reputation Score</p>
                  <p className="text-white/80">Threat score for file hashes based on known malware signatures and behavioral analysis.</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div id="ai-analysis-section">
            <button
              onClick={() => toggleSection('analysis')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2A96A8]" />
                <h3 className="text-lg text-[#092E3F]">AI Analysis & Recommendations</h3>
                {analysed && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-[8px]">
                    Complete
                  </span>
                )}
              </div>
              {expandedSections.analysis ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.analysis && (
              <div className="space-y-4">
                {/* Resolve — the analysis engine's state for this incident.
                    Analysts watch several screens at once, so every wait says
                    what is happening and roughly how long it takes. */}
                {resolve && (() => {
                  const r = resolve;
                  const ran = r.actions.filter(a => r.done.includes(a.id));
                  const pending = r.actions.filter(a => !r.done.includes(a.id));

                  if (r.phase === 'idle') {
                    return (
                      <div className="flex items-start gap-3 p-4 rounded-[8px] border border-[#2A96A8]/30 bg-[#e5f2f4]/60">
                        <Sparkles className="w-4 h-4 text-[#1e7d8f] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#092E3F]">This incident has not been analysed</p>
                          <p className="text-xs text-[#092E3F]/60 mt-0.5">
                            {r.feature} will review the entities, threat intel and comparable past incidents,
                            then propose what to do. Typically {r.eta}.
                          </p>
                        </div>
                        <button
                          onClick={r.onAnalyze}
                          className="shrink-0 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[8px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                        >
                          Analyze
                        </button>
                      </div>
                    );
                  }

                  if (r.phase === 'analyzing') {
                    return (
                      <div className="p-4 rounded-[8px] border border-[#2A96A8]/30 bg-[#e5f2f4]/60">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-[#1e7d8f] animate-spin shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#092E3F]">{r.feature} is analysing this incident</p>
                            <p className="text-xs text-[#092E3F]/60 mt-0.5">
                              Usually takes {r.eta}. You can leave this open or come back to it.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-1 rounded-full bg-white overflow-hidden">
                          <div className="h-full w-1/3 rounded-full bg-[#2A96A8] animate-pulse" />
                        </div>
                        <div className="flex gap-4 mt-2.5 text-[11px] text-[#092E3F]/50">
                          <span>Correlating entities</span>
                          <span>Scoring threat intel</span>
                          <span>Comparing past incidents</span>
                        </div>
                      </div>
                    );
                  }

                  if (r.phase === 'executing') {
                    return (
                      <div className="flex items-center gap-3 p-4 rounded-[8px] border border-[#2A96A8]/30 bg-[#e5f2f4]/60">
                        <Loader2 className="w-4 h-4 text-[#1e7d8f] animate-spin shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#092E3F]">
                            {r.progress ? `Running action ${r.progress.current} of ${r.progress.total}` : 'Running the action'}
                          </p>
                          <p className="text-xs text-[#092E3F]/60 mt-0.5">The incident updates as soon as it completes.</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden">
                      <div className={`flex items-start gap-3 px-4 py-3 ${r.phase === 'closed' ? 'bg-[#e3f0e8]' : 'bg-[#f6f6f6]'}`}>
                        {r.phase === 'closed'
                          ? <CheckCircle className="w-4 h-4 text-[#2f7d52] mt-0.5 shrink-0" />
                          : <Sparkles className="w-4 h-4 text-[#1e7d8f] mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#092E3F]">
                            {r.phase === 'closed'
                              ? r.closedBy === 'analyst'
                                ? 'Incident closed — you verified the response'
                                : 'Incident closed — the response completed'
                              : r.phase === 'open' || r.phase === 'partial'
                                ? 'Actions taken — incident kept open for your verification'
                                : `${r.feature} proposed ${r.actions.length} action${r.actions.length !== 1 ? 's' : ''}`}
                          </p>
                          {(r.phase === 'open' || r.phase === 'partial') && (
                            <p className="text-xs text-[#092E3F]/60 mt-0.5">
                              Containment that isolates a device does not prove the attack is over. Confirm it, then close.
                            </p>
                          )}
                        </div>
                        {/* Variant B's bulk button. Reclassification is excluded, so
                            the count is of automatic actions only. */}
                        {r.phase === 'ready' && r.onRunAll && r.actions.filter(a => !a.manualOnly).length > 1 && (
                          <button
                            onClick={r.onRunAll}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[#2A96A8] text-white hover:bg-[#1e7d8f] transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Run all {r.actions.filter(a => !a.manualOnly).length}
                          </button>
                        )}
                        {/* The close the table's "Verify & close" sends you here for.
                            Only the analyst can make this call. */}
                        {(r.phase === 'open' || r.phase === 'partial') && (
                          <button
                            onClick={r.onCloseIncident}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[#092E3F] text-white hover:bg-[#0c4155] transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Close incident
                          </button>
                        )}
                      </div>

                      {/* Once the incident is closed the leftovers are no longer
                          a to-do list, so they stop offering a Run button. */}
                      {pending.length > 0 && r.phase !== 'closed' && (
                        <div className="divide-y divide-gray-100">
                          {pending.map(a => (
                            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-[#092E3F]">{a.label}</span>
                                  {a.manualOnly && (
                                    <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#f7efdf] text-[#c07d1e]">
                                      Your decision
                                    </span>
                                  )}
                                  {!a.closes && !a.manualOnly && (
                                    <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#f1f4f5] text-[#5c707a]">
                                      Leaves incident open
                                    </span>
                                  )}
                                </div>
                                {a.target && <p className="font-mono text-[11px] text-[#092E3F]/50 mt-0.5 truncate">{a.target}</p>}
                                {a.manualOnly && (
                                  <p className="text-[11px] text-[#092E3F]/55 mt-1 leading-relaxed">
                                    {r.feature} disagrees with the current classification. Reclassifying is never
                                    automatic — you decide.
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => r.onRunAction(a.id)}
                                className="shrink-0 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-white border border-[var(--stroke)] text-[#092E3F] hover:bg-[#092E3F] hover:text-white transition-colors"
                              >
                                {a.cta ?? (a.manualOnly ? 'Reclassify' : 'Run')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* What was actually done, and when — the changelog. */}
                      {r.log.length > 0 && (
                        <div className="px-4 py-3 bg-[#fbfcfc] border-t border-gray-100">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[#092E3F]/45 mb-1.5">
                            Changelog
                          </p>
                          <ol className="space-y-1">
                            {r.log.map((line, i) => (
                              <li key={i} className="flex gap-2 text-[11px] text-[#092E3F]/70">
                                <span className="text-[#092E3F]/30 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ol>
                          {ran.length > 0 && (
                            <p className="text-[11px] text-[#092E3F]/45 mt-2">
                              {ran.length} action{ran.length !== 1 ? 's' : ''} run by {r.feature}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Analysis Status — legacy path; Resolve draws its own progress. */}
                {!resolve && isAnalyzing && (
                  <div className="flex items-center justify-center gap-3 p-8 bg-gradient-to-br from-[#2A96A8]/10 to-[#092E3F]/10 rounded-[8px]">
                    <Loader2 className="w-6 h-6 text-[#2A96A8] animate-spin" />
                    <div>
                      <p className="text-sm text-[#092E3F] font-medium">Analyzing incident...</p>
                      <p className="text-xs text-[#092E3F]/60">AI is evaluating threat indicators and generating recommendations</p>
                    </div>
                  </div>
                )}

                {/* Auto-analysis note for TruePositives (hidden when a flow owns the response) */}
                {!resolve && classification === 'TruePositive' && !isAnalyzing && analysisComplete && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-[8px]">
                    <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      This incident was automatically analyzed as a <strong>True Positive</strong>. Recommended actions have been generated based on threat intelligence.
                    </p>
                  </div>
                )}

                {/* Manual analysis note — legacy path only. */}
                {!resolve && classification !== 'TruePositive' && !analysisComplete && !isAnalyzing && (
                  <div className="flex items-start gap-2 p-3 bg-gray-50 border border-[var(--stroke)] rounded-[8px]">
                    <AlertTriangle className="w-4 h-4 text-[#092E3F]/60 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-[#092E3F]/70">
                      This incident is classified as <strong>{classification.replace(/([A-Z])/g, ' $1').trim()}</strong>. Click "Analyze Now" to generate AI-powered recommendations.
                    </p>
                  </div>
                )}

                {/* Recommended Actions — for manual incidents; flow-owned incidents
                    use the "Response actions" list above instead (single source of truth). */}
                {!resolve && analysisComplete && recommendedActions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm text-[#092E3F] font-medium">Recommended Actions</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#092E3F]/50">{completedActions.length}/{recommendedActions.length} done</span>
                        {selectedActions.length > 1 && (
                          <button
                            onClick={runSelectedActions}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[#092E3F] text-white rounded-[8px] text-xs hover:bg-[#092E3F]/90 transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            Run {selectedActions.length} Selected
                          </button>
                        )}
                      </div>
                    </div>

                    {recommendedActions.map((action) => {
                            const isRunning = runningActions.includes(action.id);
                            const isDone = completedActions.includes(action.id);
                            const isSelected = selectedActions.includes(action.id);
                            return (
                              <div
                                key={action.id}
                                onClick={() => !isRunning && !isDone && toggleActionSelection(action.id)}
                                className={`p-4 rounded-[8px] border transition-all group ${
                                  isDone
                                    ? 'bg-green-50 border-green-200 opacity-75'
                                    : isRunning
                                    ? 'bg-[#e5f2f4]/50 border-[#2A96A8]'
                                    : isSelected
                                    ? 'bg-[#e5f2f4]/40 border-[#2A96A8] cursor-pointer'
                                    : 'bg-white border-[var(--stroke)] hover:border-[#2A96A8]/40 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0 mt-0.5">
                                    {isDone ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : isRunning ? (
                                      <Loader2 className="w-4 h-4 text-[#2A96A8] animate-spin" />
                                    ) : (
                                      <div className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors ${
                                        isSelected ? 'border-[#2A96A8] bg-[#2A96A8]' : 'border-gray-300'
                                      }`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                    )}
                                  </div>

                                  <div className="p-1.5 bg-[#092E3F]/5 rounded-[8px] flex-shrink-0">
                                    {getActionIcon(action.icon)}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <h5 className={`text-sm font-medium ${isDone ? 'text-green-700 line-through' : 'text-[#092E3F]'}`}>
                                        {action.action}
                                      </h5>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-[8px] font-medium ${
                                        action.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                                        action.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                                        action.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-500'
                                      }`}>
                                        {action.priority}
                                      </span>
                                      {isRunning && <span className="text-[10px] text-[#2A96A8]">Running…</span>}
                                      {isDone && <span className="text-[10px] text-green-600">Completed</span>}
                                    </div>
                                    <p className="text-xs text-[#092E3F]/70 mb-1">{action.description}</p>
                                    {action.target && (
                                      <p className="text-xs text-[#2A96A8] font-mono">{action.target}</p>
                                    )}
                                  </div>

                                  {!isRunning && !isDone && (
                                    <button
                                      onClick={e => { e.stopPropagation(); runSingleAction(action.id, action.action); }}
                                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-[#092E3F] text-white rounded-[8px] text-[10px] hover:bg-[#092E3F]/90 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    >
                                      <Play className="w-2.5 h-2.5" />
                                      Run
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                    {selectedActions.length === 1 && (
                      <button
                        onClick={runSelectedActions}
                        className="w-full py-2 flex items-center justify-center gap-2 bg-[#092E3F] text-white rounded-[8px] text-sm hover:bg-[#092E3F]/90 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Run Selected Action
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Evidence Collected — what the classification was based on; collapsed by default */}
          <div>
            <button
              onClick={() => toggleSection('evidence')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Evidence Collected</h3>
              </div>
              {expandedSections.evidence ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.evidence && (
              analysed ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#092E3F]/45 -mt-2 mb-1">What the classification was based on</p>
                  {buildEvidence(incident.type, classification, entities).map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-[8px]">
                      <span className="text-[#2A96A8] text-sm leading-6 shrink-0">&#9656;</span>
                      <p className="text-sm text-[#092E3F]/85 leading-relaxed">{renderWithCode(ev)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#092E3F]/50 italic">Run AI analysis to see the evidence behind the classification.</p>
              )
            )}
          </div>

          {/* Entities Section */}
          <div>
            <button
              onClick={() => toggleSection('entities')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Entities</h3>
                <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[8px]">
                  {entities.length}
                </span>
              </div>
              {expandedSections.entities ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.entities && (
              <div className="grid grid-cols-2 gap-2">
                {entities.map((entity, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group relative">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#092E3F] truncate">{entity.name}</p>
                      <p className="text-xs text-[#092E3F]/50">{entity.type}</p>
                    </div>
                    <button
                      onClick={() => handleCopyEntity(entity.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-[8px]"
                      title="Copy entity"
                    >
                      {copiedEntity === entity.name ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#092E3F]/60" />
                      )}
                    </button>
                    {entity.score !== null && (
                      <>
                        <span className={`px-1.5 py-0.5 ${getScoreColor(entity.score).bg} ${getScoreColor(entity.score).text} text-[10px] rounded-[8px] font-medium flex-shrink-0 cursor-help`}>
                          {entity.score}
                        </span>
                        {/* Tooltip for entity score */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 bg-[#092E3F] text-white text-[11px] rounded-[8px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                          <p className="font-medium mb-0.5">Threat Intel Score: {entity.score}/100</p>
                          <p className="text-white/80">
                            {entity.type === 'IP' && 'IP reputation score based on threat intelligence feeds'}
                            {entity.type === 'Process' && 'Process behavior score based on known malicious patterns'}
                            {entity.type === 'FileHash' && 'File hash reputation from malware signatures database'}
                          </p>
                        </div>
                      </>
                    )}
                    {entity.type === 'Host' && <Monitor className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                    {entity.type === 'IP' && <Globe className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                    {entity.type === 'Mailbox' && <Mail className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                    {entity.type === 'Process' && <Terminal className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                    {entity.type === 'FileHash' && <FileText className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                    {entity.type === 'Account' && <User className="w-4 h-4 text-[#2A96A8] flex-shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MITRE ATT&CK Mapping */}
          <div>
            <button
              onClick={() => toggleSection('mitre')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">MITRE ATT&CK Mapping</h3>
                <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[8px]">
                  {mitreAttacks.length} techniques
                </span>
              </div>
              {expandedSections.mitre ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.mitre && (
              <div className="space-y-2">
                {mitreAttacks.map(attack => (
                  <div key={attack.id} className="flex items-center justify-between p-3 bg-white border border-[var(--stroke)] rounded-[8px] hover:border-[#2A96A8] transition-colors group">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-[#092E3F] text-white text-xs rounded-[8px] font-mono">
                        {attack.id}
                      </span>
                      <div>
                        <p className="text-sm text-[#092E3F]">{attack.name}</p>
                        <p className="text-xs text-[#092E3F]/60">{attack.tactic}</p>
                      </div>
                    </div>
                    <a 
                      href={`https://attack.mitre.org/techniques/${attack.id.replace('.', '/')}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-4 h-4 text-[#2A96A8]" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerts Section */}
          <div>
            <button
              onClick={() => toggleSection('alerts')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Alerts</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-[8px]">
                  {alerts.length}
                </span>
              </div>
              {expandedSections.alerts ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.alerts && (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div key={alert.id} className="p-4 bg-white border border-[var(--stroke)] rounded-[8px] hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#092E3F]/60">{alert.id}</span>
                        <span className={`px-2 py-0.5 rounded-[8px] text-xs ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <span className="text-xs text-[#092E3F]/50">{alert.timestamp}</span>
                    </div>
                    <h4 className="text-sm text-[#092E3F] mb-1">{alert.name}</h4>
                    <p className="text-xs text-[#092E3F]/60 mb-2">{alert.description}</p>
                    <p className="text-xs text-[#2A96A8]">{alert.source}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div>
            <button
              onClick={() => toggleSection('timeline')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Timeline</h3>
              </div>
              {expandedSections.timeline ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.timeline && (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {timeline.map(event => (
                    <div key={event.id} className="relative pl-12">
                      <div className="absolute left-0 top-1 w-8 h-8 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center">
                        {getTimelineIcon(event.type)}
                      </div>
                      <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm text-[#092E3F]">{event.description}</p>
                          <span className="text-xs text-[#092E3F]/50 whitespace-nowrap ml-3">{event.timestamp}</span>
                        </div>
                        {event.user && (
                          <p className="text-xs text-[#092E3F]/60 mb-1">by {event.user}</p>
                        )}
                        {event.details && (
                          <p className="text-xs text-[#092E3F]/50">{event.details}</p>
                        )}
                      </div>
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
                <MessageSquare className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Comments & Notes</h3>
                <span className="px-2 py-0.5 bg-gray-200 text-[#092E3F]/70 text-xs rounded-[8px]">
                  {comments.length}
                </span>
              </div>
              {expandedSections.comments ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.comments && (
              <div className="space-y-4">
                {/* Add Comment */}
                <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment or note..."
                    rows={3}
                    className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Add Comment
                    </button>
                  </div>
                </div>

                {/* Existing Comments */}
                {comments.map(comment => (
                  <div key={comment.id} className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-[#092E3F]">{comment.user}</p>
                        <p className="text-xs text-[#092E3F]/50">{comment.role}</p>
                      </div>
                      <span className="text-xs text-[#092E3F]/50">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-[#092E3F]/80">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Similar Incidents — the point of this section is that an analyst can
              see WHY something counts as similar, so the matching criteria are
              stated outright and the overlap is shown fact by fact rather than
              compressed into a percentage. */}
          <div>
            <button
              onClick={() => toggleSection('similar')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Similar Incidents</h3>
                <span onClick={e => e.stopPropagation()} className="inline-flex">
                  <InfoTip wide align="left">
                    Past incidents from the same tenant (<span className="font-semibold">{incident.client.name}</span>) with
                    the same alert type, already closed with a classification in the last 90 days.
                    <span className="block mt-1.5">
                      Ranked by how many of this incident&rsquo;s{' '}
                      <span className="font-semibold">{buildMatchFacts(entities).length} entities</span> they also involve
                      {threatIntelScores.overall != null
                        ? <>, and how close their threat-intel score is to this incident&rsquo;s <span className="font-semibold">{threatIntelScores.overall}/100</span>.</>
                        : <>. This incident has no threat intel, so intel is not used for comparison.</>}
                    </span>
                  </InfoTip>
                </span>
                <span className="px-2 py-0.5 bg-[#2A96A8]/10 text-[#2A96A8] text-xs rounded-[8px]">
                  {similar.total}
                </span>
              </div>
              <span className="flex items-center gap-3">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); setSimilarFull(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSimilarFull(true); } }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--stroke)] rounded-[8px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full size
                </span>
                {expandedSections.similar ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
              </span>
            </button>
            {expandedSections.similar && (() => {
              const facts = buildMatchFacts(entities);
              const allExpanded = similar.items.every(i => openShares.has(i.id));
              const incidentTi: number | null = threatIntelScores.overall;
              return (
              <div className="space-y-4">

                {/* How they were resolved, and the one action that implies. */}
                <div className="p-4 bg-gray-50 rounded-[8px]">
                  <p className="text-[11px] font-medium text-[#092E3F]/50 uppercase tracking-wide mb-2">How they were resolved</p>
                  <p className="text-sm text-[#092E3F]">
                    <span className="font-medium">{similar.majorityCount} of {similar.total}</span> were classified{' '}
                    <span className="font-medium">{clsLabel(similar.majorityClass)}</span>
                    <span className="text-[#092E3F]/45"> ({similarPct}%)</span>
                  </p>
                  <div className="flex gap-[2px] h-1.5 rounded-full overflow-hidden bg-gray-50 mt-3">
                    {(['TruePositive', 'FalsePositive', 'BenignPositive', 'Undetermined'] as Classification[]).map(c => {
                      const n = similar.counts[c] || 0;
                      if (n === 0) return null;
                      return <div key={c} className={CLASS_BAR[c]} style={{ width: `${(n / similar.total) * 100}%` }} title={`${clsLabel(c)}: ${n}`} />;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {(['TruePositive', 'FalsePositive', 'BenignPositive', 'Undetermined'] as Classification[]).map(c => {
                      const n = similar.counts[c] || 0;
                      if (n === 0) return null;
                      return (
                        <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/60">
                          <span className={`w-1.5 h-1.5 rounded-full ${CLASS_BAR[c]}`} />
                          {clsLabel(c)} {n}
                        </span>
                      );
                    })}
                  </div>
                  {classification !== similar.majorityClass && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--stroke)] text-xs text-[#092E3F]/70">
                      <Sparkles className="w-3.5 h-3.5 text-[#2A96A8] shrink-0" />
                      <span className="truncate">Suggests {clsLabel(similar.majorityClass)}</span>
                    </div>
                  )}
                </div>

                {/* The incidents themselves. Column headers exist so the numbers in
                    each row are self-explanatory. */}
                <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-[var(--stroke)]">
                    <span className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Incident</span>
                      <button
                        onClick={() => setOpenShares(allExpanded ? new Set() : new Set(similar.items.map(i => i.id)))}
                        className="text-[10px] font-medium text-[#2A96A8] hover:underline whitespace-nowrap"
                      >
                        {allExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    </span>
                    <span className="w-[70px] flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                      Entities
                      <InfoTip>
                        The entities always come from <span className="font-semibold">this incident (#{incident.incident})</span>, never
                        from the past one. The count is how many of them also appear on the past incident in that row.
                        <span className="block mt-1.5">
                          Expand a row to see which are <span className="font-semibold">in common</span>, plus any entity
                          the past incident involves that #{incident.incident} does not.
                        </span>

                      </InfoTip>
                    </span>
                    <span className="w-[104px] flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                      Intel
                      <InfoTip>
                        Each incident&rsquo;s overall threat-intel score out of 100. The bar is that score; the
                        <span className="font-semibold"> vertical line</span> marks this incident&rsquo;s {incidentTi ?? '—'}/100, so the gap between them is the difference.
                        <span className="block mt-1.5">Colour follows risk, matching Threat Intelligence Scores above. Some incidents have no intel at all.</span>
                      </InfoTip>
                    </span>
                    <span className="w-[46px] shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                      Match
                      <InfoTip>
                        One overall similarity score out of 100. It averages the entity overlap with how close the two
                        threat-intel scores are — the <span className="font-semibold">Entities</span> and <span className="font-semibold">Intel</span> columns are the two halves of it.
                        <span className="block mt-1.5">When an incident has no intel, the score is the entity overlap alone.</span>
                      </InfoTip>
                    </span>
                    <span className="w-[90px] text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Closed as</span>
                    <span className="w-4 shrink-0" />
                  </div>
                  <div className="divide-y divide-gray-100">
                    {similar.items.map(it => {
                      const shared = facts.slice(0, facts.length - it.drop);
                      const extras = buildExtraFacts(it.ref, it.extras);
                      const expanded = openShares.has(it.id);
                      const sim = similarityScore(shared.length, facts.length, it.tiScore, incidentTi);
                      return (
                        <div key={it.id}>
                          <button
                            onClick={() => toggleShares(it.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f8fdfe] transition-colors"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-[#092E3F]">#{it.ref}</span>
                              <span className="block text-xs text-[#092E3F]/45 truncate">
                                {it.severity} · {it.ageLabel}
                              </span>
                            </span>
                            <span className="w-[70px] shrink-0 text-xs text-[#092E3F]/70">
                              {shared.length} of {facts.length}
                            </span>
                            <span className="w-[104px] shrink-0 flex items-center gap-2">
                              {it.tiScore == null ? (
                                <span className="text-xs text-[#092E3F]/35">No intel</span>
                              ) : (() => {
                                const c = getScoreColor(it.tiScore);
                                const delta = incidentTi == null ? null : it.tiScore - incidentTi;
                                return (
                                  <>
                                    <span className="text-xs tabular-nums text-[#092E3F]/70 w-[18px] shrink-0">{it.tiScore}</span>
                                    {/* Meter: fill carries risk, track is the lighter step of the
                                        same ramp, and the tick is this incident's score so the gap
                                        between them reads as the difference. */}
                                    <span
                                      className="relative flex-1 h-1.5"
                                      title={
                                        delta == null
                                          ? `Threat intel ${it.tiScore}/100`
                                          : `Threat intel ${it.tiScore}/100 — ${delta === 0 ? 'same as' : `${Math.abs(delta)} ${delta > 0 ? 'higher' : 'lower'} than`} this incident (${incidentTi}/100)`
                                      }
                                    >
                                      <span className={`absolute inset-0 rounded-full ${c.track}`} />
                                      <span className={`absolute left-0 top-0 bottom-0 rounded-full ${c.bar}`} style={{ width: `${it.tiScore}%` }} />
                                      {incidentTi != null && (
                                        <span
                                          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-[#092E3F] rounded-full shadow-[0_0_0_1.5px_white]"
                                          style={{ left: `calc(${incidentTi}% - 1px)` }}
                                        />
                                      )}
                                    </span>
                                  </>
                                );
                              })()}
                            </span>
                            <span
                              className="w-[46px] shrink-0 flex items-center"
                              title={
                                sim.intelPct == null
                                  ? `Similarity ${sim.overall}% — entities ${shared.length}/${facts.length} (${sim.entityPct}%), no threat intel to compare`
                                  : `Similarity ${sim.overall}% — entities ${shared.length}/${facts.length} (${sim.entityPct}%), intel within ${Math.abs((it.tiScore ?? 0) - (incidentTi ?? 0))} points (${sim.intelPct}%)`
                              }
                            >
                              <MatchRing pct={sim.overall} />
                            </span>
                            <span className="w-[90px] shrink-0 inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CLASS_BAR[it.classification]}`} />
                              <span className="truncate">{clsLabel(it.classification)}</span>
                            </span>
                            {expanded
                              ? <ChevronUp className="w-4 h-4 text-[#092E3F]/35 shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-[#092E3F]/35 shrink-0" />}
                          </button>

                          {/* The overlap, fact by fact — this is what makes the count
                              above mean something. */}
                          {expanded && (
                            <div className="px-3 pb-3 pt-1 bg-[#fbfcfc] space-y-2">
                              <div>
                                <p className="text-[10px] font-medium text-[#2f7d52] uppercase tracking-wide mb-1.5">
                                  In common ({shared.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {shared.map((f, fi) => (
                                    <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#e5f2f4] text-[#092E3F] rounded-[8px] text-xs">
                                      <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                                      <span className={f.mono ? 'font-mono text-[11px]' : ''}>{f.value}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {extras.length > 0 ? (
                                <div>
                                  <p className="text-[10px] font-medium text-[#092E3F]/40 uppercase tracking-wide mb-1.5">
                                    Only on #{it.ref} ({extras.length})
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {extras.map((f, fi) => (
                                      <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#f1f4f5] text-[#092E3F]/75 rounded-[8px] text-xs">
                                        <span className="text-[#092E3F]/40 text-[10px]">{f.kind}</span>
                                        <span className={f.mono ? 'font-mono text-[11px]' : ''}>{f.value}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-[#092E3F]/45">
                                  #{it.ref} involves no entity beyond this incident&rsquo;s.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Logs Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => toggleSection('logs')}
                className="flex items-center gap-2"
              >
                <FileText className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Logs</h3>
                <span className="px-2 py-0.5 bg-gray-200 text-[#092E3F]/70 text-xs rounded-[8px]">
                  {logs.length}
                </span>
                {expandedSections.logs ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
              </button>
              {expandedSections.logs && (
                <button
                  onClick={() => setIsFullScreenLogs(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#2A96A8] hover:bg-[#2A96A8]/10 rounded-[8px] transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  View All Logs
                </button>
              )}
            </div>
            {expandedSections.logs && (
              <div className="space-y-3">
                <div className="grid grid-cols-[35%_65%] gap-4 h-[600px]">
                  {/* Left: Log List */}
                  <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
                    <div className="sticky top-0 bg-white border-b border-[var(--stroke)] px-3 py-2 flex-shrink-0">
                      <h4 className="text-xs font-medium text-[#092E3F] mb-2">Log Entries ({getFilteredLogs().length})</h4>
                      
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#092E3F]/40" />
                        <input
                          type="text"
                          placeholder="Search all log data (e.g., 4688, EventID, powershell)..."
                          value={logSearchQuery}
                          onChange={(e) => setLogSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8]"
                        />
                      </div>
                      {logSearchQuery && (
                        <p className="text-[10px] text-[#2A96A8] mt-1">
                          Searching through all fields including raw log data
                        </p>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1 p-1.5 space-y-1">
                      {getFilteredLogs().map((log) => (
                      <button
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`w-full p-2 rounded-[8px] text-left transition-colors ${
                          selectedLog?.id === log.id 
                            ? 'bg-[#2A96A8]/10 border border-[#2A96A8]' 
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[10px] text-[#092E3F]/60 font-mono">{log.timestamp}</span>
                        </div>
                        <p className="text-[10px] text-[#2A96A8] font-medium mb-0.5">{log.source}</p>
                        <p className="text-xs text-[#092E3F] line-clamp-1">{log.event}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Raw Log Details */}
                <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
                  <div className="sticky top-0 bg-white border-b border-[var(--stroke)] p-3 flex items-center justify-between flex-shrink-0">
                    <h4 className="text-sm font-medium text-[#092E3F]">Raw Log Data</h4>
                    {selectedLog && (
                      <button
                        onClick={() => handleCopyRawLog(selectedLog)}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-[#2A96A8] hover:bg-[#2A96A8]/10 rounded-[8px] transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {selectedLog ? (
                      <div className="p-4">
                        {/* Basic Info */}
                        <div className="mb-4 pb-4 border-b border-[var(--stroke)]">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-[#2A96A8] font-medium">{selectedLog.source}</span>
                          </div>
                          <p className="text-sm text-[#092E3F] mb-2">{selectedLog.event}</p>
                          <p className="text-xs text-[#092E3F]/60 font-mono">{selectedLog.timestamp}</p>
                        </div>

                        {/* Raw JSON Data */}
                        <div className="bg-[#092E3F] rounded-[8px] p-4 overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                            {JSON.stringify(selectedLog.rawData || {
                              id: selectedLog.id,
                              timestamp: selectedLog.timestamp,
                              source: selectedLog.source,
                              event: selectedLog.event,
                              ...(selectedLog.ip && { ip: selectedLog.ip }),
                              ...(selectedLog.user && { user: selectedLog.user }),
                              ...(selectedLog.severity && { severity: selectedLog.severity })
                            }, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[#092E3F]/60 text-sm">
                        Select a log entry to view details
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Tags Section */}
          <div>
            <button
              onClick={() => toggleSection('tags')}
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#092E3F]" />
                <h3 className="text-lg text-[#092E3F]">Tags</h3>
                <span className="px-2 py-0.5 bg-gray-200 text-[#092E3F]/70 text-xs rounded-[8px]">
                  {localTags.length}
                </span>
              </div>
              {expandedSections.tags ? <ChevronUp className="w-5 h-5 text-[#092E3F]/60" /> : <ChevronDown className="w-5 h-5 text-[#092E3F]/60" />}
            </button>
            {expandedSections.tags && (
              <div className="space-y-4">
                {/* Add Tag */}
                <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
                  <div className="flex items-center gap-2">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add a tag..."
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors"
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!newTag.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Add Tag
                    </button>
                  </div>
                </div>

                {/* Existing Tags */}
                <div className="flex flex-wrap gap-2">
                  {localTags.map(tag => (
                    <div key={tag} className="flex items-center gap-2 px-3 py-1 bg-gray-200 text-[#092E3F]/70 text-xs rounded-[8px]">
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-1 hover:bg-gray-300 rounded-full"
                      >
                        <X className="w-3 h-3 text-[#092E3F]/50" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Save Tags */}
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTags}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm"
                  >
                    Save Tags
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {activeModal === 'assign' && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50" 
              onClick={() => setActiveModal(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] shadow-2xl z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-lg text-[#092E3F] mb-4">Assign Incident</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#092E3F]/70 mb-2">Select Analyst</label>
                    <select
                      value={assignToAnalyst}
                      onChange={(e) => setAssignToAnalyst(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors"
                    >
                      <option value="">Choose an analyst...</option>
                      <option value="Sarah Mitchell">Sarah Mitchell (Senior Analyst)</option>
                      <option value="James Rodriguez">James Rodriguez (SOC Analyst)</option>
                      <option value="Emily Chen">Emily Chen (Threat Hunter)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!assignToAnalyst}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeModal === 'status' && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50" 
              onClick={() => setActiveModal(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] shadow-2xl z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-lg text-[#092E3F] mb-4">Change Status & Severity</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#092E3F]/70 mb-2">Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors"
                    >
                      <option value="New">New</option>
                      <option value="Active">Active</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#092E3F]/70 mb-2">Severity</label>
                    <select
                      value={newSeverity}
                      onChange={(e) => setNewSeverity(e.target.value as SeverityLevel)}
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeStatus}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeModal === 'notify' && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50" 
              onClick={() => setActiveModal(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] shadow-2xl z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-lg text-[#092E3F] mb-4">Notify Customer</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#092E3F]/70 mb-2">Message</label>
                    <textarea
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      placeholder="Enter notification message..."
                      rows={4}
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors resize-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNotify}
                    disabled={!notificationMessage.trim()}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Notification
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeModal === 'ticket' && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50" 
              onClick={() => setActiveModal(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] shadow-2xl z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-lg text-[#092E3F] mb-4">Create Support Ticket</h3>
                <div className="bg-gray-50 rounded-[8px] p-4 mb-4">
                  <p className="text-sm text-[#092E3F]/70 mb-2">A support ticket will be created in Autotask with the following details:</p>
                  <ul className="text-sm text-[#092E3F]/60 space-y-1 list-disc list-inside">
                    <li>Incident: {incident.incident}</li>
                    <li>Client: {incident.client.name}</li>
                    <li>Severity: {incident.severity}</li>
                  </ul>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTicket}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm"
                  >
                    Create Ticket
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeModal === 'playbook' && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-50" 
              onClick={() => setActiveModal(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] shadow-2xl z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <h3 className="text-lg text-[#092E3F] mb-4">Run Playbook</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#092E3F]/70 mb-2">Select Playbook</label>
                    <select
                      value={selectedPlaybook}
                      onChange={(e) => setSelectedPlaybook(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8] transition-colors"
                    >
                      <option value="">Choose a playbook...</option>
                      <option value="Malware Response">Malware Response</option>
                      <option value="Phishing Investigation">Phishing Investigation</option>
                      <option value="Data Exfiltration">Data Exfiltration</option>
                      <option value="Endpoint Isolation">Endpoint Isolation</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-sm text-[#092E3F]/70 hover:text-[#092E3F] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunPlaybook}
                    disabled={!selectedPlaybook}
                    className="px-6 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Run Playbook
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ITSM Ticket Sidebar */}
      {showITSMSidebar && (
        <ITSMTicketSidebar
          context={{
            sourceType: 'incident',
            sourceId: incident.incident,
            title: incident.type,
            severity: currentSeverity,
            client: incident.client.name,
            description: `Incident ${incident.incident} — ${incident.type}\nStatus: ${currentStatus}\nCreated: ${incident.created}`,
            entities: [],
          }}
          onClose={() => setShowITSMSidebar(false)}
        />
      )}

      {/* Similar Incidents, full size — same rows, but wide enough to compare
          and sortable on every column that carries a judgement. The current
          incident is pinned at the top so each column has its reference. */}
      {similarFull && (() => {
        const facts = buildMatchFacts(entities);
        const incidentTi: number | null = threatIntelScores.overall;
        const rows = similar.items.map(it => {
          const shared = facts.slice(0, facts.length - it.drop);
          const extras = buildExtraFacts(it.ref, it.extras);
          const sim = similarityScore(shared.length, facts.length, it.tiScore, incidentTi);
          return { it, shared, extras, sim };
        });
        const dir = sortDir === 'asc' ? 1 : -1;
        const sorted = [...rows].sort((a, b) => {
          switch (sortKey) {
            case 'ref': return (Number(a.it.ref) - Number(b.it.ref)) * dir;
            case 'age': return (ageRank(a.it.ageLabel) - ageRank(b.it.ageLabel)) * dir;
            case 'severity': return (SEV_ORDER[a.it.severity] - SEV_ORDER[b.it.severity]) * dir;
            case 'entities': return (a.shared.length - b.shared.length) * dir;
            // No intel sorts last either way — it is absent, not low.
            case 'intel': {
              if (a.it.tiScore == null && b.it.tiScore == null) return 0;
              if (a.it.tiScore == null) return 1;
              if (b.it.tiScore == null) return -1;
              return (a.it.tiScore - b.it.tiScore) * dir;
            }
            case 'closed': return clsLabel(a.it.classification).localeCompare(clsLabel(b.it.classification)) * dir;
            default: return (a.sim.overall - b.sim.overall) * dir;
          }
        });
        const sortBy = (k: SimilarSortKey) => {
          if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
          else { setSortKey(k); setSortDir(k === 'ref' || k === 'closed' ? 'asc' : 'desc'); }
        };
        const Th = ({ k, children, className = '' }: { k: SimilarSortKey; children: React.ReactNode; className?: string }) => (
          <button
            onClick={() => sortBy(k)}
            className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide transition-colors ${
              sortKey === k ? 'text-[#092E3F]' : 'text-[#092E3F]/45 hover:text-[#092E3F]/70'
            } ${className}`}
          >
            {children}
            {sortKey === k
              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
              : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />}
          </button>
        );
        const COLS = 'grid-cols-[92px_84px_92px_120px_150px_78px_130px_1fr]';
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
            <div className="absolute inset-0" onClick={() => setSimilarFull(false)} />
            <div className="relative w-full max-w-[1480px] h-full max-h-[92vh] bg-white rounded-[8px] shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-4 shrink-0 flex items-center gap-3">
                <Layers className="w-5 h-5 text-[#2A96A8] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-white">Similar Incidents</p>
                  <p className="text-xs text-white/55 mt-0.5">
                    {similar.total} past incidents at {incident.client.name} · {incident.type}
                  </p>
                </div>
                <button
                  onClick={() => setOpenShares(sorted.every(r => openShares.has(r.it.id)) ? new Set() : new Set(sorted.map(r => r.it.id)))}
                  className="px-3 py-1.5 border border-[var(--stroke)]/20 rounded-[8px] text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
                >
                  {sorted.every(r => openShares.has(r.it.id)) ? 'Collapse all' : 'Expand all'}
                </button>
                <button
                  onClick={() => setSimilarFull(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[8px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className={`group grid ${COLS} gap-3 items-center px-6 py-2.5 bg-[#f6f6f6] border-b border-[var(--stroke)] shrink-0`}>
                <Th k="ref">Incident</Th>
                <Th k="age">Age</Th>
                <Th k="severity">Severity</Th>
                <Th k="entities">Entities</Th>
                <Th k="intel">Threat intel</Th>
                <Th k="match">Match</Th>
                <Th k="closed">Closed as</Th>
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#092E3F]/45">Entities in common</span>
              </div>

              {/* The incident being compared against, so every column has a
                  yardstick rather than asking the reader to hold it in mind. */}
              <div className={`grid ${COLS} gap-3 items-center px-6 py-3 bg-[#e5f2f4] border-b border-[#2A96A8]/25 shrink-0`}>
                <span className="text-sm font-semibold text-[#092E3F]">#{incident.incident}</span>
                <span className="text-xs text-[#092E3F]/60">now</span>
                <span className="text-xs text-[#092E3F]/70">{currentSeverity}</span>
                <span className="text-xs font-medium text-[#092E3F] tabular-nums">{facts.length} entities</span>
                <span className="text-xs text-[#092E3F]/70 tabular-nums">{incidentTi == null ? 'No intel' : `${incidentTi}/100`}</span>
                <span className="text-xs font-medium text-[#092E3F]">This one</span>
                <span className="text-xs text-[#092E3F]/70">{clsLabel(classification)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {facts.map((f, fi) => (
                    <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-white text-[#092E3F] rounded-[8px] text-xs">
                      <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                      <span className={f.mono ? 'font-mono text-[11px]' : ''}>{f.value}</span>
                    </span>
                  ))}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {sorted.map(({ it, shared, extras, sim }) => {
                  const expanded = openShares.has(it.id);
                  const c = it.tiScore == null ? null : getScoreColor(it.tiScore);
                  return (
                    <div key={it.id}>
                      <div
                        onClick={() => toggleShares(it.id)}
                        className={`grid ${COLS} gap-3 items-center px-6 py-3 cursor-pointer hover:bg-[#fafbfb] transition-colors`}
                      >
                        <span className="text-sm font-medium text-[#092E3F]">#{it.ref}</span>
                        <span className="text-xs text-[#092E3F]/60">{it.ageLabel}</span>
                        <span className="text-xs text-[#092E3F]/70">{it.severity}</span>
                        <span className="text-xs text-[#092E3F] tabular-nums">
                          {shared.length} of {facts.length}
                          {extras.length > 0 && (
                            <span className="block text-[11px] text-[#6b828c]">+{extras.length} of its own</span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          {it.tiScore == null || c == null ? (
                            <span className="text-xs text-[#092E3F]/35">No intel</span>
                          ) : (
                            <>
                              <span className="text-xs tabular-nums text-[#092E3F]/70 w-[18px] shrink-0">{it.tiScore}</span>
                              <span className="relative flex-1 h-1.5" title={`Threat intel ${it.tiScore}/100 against this incident's ${incidentTi}/100`}>
                                <span className={`absolute inset-0 rounded-full ${c.track}`} />
                                <span className={`absolute left-0 top-0 bottom-0 rounded-full ${c.bar}`} style={{ width: `${it.tiScore}%` }} />
                                {incidentTi != null && (
                                  <span className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-[#092E3F] rounded-full shadow-[0_0_0_1.5px_white]"
                                    style={{ left: `calc(${incidentTi}% - 1px)` }} />
                                )}
                              </span>
                            </>
                          )}
                        </span>
                        <span><MatchRing pct={sim.overall} /></span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CLASS_BAR[it.classification]}`} />
                          <span className="truncate">{clsLabel(it.classification)}</span>
                        </span>
                        <span className="flex flex-wrap gap-1.5 items-center">
                          {shared.map((f, fi) => (
                            <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#e5f2f4] text-[#092E3F] rounded-[8px] text-xs">
                              <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                              <span className={f.mono ? 'font-mono text-[11px]' : ''}>{f.value}</span>
                            </span>
                          ))}
                          {extras.length > 0 && !expanded && (
                            <span className="text-[11px] text-[#6b828c]">+{extras.length} only on #{it.ref}</span>
                          )}
                        </span>
                      </div>

                      {expanded && extras.length > 0 && (
                        <div className={`grid ${COLS} gap-3 px-6 pb-3 bg-[#fbfcfc]`}>
                          <div className="col-start-8">
                            <p className="text-[10px] font-medium text-[#092E3F]/40 uppercase tracking-wide mb-1.5">
                              Only on #{it.ref} ({extras.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {extras.map((f, fi) => (
                                <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#f1f4f5] text-[#092E3F]/75 rounded-[8px] text-xs">
                                  <span className="text-[#092E3F]/40 text-[10px]">{f.kind}</span>
                                  <span className={f.mono ? 'font-mono text-[11px]' : ''}>{f.value}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--stroke)] px-6 py-3 flex items-center gap-3 shrink-0 bg-[#fafbfb]">
                <p className="text-xs text-[#6b828c]">
                  Sorted by <span className="font-medium text-[#092E3F]">{sortKey === 'ref' ? 'incident' : sortKey === 'closed' ? 'classification' : sortKey}</span>
                  {' '}{sortDir === 'asc' ? 'ascending' : 'descending'} · click any column to change it
                </p>
                <div className="flex-1" />
                <button
                  onClick={() => setSimilarFull(false)}
                  className="px-3.5 py-2 border border-[var(--stroke)] rounded-[8px] text-xs font-medium text-[#092E3F]/70 hover:bg-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
