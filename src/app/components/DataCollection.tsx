import { useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Database, Search, Filter, Funnel, Terminal, Play, ArrowLeft, Check, X,
  ChevronDown, ChevronRight, Sparkles, AlertTriangle, LayoutGrid, Table2,
  Calendar, MonitorCheck, Shield, Cloud, KeyRound, Activity, Pause, Mail, FileText,
} from 'lucide-react';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only: all figures are mocked. Mirrors what Seculyze's real Data
// Collection Rules feature reports per log source (Microsoft Sentinel tables):
// what each table costs, what could be filtered out of it, and what already is.

type SourceIcon = 'monitor-check' | 'shield' | 'terminal' | 'cloud' | 'key-round' | 'activity' | 'mail' | 'file-text';

interface SampleEvent { time: string; line: string }

interface Opportunity {
  id: string;
  title: string;
  kql: string;
  save: number;       // $/month
  pct: string;        // share of this table's volume
  rationale: string;
  events: string;     // events excluded per month
  samples: SampleEvent[];
}

interface TransformationFilter {
  id: string;
  title: string;
  kql: string;
  save: number;
  since: string;
  dropped: string;
  // A filter can be configured but switched off — it then drops nothing and
  // saves nothing until it is enabled again.
  active: boolean;
}

interface LogSource {
  id: string;
  name: string;
  icon: SourceIcon;
  spendN: number;     // $ over 30 days
  eventsN: number;    // millions
  volumeN: number;    // TB
  spark: number[];
  opps: Opportunity[];
  filters: TransformationFilter[];
}

const PRICE = 2.76;

