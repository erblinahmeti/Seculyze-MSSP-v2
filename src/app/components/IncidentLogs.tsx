import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner@2.0.3';
import { ChevronDown, ChevronUp, Copy, FileText, Maximize2, Play, Search, Terminal, X } from 'lucide-react';

// ─── Logs ────────────────────────────────────────────────────────────────────
//
// The raw Sentinel rows behind an incident, in the Incidents (A) panel's design
// (IncidentDetail.tsx): log entries with a search on the left, the selected
// entry's raw data on the right, and View All Logs for a full-screen view with
// Run Query. Search and query cover every field of the raw data, so "50126",
// "FileDownloaded" or an IP all find their rows.

export interface LogEntry {
  id: string;
  /** UTC, as Sentinel's TimeGenerated. */
  time: string;
  /** The Sentinel table the row comes from. */
  table: string;
  /** One readable line for the list. */
  summary: string;
  raw: Record<string, string | number | boolean | null>;
}

const signin = (
  id: string,
  time: string,
  upn: string,
  ip: string,
  resultType: number,
  resultDescription: string,
  extra: Record<string, string | number | boolean | null> = {},
): LogEntry => ({
  id,
  time,
  table: 'SigninLogs',
  summary: resultType === 0 ? `Successful sign-in by ${upn} from ${ip}` : `${resultDescription} (${resultType}) — ${upn} from ${ip}`,
  raw: {
    TimeGenerated: time,
    UserPrincipalName: upn,
    IPAddress: ip,
    ResultType: resultType,
    ResultDescription: resultDescription,
    AppDisplayName: 'Microsoft Office 365 Portal',
    ClientAppUsed: 'Browser',
    ConditionalAccessStatus: resultType === 0 ? 'success' : 'notApplied',
    ...extra,
  },
});