const SOURCES: LogSource[] = [
  {
    id: 'sec', name: 'SecurityEvent', icon: 'monitor-check',
    spendN: 18640, eventsN: 84.2, volumeN: 6.75, spark: [52, 58, 55, 61, 64, 60, 68, 72, 69, 74, 71, 78, 82, 79],
    opps: [
      {
        id: 'sec1', title: 'Exclude EventID 4688 from workstation endpoints',
        kql: 'SecurityEvent\n| where not(EventID == 4688 and Computer startswith "WKS-")',
        save: 4120, pct: '22%',
        rationale: 'Process-creation events from workstations are already covered by Defender DeviceProcessEvents. No analytics rule in your workspace references this combination.',
        events: '18.5M',
        samples: [
          { time: '14:02:11', line: '4688 · WKS-4471 · New process: C:\\Windows\\System32\\taskhostw.exe' },
          { time: '14:02:11', line: '4688 · WKS-1180 · New process: C:\\Program Files\\Teams\\Update.exe' },
          { time: '14:02:12', line: '4688 · WKS-0932 · New process: C:\\Windows\\System32\\conhost.exe' },
        ],
      },
      {
        id: 'sec2', title: 'Drop 5156 Filtering Platform connection events',
        kql: 'SecurityEvent\n| where EventID != 5156',
        save: 3480, pct: '18%',
        rationale: '5156 is the single noisiest event in this table and is not referenced by any enabled detection.',
        events: '15.1M',
        samples: [
          { time: '14:03:44', line: '5156 · SRV-DC01 · Permitted connection 10.4.1.22:445' },
          { time: '14:03:44', line: '5156 · SRV-FS02 · Permitted connection 10.4.9.71:139' },
          { time: '14:03:45', line: '5156 · WKS-2210 · Permitted connection 52.96.44.1:443' },
        ],
      },
      {
        id: 'sec3', title: 'Exclude 4634 logoff events from service accounts',
        kql: 'SecurityEvent\n| where not(EventID == 4634 and Account endswith "$")',
        save: 960, pct: '5%',
        rationale: 'Machine-account logoffs are high volume. Interactive logoffs are preserved.',
        events: '4.2M',
        samples: [
          { time: '14:04:02', line: '4634 · SRV-DC01 · Account: NORDWIND\\SRV-FS02$' },
          { time: '14:04:03', line: '4634 · SRV-DC02 · Account: NORDWIND\\WKS-0044$' },
          { time: '14:04:03', line: '4634 · SRV-DC01 · Account: NORDWIND\\SQL01$' },
        ],
      },
    ],
    filters: [
      { id: 'f1', title: 'Exclude 4662 directory-service access', kql: 'SecurityEvent | where EventID != 4662', save: 2140, since: 'Applied 12 Mar', dropped: '9.8M', active: true },
      { id: 'f2', title: 'Drop verbose audit noise from print servers', kql: 'SecurityEvent | where Computer !startswith "PRT-"', save: 680, since: 'Applied 3 Apr', dropped: '2.1M', active: false },
      { id: 'f3', title: 'Exclude 4658 handle-closed events', kql: 'SecurityEvent | where EventID != 4658', save: 410, since: 'Applied 21 Apr', dropped: '1.6M', active: true },
    ],
  },
  {
    id: 'csl', name: 'CommonSecurityLog', icon: 'shield',
    spendN: 11205, eventsN: 61.4, volumeN: 4.06, spark: [44, 47, 45, 49, 52, 50, 53, 55, 58, 54, 57, 60, 58, 62],
    opps: [
      {
        id: 'csl1', title: 'Drop allowed traffic to internal DNS resolvers',
        kql: 'CommonSecurityLog\n| where not(DeviceAction == "allow" and DestinationIP in ("10.4.0.10","10.4.0.11"))',
        save: 2760, pct: '25%',
        rationale: 'Recursive DNS traffic to two internal resolvers accounts for a quarter of firewall volume and is duplicated in DNS logs.',
        events: '15.3M',
        samples: [
          { time: '14:05:01', line: 'allow · 10.4.7.31 → 10.4.0.10:53 · 214 bytes' },
          { time: '14:05:01', line: 'allow · 10.4.7.88 → 10.4.0.11:53 · 198 bytes' },
          { time: '14:05:02', line: 'allow · 10.4.2.14 → 10.4.0.10:53 · 231 bytes' },
        ],
      },
      {
        id: 'csl2', title: 'Exclude traffic logs under 1 KB',
        kql: 'CommonSecurityLog\n| where not(Activity == "TRAFFIC" and toint(SentBytes) < 1024)',
        save: 1410, pct: '12%',
        rationale: 'Short-lived sessions with no payload rarely carry investigative value.',
        events: '7.4M',
        samples: [
          { time: '14:06:20', line: 'TRAFFIC · 10.4.5.9 → 10.4.5.1 · 604 bytes' },
          { time: '14:06:21', line: 'TRAFFIC · 10.4.5.44 → 10.4.5.1 · 512 bytes' },
          { time: '14:06:21', line: 'TRAFFIC · 10.4.3.2 → 10.4.9.7 · 880 bytes' },
        ],
      },
    ],
    filters: [
      { id: 'f4', title: 'Exclude health-check probes from load balancers', kql: 'CommonSecurityLog | where SourceIP !in ("10.4.0.240","10.4.0.241")', save: 520, since: 'Applied 28 Feb', dropped: '3.4M', active: true },
    ],
  },
  {
    id: 'sys', name: 'Syslog', icon: 'terminal',
    spendN: 6930, eventsN: 39.8, volumeN: 2.51, spark: [30, 32, 31, 34, 33, 36, 35, 38, 37, 40, 39, 41, 43, 42],
    opps: [
      {
        id: 'sys1', title: 'Exclude facility cron at severity info',
        kql: 'Syslog\n| where not(Facility == "cron" and SeverityLevel == "info")',
        save: 1880, pct: '27%',
        rationale: 'Scheduled-job chatter with no detection coverage.',
        events: '10.7M',
        samples: [
          { time: '14:07:00', line: 'cron/info · app-web-04 · CRON[21884]: session opened for user root' },
          { time: '14:07:00', line: 'cron/info · app-web-07 · CRON[21885]: session closed for user root' },
          { time: '14:07:01', line: 'cron/info · db-prd-02 · CRON[9912]: session opened for user postgres' },
        ],
      },
      {
        id: 'sys2', title: 'Drop sshd accepted-publickey from bastion',
        kql: 'Syslog\n| where not(ProcessName == "sshd" and SyslogMessage has "Accepted publickey" and HostName == "bastion-01")',
        save: 640, pct: '9%',
        rationale: 'Bastion logins are also recorded by the PAM audit pipeline, but removing them reduces lateral-movement visibility.',
        events: '3.6M',
        samples: [
          { time: '14:08:12', line: 'sshd · bastion-01 · Accepted publickey for mkj from 10.9.1.4' },
          { time: '14:08:19', line: 'sshd · bastion-01 · Accepted publickey for ops from 10.9.1.9' },
          { time: '14:08:31', line: 'sshd · bastion-01 · Accepted publickey for mkj from 10.9.1.4' },
        ],
      },
    ],
    filters: [],
  },
  {
    id: 'azd', name: 'AzureDiagnostics', icon: 'cloud',
    spendN: 5420, eventsN: 22.1, volumeN: 1.96, spark: [26, 28, 27, 29, 31, 30, 32, 31, 33, 35, 34, 36, 35, 37],
    opps: [
      {
        id: 'azd1', title: 'Exclude Key Vault SecretGet by managed identities',
        kql: 'AzureDiagnostics\n| where not(OperationName == "SecretGet" and identity_claim_appid_g != "")',
        save: 1240, pct: '23%',
        rationale: 'Application secret reads occur every few seconds and are covered by Key Vault access policy alerts.',
        events: '5.1M',
        samples: [
          { time: '14:09:04', line: 'SecretGet · kv-prd-01 · appid 7f2c… · 200' },
          { time: '14:09:04', line: 'SecretGet · kv-prd-01 · appid 7f2c… · 200' },
          { time: '14:09:05', line: 'SecretGet · kv-prd-02 · appid a19b… · 200' },
        ],
      },
    ],
    filters: [
      { id: 'f5', title: 'Exclude AppGateway access logs with 2xx status', kql: 'AzureDiagnostics | where not(Category == "ApplicationGatewayAccessLog" and httpStatus_d < 300)', save: 790, since: 'Applied 8 Apr', dropped: '4.4M', active: true },
      { id: 'f6', title: 'Drop Load Balancer probe health events', kql: 'AzureDiagnostics | where Category != "LoadBalancerProbeHealthStatus"', save: 230, since: 'Applied 8 Apr', dropped: '1.2M', active: false },
    ],
  },
  {
    // Nothing left to recommend — the redundancy here has already been filtered.
    id: 'office', name: 'OfficeActivity', icon: 'mail',
    spendN: 4180, eventsN: 31.5, volumeN: 1.51, spark: [24, 25, 24, 26, 25, 27, 26, 26, 27, 26, 28, 27, 27, 28],
    opps: [],
    filters: [
      { id: 'f8', title: 'Exclude SharePoint FileAccessed events', kql: 'OfficeActivity | where Operation != "FileAccessed"', save: 1320, since: 'Applied 6 Feb', dropped: '12.4M', active: true },
      { id: 'f9', title: 'Drop Exchange MailItemsAccessed for shared mailboxes', kql: 'OfficeActivity | where not(Operation == "MailItemsAccessed" and MailboxOwnerUPN startswith "shared-")', save: 460, since: 'Applied 14 Mar', dropped: '3.8M', active: true },
    ],
  },
  {
    id: 'sign', name: 'SigninLogs', icon: 'key-round',
    spendN: 3180, eventsN: 12.7, volumeN: 1.15, spark: [16, 17, 17, 18, 19, 18, 20, 21, 20, 22, 21, 23, 22, 24],
    opps: [
      {
        id: 'sign1', title: 'Exclude successful sign-ins from trusted named locations',
        kql: 'SigninLogs\n| where not(ResultType == 0 and NetworkLocationDetails has "trustedNamedLocation")',
        save: 410, pct: '13%',
        rationale: 'Reduces volume but removes the baseline used by impossible-travel and anomalous-sign-in detections. Review before applying.',
        events: '1.6M',
        samples: [
          { time: '14:10:22', line: 'Success · j.holm@nordwind.dk · HQ Copenhagen · Windows' },
          { time: '14:10:23', line: 'Success · s.petrova@nordwind.dk · HQ Copenhagen · macOS' },
          { time: '14:10:24', line: 'Success · t.ali@nordwind.dk · Aarhus Office · iOS' },
        ],
      },
    ],
    filters: [],
  },
  {
    id: 'perf', name: 'Perf', icon: 'activity',
    spendN: 2760, eventsN: 48.6, volumeN: 1.00, spark: [14, 15, 14, 16, 15, 17, 16, 18, 17, 19, 18, 19, 20, 19],
    opps: [
      {
        id: 'perf1', title: 'Exclude counters sampled more often than 60s',
        kql: 'Perf\n| where not(CounterName in ("% Processor Time","Available MBytes") and SampleInterval < 60s)',
        save: 980, pct: '36%',
        rationale: 'Sub-minute sampling on two counters produces a third of this table with no detection value.',
        events: '17.4M',
        samples: [
          { time: '14:11:00', line: '% Processor Time · app-web-04 · 12.4' },
          { time: '14:11:15', line: '% Processor Time · app-web-04 · 11.9' },
          { time: '14:11:30', line: 'Available MBytes · app-web-04 · 8112' },
        ],
      },
    ],
    filters: [
      { id: 'f7', title: 'Exclude disk counters from ephemeral agents', kql: 'Perf | where ObjectName != "LogicalDisk"', save: 310, since: 'Applied 19 Mar', dropped: '6.9M', active: false },
    ],
  },
  {
    // Small and already lean — control-plane events are low volume and every one
    // of them is worth keeping.
    id: 'azact', name: 'AzureActivity', icon: 'file-text',
    spendN: 640, eventsN: 2.4, volumeN: 0.23, spark: [4, 4, 5, 4, 5, 5, 4, 5, 6, 5, 5, 6, 5, 6],
    opps: [],
    filters: [],
  },
];

// Row-level cost breakdown the query view returns. Static, like the rest of the
// prototype — running the query does not actually change it.
const QROWS = [
  { id: '5156', activity: 'Filtering Platform connection', computer: 'SRV-FS02', count: '9,412,880', gb: '612.4', cost: 1690 },
  { id: '4688', activity: 'A new process has been created', computer: 'WKS-4471', count: '6,204,113', gb: '441.9', cost: 1220 },
  { id: '4662', activity: 'Operation on a directory object', computer: 'SRV-DC01', count: '3,880,204', gb: '298.1', cost: 823 },
  { id: '4634', activity: 'An account was logged off', computer: 'SRV-DC02', count: '2,914,660', gb: '181.6', cost: 501 },
  { id: '4624', activity: 'An account was successfully logged on', computer: 'SRV-DC01', count: '2,180,447', gb: '166.2', cost: 459 },
  { id: '4658', activity: 'The handle to an object was closed', computer: 'SRV-FS01', count: '1,640,912', gb: '104.8', cost: 289 },
  { id: '4776', activity: 'Credential validation', computer: 'SRV-DC02', count: '902,318', gb: '58.4', cost: 161 },
  { id: '4104', activity: 'PowerShell script block logging', computer: 'WKS-1180', count: '411,206', gb: '39.7', cost: 110 },
];

const money = (n: number) => '$' + n.toLocaleString('en-US');

const SOURCE_ICON: Record<SourceIcon, typeof Database> = {
  'monitor-check': MonitorCheck,
  shield: Shield,
  terminal: Terminal,
  cloud: Cloud,
  'key-round': KeyRound,
  activity: Activity,
  mail: Mail,
  'file-text': FileText,
};

// Sparkline geometry: a line plus the same path closed to the baseline.
function sparkPaths(vals: number[], w: number, h: number) {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => [i * (w / (vals.length - 1)), h - ((v - min) / range) * (h - 4) - 2]);
  const line = 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ');
  return { line, fill: `${line} L ${w} ${h} L 0 ${h} Z` };
}