const LOGS: Record<string, LogEntry[]> = {
  '14310': [
    signin('l1', '2026-11-01T13:29:58Z', 'hello@nike.com', '45.141.84.120', 50126, 'Invalid username or password', { Location: 'RU', AppDisplayName: 'Azure Active Directory PowerShell', ClientAppUsed: 'Mobile Apps and Desktop clients' }),
    signin('l2', '2026-11-01T13:29:41Z', 'hello@nike.com', '185.220.101.18', 50053, 'Account is locked', { Location: 'DE', AppDisplayName: 'Azure Active Directory PowerShell', ClientAppUsed: 'Mobile Apps and Desktop clients' }),
    signin('l3', '2026-11-01T13:28:07Z', 'hello@nike.com', '61.73.190.98', 50126, 'Invalid username or password', { Location: 'KR' }),
    signin('l4', '2026-11-01T13:27:52Z', 'hello@nike.com', '185.220.100.252', 50053, 'Account is locked', { Location: 'DE' }),
    signin('l5', '2026-11-01T13:26:19Z', 'hello@nike.com', '196.216.81.126', 50126, 'Invalid username or password', { Location: 'KE' }),
    signin('l6', '2026-11-01T13:25:03Z', 'hello@nike.com', '91.240.118.172', 50126, 'Invalid username or password', { Location: 'RU' }),
    {
      id: 'l7',
      time: '2026-11-01T13:24:30Z',
      table: 'AADNonInteractiveUserSignInLogs',
      summary: 'Token request failed for hello@nike.com from 104.244.72.115',
      raw: {
        TimeGenerated: '2026-11-01T13:24:30Z',
        UserPrincipalName: 'hello@nike.com',
        IPAddress: '104.244.72.115',
        ResultType: 50126,
        ResultDescription: 'Invalid username or password',
        ResourceDisplayName: 'Windows Azure Active Directory',
        Location: 'LU',
      },
    },
    signin('l8', '2026-11-01T08:02:11Z', 'hello@nike.com', '87.62.98.14', 0, 'Success', { Location: 'DK', DeviceDetail: 'Windows10 · Edge', MfaDetail: 'Authenticator push' }),
  ],
  '14287': [
    signin('l1', '2026-11-02T08:40:52Z', 'tomislav@adidas.com', '95.168.123.186', 0, 'Success', { Location: 'DE', AutonomousSystemNumber: 12830, MfaDetail: 'Authenticator push', DeviceDetail: 'Windows10 · Chrome · unmanaged' }),
    signin('l2', '2026-11-02T08:40:38Z', 'tomislav@adidas.com', '95.168.123.186', 50074, 'Strong authentication is required', { Location: 'DE', AutonomousSystemNumber: 12830 }),
    signin('l3', '2026-10-29T17:22:40Z', 'tomislav@adidas.com', '95.168.123.186', 0, 'Success', { Location: 'DE', AutonomousSystemNumber: 12830, MfaDetail: 'Authenticator push' }),
    signin('l4', '2026-10-24T18:05:03Z', 'tomislav@adidas.com', '95.168.123.190', 0, 'Success', { Location: 'DE', AutonomousSystemNumber: 12830, MfaDetail: 'Authenticator push' }),
    signin('l5', '2026-10-19T08:12:44Z', 'tomislav@adidas.com', '95.168.121.77', 0, 'Success', { Location: 'DE', AutonomousSystemNumber: 12830, MfaDetail: 'Authenticator push' }),
  ],
  '14352': [
    {
      id: 'l1',
      time: '2026-11-02T10:13:20Z',
      table: 'AuditLogs',
      summary: 'Sessions revoked for finance-ops@puma.com by automation',
      raw: { TimeGenerated: '2026-11-02T10:13:20Z', OperationName: 'Revoke user sessions', Result: 'success', TargetUser: 'finance-ops@puma.com', InitiatedBy: 'Seculyze containment' },
    },
    {
      id: 'l2',
      time: '2026-11-02T10:11:52Z',
      table: 'OfficeActivity',
      summary: 'customer-contracts-2026.zip downloaded from SharePoint',
      raw: { TimeGenerated: '2026-11-02T10:11:52Z', Operation: 'FileDownloaded', UserId: 'finance-ops@puma.com', ClientIP: '185.220.101.44', Site_Url: 'https://puma.sharepoint.com/sites/finance', SourceFileName: 'customer-contracts-2026.zip', UserAgent: 'OneDrive.exe' },
    },
    {
      id: 'l3',
      time: '2026-11-02T10:06:05Z',
      table: 'OfficeActivity',
      summary: 'Q4-payroll-export.xlsx downloaded from SharePoint',
      raw: { TimeGenerated: '2026-11-02T10:06:05Z', Operation: 'FileDownloaded', UserId: 'finance-ops@puma.com', ClientIP: '185.220.101.44', Site_Url: 'https://puma.sharepoint.com/sites/finance', SourceFileName: 'Q4-payroll-export.xlsx', UserAgent: 'OneDrive.exe' },
    },
    {
      id: 'l4',
      time: '2026-11-02T10:03:30Z',
      table: 'AuditLogs',
      summary: 'Consent granted to an OAuth application by finance-ops@puma.com',
      raw: { TimeGenerated: '2026-11-02T10:03:30Z', OperationName: 'Consent to application', Result: 'success', InitiatedBy: 'finance-ops@puma.com', TargetApp: 'Mail Sync Pro', Permissions: 'Mail.Read, Files.Read.All, offline_access' },
    },
    signin('l5', '2026-11-02T10:01:40Z', 'finance-ops@puma.com', '185.220.101.44', 0, 'Success', { Location: 'DE', AppDisplayName: 'Microsoft SharePoint Online', TokenIssuerType: 'AzureAD', IsInteractive: false, Note: 'Token replayed from FIN-LT-0231 session' }),
    signin('l6', '2026-11-02T09:31:03Z', 'finance-ops@puma.com', '87.49.144.10', 0, 'Success', { Location: 'DK', DeviceDetail: 'FIN-LT-0231 · Windows11 · managed', MfaDetail: 'Authenticator push' }),
  ],
  '14360': [
    {
      id: 'l1',
      time: '2026-11-02T10:58:14Z',
      table: 'OfficeActivity',
      summary: 'Inbox rule "Sync" created: forward all mail to ops@mailbox-sync.co',
      raw: { TimeGenerated: '2026-11-02T10:58:14Z', Operation: 'New-InboxRule', UserId: 'j.berg@nike.com', ClientIP: '10.40.12.88', RuleName: 'Sync', ForwardTo: 'ops@mailbox-sync.co', Conditions: 'All messages', StopProcessingRules: true },
    },
    signin('l2', '2026-11-02T10:51:40Z', 'j.berg@nike.com', '10.40.12.88', 0, 'Success', { Location: 'DK', DeviceDetail: 'LT-0188 · Windows11 · managed', MfaDetail: 'Authenticator push' }),
    {
      id: 'l3',
      time: '2026-11-02T10:59:02Z',
      table: 'MessageTrace',
      summary: 'Message trace failed (429 Too Many Requests)',
      raw: { TimeGenerated: '2026-11-02T10:59:02Z', Operation: 'Get-MessageTrace', Status: 'Failed', Error: '429 Too Many Requests', Recipient: 'ops@mailbox-sync.co' },
    },
  ],
  '14371': [
    signin('l1', '2026-11-02T11:09:20Z', 'a.nielsen-admin@adidas.com', '89.187.171.20', 0, 'Success', { Location: 'GB', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push — approved', Note: 'Commercial VPN (CDN77)' }),
    signin('l2', '2026-11-02T11:08:41Z', 'a.nielsen-admin@adidas.com', '89.187.171.20', 500121, 'Authentication failed during strong authentication request', { Location: 'GB', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push — denied' }),
    signin('l3', '2026-11-02T11:07:15Z', 'a.nielsen-admin@adidas.com', '89.187.171.20', 500121, 'Authentication failed during strong authentication request', { Location: 'GB', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push — denied' }),
    signin('l4', '2026-11-02T11:05:02Z', 'a.nielsen-admin@adidas.com', '89.187.171.20', 500121, 'Authentication failed during strong authentication request', { Location: 'GB', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push — denied' }),
    signin('l5', '2026-11-02T11:03:37Z', 'a.nielsen-admin@adidas.com', '89.187.171.20', 500121, 'Authentication failed during strong authentication request', { Location: 'GB', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push — denied' }),
  ],
  '14388': [
    ...['Payroll Connector', 'HR Sync', 'Finance Reports API', 'Vendor Portal'].map(
      (app, i): LogEntry => ({
        id: `l${i + 1}`,
        time: `2026-10-31T10:${String(12 + i * 3).padStart(2, '0')}:0${i}Z`,
        table: 'AuditLogs',
        summary: `Client secret added to ${app} by kristian@puma.com`,
        raw: {
          TimeGenerated: `2026-10-31T10:${String(12 + i * 3).padStart(2, '0')}:0${i}Z`,
          OperationName: 'Update application – Certificates and secrets management',
          Result: 'success',
          InitiatedBy: 'kristian@puma.com',
          IPAddress: '188.179.84.12',
          TargetApp: app,
          KeyType: 'Password',
          KeyExpiry: '2027-05-18',
        },
      }),
    ),
    signin('l5', '2026-10-31T10:08:31Z', 'kristian@puma.com', '188.179.84.12', 0, 'Success', { Location: 'DK', AppDisplayName: 'Azure Portal', MfaDetail: 'Authenticator push', DeviceDetail: 'Windows11 · managed' }),
  ],
};

export const incidentLogs = (incidentNumber: string): LogEntry[] =>
  [...(LOGS[incidentNumber] ?? [])].sort((a, b) => b.time.localeCompare(a.time));

const when = (iso: string) => iso.replace('T', ' ').replace('Z', '');

const matches = (log: LogEntry, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [log.summary, log.table, log.time, JSON.stringify(log.raw)].some(s => s.toLowerCase().includes(needle));
};

const copyRaw = (log: LogEntry) => {
  navigator.clipboard?.writeText(JSON.stringify(log.raw, null, 2));
  toast.success('Raw log data copied to clipboard');
};

export default function IncidentLogs({
  incidentNumber,
  total,
  open,
  onToggle,
  entries,
}: {
  incidentNumber: string;
  /** Rows to show instead of this file's fixtures (the main Incidents page writes its own). */
  entries?: LogEntry[];
  /** Every row Sentinel holds for the incident; the panel lists the latest. */
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const logs = useMemo(
    () => (entries ? [...entries].sort((a, b) => b.time.localeCompare(a.time)) : incidentLogs(incidentNumber)),
    [entries, incidentNumber],
  );
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(logs[0]?.id ?? null);
  const [fullScreen, setFullScreen] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const filtered = logs.filter(l => matches(l, search) && matches(l, activeQuery));
  const selected = logs.find(l => l.id === selectedId) ?? null;

  const runQuery = () => {
    setActiveQuery(queryText);
    setShowQuery(false);
    toast.success(`Query executed - ${logs.filter(l => matches(l, queryText)).length} log(s) found`);
  };

  const entry = (l: LogEntry, big: boolean) => (
    <button
      key={l.id}
      onClick={() => setSelectedId(l.id)}
      className={`w-full ${big ? 'p-3' : 'p-2'} rounded-[8px] text-left transition-colors ${
        selectedId === l.id ? 'bg-[#2A96A8]/10 border border-[#2A96A8]' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className={`flex items-center gap-1.5 ${big ? 'mb-1' : 'mb-0.5'} flex-wrap`}>
        <span className={`${big ? 'text-xs' : 'text-[10px]'} text-[#092E3F]/60 tabular-nums`}>{when(l.time)}</span>
      </div>
      <p className={`${big ? 'text-xs mb-1' : 'text-[10px] mb-0.5'} text-[#2A96A8] font-medium`}>{l.table}</p>
      <p className={`${big ? 'text-sm line-clamp-2' : 'text-xs line-clamp-1'} text-[#092E3F]`}>{l.summary}</p>
    </button>
  );

  const rawPane = (big: boolean) => (
    <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
      <div className={`sticky top-0 bg-white border-b border-[var(--stroke)] ${big ? 'px-4 py-3' : 'p-3'} flex items-center justify-between flex-shrink-0`}>
        <h4 className="text-sm font-medium text-[#092E3F]">Raw Log Data</h4>
        {selected && (
          <button
            onClick={() => copyRaw(selected)}
            className={`flex items-center ${big ? 'gap-2 px-3 py-1.5' : 'gap-1.5 px-2 py-1'} text-xs text-[#2A96A8] hover:bg-[#2A96A8]/10 rounded-[8px] transition-colors`}
          >
            <Copy className={big ? 'w-4 h-4' : 'w-3 h-3'} />
            Copy
          </button>
        )}
      </div>
      <div className="overflow-y-auto flex-1">
        {selected ? (
          <div className={big ? 'p-6' : 'p-4'}>
            <div className={`${big ? 'mb-6 pb-6' : 'mb-4 pb-4'} border-b border-[var(--stroke)]`}>
              <div className={`flex items-center gap-2 ${big ? 'mb-3' : 'mb-2'}`}>
                <span className={`${big ? 'text-sm' : 'text-xs'} text-[#2A96A8] font-medium`}>{selected.table}</span>
              </div>
              <p className={`${big ? 'text-base' : 'text-sm'} text-[#092E3F] mb-2`}>{selected.summary}</p>
              <p className={`${big ? 'text-sm' : 'text-xs'} text-[#092E3F]/60 tabular-nums`}>{when(selected.time)}</p>
            </div>
            <div className={`bg-[#092E3F] rounded-[8px] ${big ? 'p-6' : 'p-4'} overflow-x-auto`}>
              <pre className={`${big ? 'text-sm' : 'text-xs'} text-green-400 whitespace-pre-wrap`}>{JSON.stringify(selected.raw, null, 2)}</pre>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[#092E3F]/60 text-sm">Select a log entry to view details</div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Header: the panel's section style, with Incidents (A)'s View All Logs. */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onToggle} className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#092E3F]" />
          <h3 className="text-base font-bold text-[#092E3F]">
            Logs<span className="ml-1 font-normal text-[#092E3F]/60 tabular-nums">({total.toLocaleString()})</span>
          </h3>
        </button>
        <span className="flex items-center gap-3">
          {open && (
            <button
              onClick={() => setFullScreen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#2A96A8] hover:bg-[#2A96A8]/10 rounded-[8px] transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              View All Logs
            </button>
          )}
          <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronUp className="w-4 h-4 text-[#092E3F]/60" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/60" />}
          </button>
        </span>
      </div>

      {open && (
        <div className="grid grid-cols-[35fr_65fr] gap-4 h-[600px]">
          {/* Left: Log List */}
          <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[var(--stroke)] px-3 py-2 flex-shrink-0">
              <h4 className="text-xs font-medium text-[#092E3F] mb-2">Log Entries ({filtered.length})</h4>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#092E3F]/40" />
                <input
                  type="text"
                  placeholder="Search all log data (e.g., 50126, FileDownloaded, an IP)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8]"
                />
              </div>
              {search && <p className="text-[10px] text-[#2A96A8] mt-1">Searching through all fields including raw log data</p>}
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 space-y-1">{filtered.map(l => entry(l, false))}</div>
          </div>
          {/* Right: Raw Log Details */}
          {rawPane(false)}
        </div>
      )}

      {/* Full-Screen Logs View */}
      {fullScreen &&
        createPortal(
          <>
            <div className="fixed inset-0 bg-black/50 z-[60] animate-in fade-in duration-200" onClick={() => setFullScreen(false)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto bg-white rounded-[8px] shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="bg-[#092E3F] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-[8px]">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-white" />
                    <div>
                      <h2 className="text-xl text-white">All Logs - Incident {incidentNumber}</h2>
                      <p className="text-white/70 text-sm">{logs.length} log entries</p>
                    </div>
                  </div>
                  <button onClick={() => setFullScreen(false)} className="p-2 rounded-[8px] hover:bg-white/10 transition-colors">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex flex-col h-full p-4 gap-4">
                    {showQuery && (
                      <div className="border border-[#2A96A8] rounded-[8px] bg-white overflow-hidden flex-shrink-0">
                        <div className="bg-[#092E3F] px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-white" />
                            <h4 className="text-base text-white font-medium">Query Logs</h4>
                          </div>
                          <button onClick={() => setShowQuery(false)} className="p-1 hover:bg-white/10 rounded-[8px] transition-colors">
                            <X className="w-5 h-5 text-white" />
                          </button>
                        </div>
                        <div className="p-4">
                          <textarea
                            value={queryText}
                            onChange={e => setQueryText(e.target.value)}
                            placeholder="Enter query (e.g., 50126, FileDownloaded, UserPrincipalName, 185.220.101.44)..."
                            className="w-full h-32 px-3 py-2 text-sm border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8] resize-none"
                          />
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-sm text-[#092E3F]/60">Query searches through all raw log data including ResultType, Operation, UserPrincipalName, IPAddress, and more.</p>
                            <button onClick={runQuery} className="flex items-center gap-2 px-4 py-2 bg-[#2A96A8] text-white rounded-[8px] hover:bg-[#2A96A8]/90 transition-colors">
                              <Play className="w-4 h-4" />
                              Run Query
                            </button>
                          </div>
                          {activeQuery && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-[8px] flex items-center justify-between">
                              <p className="text-sm text-green-700">
                                Active query: <span className="font-medium">{activeQuery}</span>
                              </p>
                              <button
                                onClick={() => {
                                  setActiveQuery('');
                                  setQueryText('');
                                }}
                                className="text-sm text-green-700 hover:text-green-900 underline"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-[30fr_70fr] gap-4 flex-1 overflow-hidden">
                      <div className="border border-[var(--stroke)] rounded-[8px] bg-white overflow-hidden flex flex-col">
                        <div className="sticky top-0 bg-white border-b border-[var(--stroke)] px-4 py-3 flex-shrink-0">
                          <h4 className="text-sm font-medium text-[#092E3F] mb-3">Log Entries ({filtered.length})</h4>
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#092E3F]/40" />
                            <input
                              type="text"
                              placeholder="Search logs..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--stroke)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#2A96A8]/20 focus:border-[#2A96A8]"
                            />
                          </div>
                          <button
                            onClick={() => setShowQuery(!showQuery)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#092E3F] text-white rounded-[8px] hover:bg-[#092E3F]/90 transition-colors"
                          >
                            <Terminal className="w-4 h-4" />
                            {showQuery ? 'Hide Query' : 'Run Query'}
                          </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">{filtered.map(l => entry(l, true))}</div>
                      </div>
                      {rawPane(true)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