export default function DataCollection() {
  const [sources, setSources] = useState<LogSource[]>(SOURCES);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<'opps' | 'filters'>('opps');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  // oid === null means "every open opportunity on this source".
  const [confirm, setConfirm] = useState<{ sid: string; oid: string | null } | null>(null);
  const [ack, setAck] = useState(false);
  // Which opportunities a bulk apply will actually create. Starts as all of
  // them, so "Apply all" still means all — but a low-confidence one can be
  // dropped without leaving the dialog.
  const [bulkSel, setBulkSel] = useState<string[]>([]);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [kqlText, setKqlText] = useState(
    'SecurityEvent\n| summarize Events = count(), GB = round(sum(_BilledSize)/1024/1024/1024, 1) by EventID, Activity, Computer\n| order by GB desc'
  );

  const needle = q.trim().toLowerCase();
  const list = useMemo(
    () => sources.filter(s => !needle || s.name.toLowerCase().includes(needle)),
    [sources, needle]
  );

  const totals = useMemo(() => {
    const spend = sources.reduce((a, s) => a + s.spendN, 0);
    const volume = sources.reduce((a, s) => a + s.volumeN, 0);
    const events = sources.reduce((a, s) => a + s.eventsN, 0);
    const filterTotal = sources.reduce((a, s) => a + s.filters.length, 0);
    const filterActive = sources.reduce((a, s) => a + s.filters.filter(f => f.active).length, 0);
    const saved = sources.reduce((a, s) => a + s.filters.filter(f => f.active).reduce((b, f) => b + f.save, 0), 0);
    const opps = sources.flatMap(s => s.opps);
    const opp = opps.reduce((a, o) => a + o.save, 0);
    return { spend, volume, events, filterTotal, filterActive, saved, opp, oppCount: opps.length };
  }, [sources]);

  const applyOpp = (sid: string, oid: string) => {
    setSources(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const o = s.opps.find(x => x.id === oid);
      if (!o) return s;
      return {
        ...s,
        spendN: Math.round(s.spendN - o.save),
        opps: s.opps.filter(x => x.id !== oid),
        filters: [...s.filters, {
          id: `n${oid}`, title: o.title, kql: o.kql.replace(/\n/g, ' '),
          save: o.save, since: 'Applied just now', dropped: o.events, active: true,
        }],
      };
    }));
    setConfirm(null);
    setAck(false);
    toast.success('Transformation filter applied');
  };

  const applyMany = (sid: string, ids: string[]) => {
    const src = sources.find(s => s.id === sid);
    if (!src || ids.length === 0) return;
    const chosen = src.opps.filter(o => ids.includes(o.id));
    if (chosen.length === 0) return;
    const total = chosen.reduce((a, o) => a + o.save, 0);
    setSources(prev => prev.map(s => s.id !== sid ? s : {
      ...s,
      spendN: Math.round(s.spendN - total),
      opps: s.opps.filter(o => !ids.includes(o.id)),
      filters: [
        ...s.filters,
        ...chosen.map(o => ({
          id: `n${o.id}`, title: o.title, kql: o.kql.replace(/\n/g, ' '),
          save: o.save, since: 'Applied just now', dropped: o.events, active: true,
        })),
      ],
    }));
    setConfirm(null);
    setAck(false);
    toast.success(
      `${chosen.length} transformation filter${chosen.length !== 1 ? 's' : ''} applied — saving ${money(total)}/mo`
    );
  };

  const toggleFilter = (sid: string, fid: string) => {
    const current = sources.find(s => s.id === sid)?.filters.find(f => f.id === fid);
    if (!current) return;
    const nowOn = !current.active;
    setSources(prev => prev.map(s => s.id !== sid ? s : {
      ...s,
      filters: s.filters.map(f => f.id === fid ? { ...f, active: nowOn } : f),
    }));
    toast.success(nowOn
      ? 'Filter enabled — takes effect within 15 minutes'
      : 'Filter paused — ingestion resumes within 15 minutes');
  };

  const removeFilter = (sid: string, fid: string) => {
    setSources(prev => prev.map(s => s.id !== sid ? s : { ...s, filters: s.filters.filter(f => f.id !== fid) }));
    toast.success('Filter removed — ingestion resumes within 15 minutes');
  };

  const openQuery = (sid: string) => {
    setQueryId(sid);
    setDetailId(null);
    setExcluded([]);
  };

  const detail = sources.find(s => s.id === detailId) ?? null;
  const confirmSrc = confirm ? sources.find(s => s.id === confirm.sid) ?? null : null;
  const confirmOpp = confirmSrc && confirm?.oid ? confirmSrc.opps.find(o => o.id === confirm.oid) ?? null : null;
  const bulkOpps = confirm && confirm.oid === null && confirmSrc ? confirmSrc.opps : [];
  const bulkChosen = bulkOpps.filter(o => bulkSel.includes(o.id));
  const bulkSave = bulkChosen.reduce((a, o) => a + o.save, 0);
  const querySrc = sources.find(s => s.id === queryId) ?? null;

  const draftSave = excluded.reduce((a, id) => a + (QROWS.find(r => r.id === id)?.cost ?? 0), 0);
  const totalRowCost = QROWS.reduce((a, r) => a + r.cost, 0);
  const draftKql = excluded.length
    ? `${querySrc?.name ?? 'SecurityEvent'}\n| where EventID !in (${excluded.join(', ')})`
    : 'Select rows in the results to build a filter.';

  const createFromDraft = () => {
    if (!excluded.length) {
      toast.error('Select at least one row to exclude');
      return;
    }
    setSources(prev => prev.map(s => s.id !== querySrc?.id ? s : {
      ...s,
      spendN: s.spendN - draftSave,
      filters: [...s.filters, {
        id: `q${s.filters.length + 1}`,
        title: `Custom filter · ${excluded.length} EventID${excluded.length !== 1 ? 's' : ''} excluded`,
        kql: draftKql.replace(/\n/g, ' '),
        save: draftSave, since: 'Applied just now', dropped: '—', active: true,
      }],
    }));
    setExcluded([]);
    setQueryId(null);
    toast.success('Custom transformation filter created');
  };

  // ── Query view: replaces the page body rather than stacking on it, since it
  //    is a working surface, not a detail of the list.
  if (querySrc) {
    return (
      <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-3.5 border-b border-gray-200 shrink-0">
          <button
            onClick={() => setQueryId(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div>
            <p className="text-sm font-semibold text-[#092E3F]">
              Query <span className="font-mono">{querySrc.name}</span>
            </p>
            <p className="text-xs text-[#6b828c]">
              Row-level cost insight · last 30 days · ${PRICE.toFixed(2)} per GB
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => toast.success('Query returned 8 rows in 1.4s')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Run query
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-6 pt-4">
              <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#f6f6f6] border-b border-gray-200">
                  <Terminal className="w-3.5 h-3.5 text-[#6b828c]" />
                  <span className="text-xs font-medium text-[#092E3F]/70">KQL constructor</span>
                  <div className="flex-1" />
                  <span className="text-xs text-[#6b828c]">8 rows · 1.4s · scanned 6.75 TB</span>
                </div>
                <textarea
                  value={kqlText}
                  onChange={e => setKqlText(e.target.value)}
                  spellCheck={false}
                  className="w-full h-[118px] px-4 py-3 font-mono text-xs leading-relaxed text-[#092E3F]/80 resize-y focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs font-medium text-[#6b828c]">Quick actions</span>
                {[
                  { label: 'Top cost by EventID', kql: `${querySrc.name}\n| summarize Events = count(), GB = round(sum(_BilledSize)/1024/1024/1024, 1) by EventID, Activity, Computer\n| order by GB desc` },
                  { label: 'Group by Computer', kql: `${querySrc.name}\n| summarize GB = round(sum(_BilledSize)/1024/1024/1024, 1) by Computer\n| order by GB desc` },
                  { label: 'Last 24h only', kql: `${kqlText}\n| where TimeGenerated > ago(24h)` },
                  { label: 'Exclude selected', kql: excluded.length ? `${querySrc.name}\n| where EventID !in (${excluded.join(', ')})` : kqlText },
                ].map(qa => (
                  <button
                    key={qa.label}
                    onClick={() => setKqlText(qa.kql)}
                    className="px-2.5 py-1 bg-[#f6f6f6] border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f1f4f5] transition-colors"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-sm font-semibold text-[#092E3F]">Results</span>
                <span className="text-xs text-[#6b828c]">
                  cost is the 30-day billed ingestion attributable to each group
                </span>
              </div>
              <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                <div className="grid grid-cols-[76px_minmax(150px,1fr)_118px_88px_66px_82px_80px] gap-2 px-3.5 py-2 bg-[#f6f6f6] border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">
                  <div>EventID</div><div>Activity</div><div>Computer</div>
                  <div className="text-right">Count</div><div className="text-right">GB</div>
                  <div className="text-right">30d cost</div><div />
                </div>
                <div className="divide-y divide-gray-100">
                  {QROWS.map(r => {
                    const on = excluded.includes(r.id);
                    const costCls = r.cost > 800 ? 'text-[#b73520]' : r.cost > 300 ? 'text-[#c07d1e]' : 'text-[#092E3F]';
                    return (
                      <div
                        key={r.id}
                        className={`grid grid-cols-[76px_minmax(150px,1fr)_118px_88px_66px_82px_80px] gap-2 items-center px-3.5 py-2.5 text-xs transition-colors ${on ? 'bg-[#e5f2f4]' : 'hover:bg-[#fafbfb]'}`}
                      >
                        <div className="font-mono font-medium text-[#092E3F]">{r.id}</div>
                        <div className="text-[#092E3F]/80 truncate">{r.activity}</div>
                        <div className="font-mono text-[11px] text-[#092E3F]/60">{r.computer}</div>
                        <div className="text-right tabular-nums text-[#092E3F]/80">{r.count}</div>
                        <div className="text-right tabular-nums text-[#092E3F]/80">{r.gb}</div>
                        <div className={`text-right tabular-nums font-medium ${costCls}`}>{money(r.cost)}</div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => setExcluded(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])}
                            title={on ? 'Keep these rows' : 'Exclude these rows'}
                            className={`px-2 py-1 rounded-[4px] text-[11px] font-medium border transition-colors ${
                              on
                                ? 'bg-[#2A96A8] border-[#2A96A8] text-white'
                                : 'bg-white border-gray-200 text-[#1e7d8f] hover:bg-[#e5f2f4]'
                            }`}
                          >
                            {on ? 'Excluded' : 'Exclude'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <aside className="w-[340px] shrink-0 border-l border-gray-200 bg-[#fafbfb] p-5 overflow-y-auto">
            <p className="text-sm font-semibold text-[#092E3F] mb-1">Filter being built</p>
            <p className="text-xs text-[#6b828c] mb-3.5">
              Rows you exclude are added to the transformation filter below.
            </p>
            <div className="bg-white border border-gray-200 rounded-[4px] p-3 font-mono text-[11px] leading-relaxed text-[#092E3F]/80 whitespace-pre-wrap break-words min-h-[70px]">
              {draftKql}
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="bg-white border border-gray-200 rounded-[4px] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Est. saving</p>
                <p className="text-lg font-semibold text-[#2f7d52] tabular-nums">{money(draftSave)}</p>
                <p className="text-[11px] text-[#6b828c]">per month</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-[4px] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Volume cut</p>
                <p className="text-lg font-semibold text-[#092E3F] tabular-nums">
                  {Math.round((draftSave / totalRowCost) * 100)}%
                </p>
                <p className="text-[11px] text-[#6b828c]">of this table</p>
              </div>
            </div>

            <div className="flex gap-2.5 px-3 py-3 mb-4 bg-[#f7efdf] border-l-2 border-[#c07d1e] rounded-[4px]">
              <AlertTriangle className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-[#8a5f16]">
                Excluded events are dropped before ingestion. They cannot be recovered or queried later.
                Filter only what you are confident is not needed to trigger or investigate an incident.
              </p>
            </div>

            <button
              onClick={createFromDraft}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Create transformation filter
            </button>
            <button
              onClick={() => setExcluded([])}
              className="w-full mt-2 py-2 text-xs font-medium text-[#6b828c] hover:text-[#092E3F] transition-colors"
            >
              Clear selection
            </button>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[#092E3F] text-xl font-semibold">Data Collection</h1>
                <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">Cost</span>
              </div>
              <p className="text-sm text-[#092E3F]/60">
                Identify redundant logs, cut ingestion cost, and keep every security-critical event.
              </p>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="30-day est. spend" value={money(totals.spend)} sub={`across ${sources.length} log sources`} />
          <StatCard label="Data ingested" value={`${totals.volume.toFixed(2)} TB`} sub={`${totals.events.toFixed(1)}M events`} />
          <StatCard
            label="Active filters"
            value={`${totals.filterActive} of ${totals.filterTotal}`}
            sub={totals.filterTotal - totals.filterActive === 0
              ? 'all transformation filters live'
              : `${totals.filterTotal - totals.filterActive} configured but paused`}
          />
          <StatCard label="Already saving" value={`${money(totals.saved)}/mo`} sub="per month, from live filters" accent />
          <div className="bg-[#092E3F] rounded-[6px] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#2A96A8]">Identified savings</p>
            <p className="text-2xl font-semibold text-white tabular-nums mt-1">{money(totals.opp)}/mo</p>
            <p className="text-xs text-white/55 mt-0.5">{totals.oppCount} recommendations open</p>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-[#092E3F]">Log Sources</h2>
          {list.length !== sources.length && (
            <span className="text-xs text-[#6b828c]">{list.length} matching</span>
          )}
          <div className="flex-1" />
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search log sources"
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
            <Calendar className="w-3.5 h-3.5 text-[#6b828c]" />
            Last 30 days
            <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />
          </button>
          <span className="text-xs text-[#6b828c]">Sort</span>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
            Highest spend
            <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />
          </button>
          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px]">
            <ViewBtn active={view === 'cards'} onClick={() => setView('cards')} icon={LayoutGrid}>Cards</ViewBtn>
            <ViewBtn active={view === 'table'} onClick={() => setView('table')} icon={Table2}>Table</ViewBtn>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {list.map(s => {
              const Icon = SOURCE_ICON[s.icon];
              const top = s.opps[0];
              const sp = sparkPaths(s.spark, 96, 34);
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-[6px] overflow-hidden flex flex-col">
                  <div className="flex items-center gap-3 px-5 pt-4 pb-3.5">
                    <div className="w-9 h-9 rounded-[4px] bg-[#e5f2f4] flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-[#1e7d8f]" />
                    </div>
                    <p className="flex-1 min-w-0 font-mono text-sm font-semibold text-[#092E3F] truncate">{s.name}</p>
                    <button
                      onClick={() => { setDetailId(s.id); setTab('opps'); }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                    >
                      Details
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-[repeat(4,1fr)_96px] border-t border-gray-100 bg-[#fafbfb]">
                    <CardStat label="30d spend" value={money(s.spendN)} pl />
                    <CardStat label="Events" value={`${s.eventsN.toFixed(1)}M`} />
                    <CardStat label="Volume" value={`${s.volumeN.toFixed(2)} TB`} />
                    <CardStat label="Price / GB" value={`$${PRICE.toFixed(2)}`} />
                    <div className="flex items-end py-3 pr-5">
                      <svg viewBox="0 0 96 34" width="96" height="34" preserveAspectRatio="none" className="overflow-visible">
                        <path d={sp.fill} fill="#e5f2f4" />
                        <path d={sp.line} fill="none" stroke="#2A96A8" strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {top && (
                    <div className="mx-5 mt-4 border border-[#c8e6ea] bg-[#f4fbfc] rounded-[4px] p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#1e7d8f]" />
                        <span className="text-[10px] font-medium uppercase tracking-wide text-[#1e7d8f]">
                          Top savings opportunity
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#092E3F] mb-2.5">{top.title}</p>
                      <div className="flex items-center gap-3.5 flex-wrap">
                        <span className="text-base font-semibold text-[#2f7d52] tabular-nums">{money(top.save)}/mo</span>
                        <span className="text-xs text-[#092E3F]/60">{top.pct} of table volume · {top.events} events</span>
                        <div className="flex-1" />
                        <button
                          onClick={() => { setDetailId(s.id); setTab('opps'); }}
                          className="text-xs font-medium text-[#1e7d8f] hover:underline"
                        >
                          {s.opps.length > 1 ? `View all ${s.opps.length}` : 'View details'}
                        </button>
                        <button
                          onClick={() => { setConfirm({ sid: s.id, oid: top.id }); setAck(false); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                        >
                          <Filter className="w-3.5 h-3.5" />
                          Apply filter
                        </button>
                      </div>
                    </div>
                  )}

                  {!top && (
                    <div className="mx-5 mt-4 border border-dashed border-gray-200 rounded-[4px] px-3.5 py-3">
                      <p className="text-xs text-[#6b828c]">
                        No savings opportunities open — nothing redundant identified in this table.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 px-5 py-3.5 mt-auto">
                    <Funnel className="w-4 h-4 text-[#6b828c]" />
                    <span className="text-xs text-[#092E3F]/70">
                      {s.filters.length === 0
                        ? 'No transformation filters'
                        : `${s.filters.filter(f => f.active).length} of ${s.filters.length} transformation filter${s.filters.length !== 1 ? 's' : ''} active`}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => openQuery(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#092E3F] rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-[#f6f6f6] transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Create with Query
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-[6px] overflow-hidden">
            <div className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_.7fr_1.9fr_150px] gap-3 px-5 py-2.5 bg-[#f6f6f6] border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">
              <div>Log source</div><div>30d spend</div><div>Events</div><div>Volume</div>
              <div>Filters</div><div>Top saving opportunities</div><div />
            </div>
            <div className="divide-y divide-gray-100">
              {list.map(s => {
                const Icon = SOURCE_ICON[s.icon];
                const top = s.opps[0];
                const open = expandedRow === s.id;
                return (
                  <div key={s.id}>
                    <div
                      onClick={() => setExpandedRow(p => p === s.id ? null : s.id)}
                      className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_.7fr_1.9fr_150px] gap-3 items-center px-5 py-3 cursor-pointer hover:bg-[#fafbfb] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {open
                          ? <ChevronDown className="w-4 h-4 text-[#87999f] shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-[#87999f] shrink-0" />}
                        <Icon className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                        <p className="min-w-0 font-mono text-xs font-medium text-[#092E3F] truncate">{s.name}</p>
                      </div>
                      <div className="text-sm font-semibold text-[#092E3F] tabular-nums">{money(s.spendN)}</div>
                      <div className="text-xs text-[#092E3F]/80 tabular-nums">{s.eventsN.toFixed(1)}M</div>
                      <div className="text-xs text-[#092E3F]/80 tabular-nums">{s.volumeN.toFixed(2)} TB</div>
                      <div className="text-xs text-[#092E3F]/80 tabular-nums">
                        {s.filters.length === 0
                          ? '—'
                          : `${s.filters.filter(f => f.active).length} of ${s.filters.length}`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[#092E3F]/80 truncate">{top ? top.title : '—'}</p>
                        <p className="text-xs font-medium text-[#2f7d52] tabular-nums">{top ? `${money(top.save)}/mo` : '—'}</p>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); openQuery(s.id); }}
                          title="Create with Query"
                          className="px-2 py-1.5 bg-white border border-gray-200 rounded-[4px] text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (!top) { toast.error(`No open recommendations for ${s.name}`); return; }
                            setConfirm({ sid: s.id, oid: top.id });
                            setAck(false);
                          }}
                          className="px-3 py-1.5 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div className="px-5 pl-[62px] py-4 bg-[#fafbfb] border-t border-gray-100">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2.5">
                          Savings opportunities
                        </p>
                        <div className="space-y-2">
                          {s.opps.length === 0 && (
                            <p className="text-xs text-[#6b828c]">No open recommendations on this log source.</p>
                          )}
                          {s.opps.map(o => (
                            <div key={o.id} className="flex items-center gap-3.5 bg-white border border-gray-200 rounded-[4px] px-3.5 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#092E3F]">{o.title}</p>
                                <p className="font-mono text-[11px] text-[#6b828c] mt-0.5 truncate">{o.kql.replace(/\n/g, ' ')}</p>
                              </div>
                              <span className="text-xs text-[#092E3F]/60 shrink-0">{o.pct} of volume</span>
                              <span className="w-[92px] text-right text-sm font-semibold text-[#2f7d52] tabular-nums shrink-0">
                                {money(o.save)}/mo
                              </span>
                              <button
                                onClick={() => { setConfirm({ sid: s.id, oid: o.id }); setAck(false); }}
                                className="shrink-0 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>

                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mt-4 mb-2.5">
                          Active transformation filters
                        </p>
                        <div className="space-y-2">
                          {s.filters.length === 0 && (
                            <p className="text-xs text-[#6b828c]">No transformation filters on this log source yet.</p>
                          )}
                          {s.filters.map(f => (
                            <div key={f.id} className={`flex items-center gap-3.5 bg-white border border-gray-200 rounded-[4px] px-3.5 py-3 ${f.active ? '' : 'opacity-60'}`}>
                              {f.active
                                ? <Check className="w-4 h-4 text-[#2f7d52] shrink-0" />
                                : <Pause className="w-4 h-4 text-[#87999f] shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#092E3F]">{f.title}</p>
                                <p className="font-mono text-[11px] text-[#6b828c] mt-0.5 truncate">{f.kql}</p>
                              </div>
                              <span className="text-xs text-[#6b828c] shrink-0">{f.active ? f.since : 'Paused'}</span>
                              <span className={`text-xs font-medium tabular-nums shrink-0 ${f.active ? 'text-[#2f7d52]' : 'text-[#87999f]'}`}>
                                {money(f.save)}/mo
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {detail && (() => {
        const Icon = SOURCE_ICON[detail.icon];
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDetailId(null)} />
            <div className="relative w-[660px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#2A96A8]" />
                </div>
                <p className="flex-1 min-w-0 font-mono text-base font-semibold text-white truncate">{detail.name}</p>
                <button
                  onClick={() => setDetailId(null)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[4px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-4 bg-[#fafbfb] border-b border-gray-200 shrink-0">
                <CardStat label="30d spend" value={money(detail.spendN)} pl />
                <CardStat label="Events" value={`${detail.eventsN.toFixed(1)}M`} />
                <CardStat label="Volume" value={`${detail.volumeN.toFixed(2)} TB`} />
                <CardStat label="Price / GB" value={`$${PRICE.toFixed(2)}`} />
              </div>

              <div className="flex gap-5 px-6 border-b border-gray-200 shrink-0">
                <DrawerTab active={tab === 'opps'} onClick={() => setTab('opps')}>Savings opportunities</DrawerTab>
                <DrawerTab active={tab === 'filters'} onClick={() => setTab('filters')}>Transformation filters</DrawerTab>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {tab === 'opps' && detail.opps.length > 1 && (
                  <div className="flex items-center gap-3 px-3.5 py-3 bg-[#f4fbfc] border border-[#c8e6ea] rounded-[4px]">
                    <Sparkles className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                    <p className="flex-1 text-xs text-[#092E3F]/80">
                      <span className="font-medium text-[#092E3F]">
                        {money(detail.opps.reduce((a, o) => a + o.save, 0))}/mo
                      </span>{' '}
                      across all {detail.opps.length} recommendations
                    </p>
                    <button
                      onClick={() => {
                        setConfirm({ sid: detail.id, oid: null });
                        setAck(false);
                        setBulkSel(detail.opps.map(o => o.id));
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Apply all {detail.opps.length}
                    </button>
                  </div>
                )}
                {tab === 'opps' && detail.opps.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-[4px] p-7 text-center text-sm text-[#6b828c]">
                    No open recommendations on this log source.
                  </div>
                )}
                {tab === 'opps' && detail.opps.map(o => (
                  <div key={o.id} className="border border-gray-200 rounded-[4px] p-4">
                    <p className="text-sm font-medium text-[#092E3F] mb-2">{o.title}</p>
                    <p className="font-mono text-[11px] text-[#092E3F]/80 bg-[#f6f6f6] border border-gray-200 rounded-[4px] px-3 py-2 mb-3 whitespace-pre-wrap break-words">
                      {o.kql}
                    </p>
                    <p className="text-xs text-[#092E3F]/70 mb-3 leading-relaxed">{o.rationale}</p>
                    <div className="flex items-center gap-5">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Est. monthly saving</p>
                        <p className="text-lg font-semibold text-[#2f7d52] tabular-nums">{money(o.save)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">Volume</p>
                        <p className="text-lg font-semibold text-[#092E3F] tabular-nums">{o.pct}</p>
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={() => { setConfirm({ sid: detail.id, oid: o.id }); setAck(false); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] transition-colors"
                      >
                        <Filter className="w-3.5 h-3.5" />
                        Apply filter
                      </button>
                    </div>
                  </div>
                ))}

                {tab === 'filters' && detail.filters.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-[4px] p-7 text-center text-sm text-[#6b828c]">
                    No transformation filters on this log source yet.
                  </div>
                )}
                {tab === 'filters' && detail.filters.map(f => (
                  <div key={f.id} className="border border-gray-200 rounded-[4px] p-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <button
                        onClick={() => toggleFilter(detail.id, f.id)}
                        title={f.active ? 'Pause this filter' : 'Enable this filter'}
                        className={`shrink-0 w-8 h-[18px] rounded-full relative transition-colors ${f.active ? 'bg-[#2f7d52]' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${f.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <p className={`flex-1 text-sm font-medium ${f.active ? 'text-[#092E3F]' : 'text-[#092E3F]/50'}`}>{f.title}</p>
                      <span className="shrink-0 text-xs text-[#6b828c]">{f.active ? f.since : 'Paused'}</span>
                    </div>
                    <p className="font-mono text-[11px] text-[#092E3F]/80 bg-[#f6f6f6] border border-gray-200 rounded-[4px] px-3 py-2 mb-3 whitespace-pre-wrap break-words">
                      {f.kql}
                    </p>
                    <div className="flex items-center gap-4">
                      <p className="text-xs text-[#092E3F]/70">
                        {f.active
                          ? <>Saving <span className="font-medium text-[#2f7d52]">{money(f.save)}/mo</span> · {f.dropped} events dropped</>
                          : <>Paused — would save <span className="font-medium text-[#092E3F]/60">{money(f.save)}/mo</span> · nothing is being dropped</>}
                      </p>
                      <div className="flex-1" />
                      <button
                        onClick={() => removeFilter(detail.id, f.id)}
                        className="px-3.5 py-2 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#b73520] hover:bg-[#fdf1ef] transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 px-6 py-3.5 flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => openQuery(detail.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#092E3F] rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-[#f6f6f6] transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Create with Query
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setDetailId(null)}
                  className="px-3.5 py-2 border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Apply confirmation */}
      {confirmSrc && (confirmOpp || bulkOpps.length > 0) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
          <div className="absolute inset-0" onClick={() => { setConfirm(null); setAck(false); }} />
          <div className="relative w-[620px] max-h-full bg-white rounded-[6px] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 shrink-0">
              <p className="text-base font-semibold text-[#092E3F]">
                {confirmOpp
                  ? 'Apply transformation filter'
                  : bulkChosen.length === bulkOpps.length
                    ? `Apply all ${bulkOpps.length} transformation filters`
                    : `Apply ${bulkChosen.length} of ${bulkOpps.length} transformation filters`}
              </p>
              <p className="text-xs text-[#6b828c] mt-0.5">
                On <span className="font-mono font-medium text-[#092E3F]/80">{confirmSrc.name}</span>
                {confirmOpp
                  ? ` · ${confirmOpp.title}`
                  : bulkChosen.length === bulkOpps.length
                    ? ' · every open recommendation'
                    : ' · the ones you have selected'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {confirmOpp ? (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">Filter query</p>
                  <p className="font-mono text-xs leading-relaxed text-[#092E3F]/80 bg-[#f6f6f6] border border-gray-200 rounded-[4px] px-3.5 py-3 whitespace-pre-wrap break-words">
                    {confirmOpp.kql}
                  </p>

                  <div className="grid grid-cols-3 gap-3 my-4">
                    <MiniStat label="Monthly saving" value={`${money(confirmOpp.save)}/mo`} accent />
                    <MiniStat label="Events excluded" value={confirmOpp.events} />
                    <MiniStat label="Table volume" value={`${confirmOpp.pct} of table`} />
                  </div>

                  <div className="border border-gray-200 rounded-[4px] overflow-hidden mb-4">
                    <p className="px-3.5 py-2 bg-[#f6f6f6] border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">
                      Sample of events this filter would drop
                    </p>
                    <div className="divide-y divide-gray-100">
                      {confirmOpp.samples.map((sm, i) => (
                        <div key={i} className="flex gap-3.5 px-3.5 py-2 font-mono text-[11px] text-[#092E3F]/70">
                          <span className="w-[70px] shrink-0 text-[#87999f]">{sm.time}</span>
                          <span className="flex-1 truncate">{sm.line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <MiniStat label="Monthly saving" value={`${money(bulkSave)}/mo`} accent />
                    <MiniStat label="Filters" value={`${bulkChosen.length} of ${bulkOpps.length}`} />
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <p className="flex-1 text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">
                      Filters that will be created
                    </p>
                    <button
                      onClick={() => setBulkSel(bulkChosen.length === bulkOpps.length ? [] : bulkOpps.map(o => o.id))}
                      className="text-[10px] font-medium text-[#1e7d8f] hover:underline"
                    >
                      {bulkChosen.length === bulkOpps.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-[4px] overflow-hidden mb-4 divide-y divide-gray-100">
                    {bulkOpps.map(o => {
                      const on = bulkSel.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className={`flex gap-3 px-3.5 py-3 cursor-pointer transition-colors ${on ? 'hover:bg-[#fafbfb]' : 'bg-[#fafbfb]'}`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setBulkSel(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}
                            className="w-4 h-4 mt-0.5 shrink-0 accent-[#2A96A8] cursor-pointer"
                          />
                          <div className={`flex-1 min-w-0 ${on ? '' : 'opacity-45'}`}>
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <p className="flex-1 text-xs font-medium text-[#092E3F]">{o.title}</p>
                              <span className="shrink-0 text-xs font-medium text-[#2f7d52] tabular-nums">
                                {money(o.save)}/mo
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-[#092E3F]/70 whitespace-pre-wrap break-words">{o.kql}</p>
                            <p className="text-[11px] text-[#6b828c] mt-1">{o.pct} of volume · {o.events} events</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex gap-2.5 px-3 py-3 bg-[#f7efdf] border-l-2 border-[#c07d1e] rounded-[4px]">
                <AlertTriangle className="w-4 h-4 text-[#c07d1e] shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-[#8a5f16]">
                  Matching events are dropped before they reach your workspace. They will not appear in hunting
                  queries, analytics rules or investigations, and cannot be recovered retroactively.
                </p>
              </div>

              <label className="flex items-start gap-2.5 mt-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={e => setAck(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#2A96A8] cursor-pointer"
                />
                <span className="text-xs text-[#092E3F]/80 leading-relaxed">
                  I have reviewed {confirmOpp
                    ? 'the query'
                    : `the ${bulkChosen.length} selected quer${bulkChosen.length !== 1 ? 'ies' : 'y'}`} and confirm
                  these events are not needed to trigger or investigate incidents.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-gray-200 bg-[#fafbfb] shrink-0">
              <button
                onClick={() => { setConfirm(null); setAck(false); }}
                className="px-4 py-2 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmOpp ? applyOpp(confirm!.sid, confirm!.oid!) : applyMany(confirm!.sid, bulkSel)}
                disabled={!ack || (!confirmOpp && bulkChosen.length === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                {confirmOpp
                  ? 'Apply filter'
                  : `Apply ${bulkChosen.length} filter${bulkChosen.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[6px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${accent ? 'text-[#2f7d52]' : 'text-[#092E3F]'}`}>{value}</p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}

function CardStat({ label, value, pl }: { label: string; value: string; pl?: boolean }) {
  return (
    <div className={`py-3 ${pl ? 'px-5' : ''}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className="text-sm font-semibold text-[#092E3F] tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-[4px] px-3.5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-base font-semibold tabular-nums mt-0.5 ${accent ? 'text-[#2f7d52]' : 'text-[#092E3F]'}`}>{value}</p>
    </div>
  );
}

function ViewBtn({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: typeof Database; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]'
          : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function DrawerTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-[#2A96A8] text-[#1e7d8f]' : 'border-transparent text-[#6b828c] hover:text-[#092E3F]/80'
      }`}
    >
      {children}
    </button>
  );
}
