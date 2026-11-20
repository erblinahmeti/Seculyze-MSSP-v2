import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner@2.0.3';
import { ChevronDown, Copy, Maximize2, Search, X } from 'lucide-react';

// ─── Logs ────────────────────────────────────────────────────────────────────
//
// The raw Sentinel rows behind an incident, as on the Incidents (A) panel: a
// searchable list, each row opening to its raw record, plus a Full size view
// with the list beside the record. The panel shows the latest rows the
// incident links to; the count in the header is everything Sentinel holds.
//
// Search covers every field of the raw record, so "50126", "FileDownloaded" or
// an IP all find their rows.

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

const when = (iso: string) => iso.replace('T', ' ').replace('Z', ' UTC');

const matches = (log: LogEntry, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [log.summary, log.table, log.time, JSON.stringify(log.raw)].some(s => s.toLowerCase().includes(needle));
};

const copyRaw = (log: LogEntry) => {
  navigator.clipboard?.writeText(JSON.stringify(log.raw, null, 2));
  toast.success('Raw log copied');
};

/** The raw record: navy, white text, Lato like everything else. */
function RawRecord({ log }: { log: LogEntry }) {
  return (
    <pre className="px-3 py-2.5 rounded-[4px] bg-[#092E3F] text-xs font-sans leading-relaxed text-white/90 whitespace-pre-wrap break-words">
      {JSON.stringify(log.raw, null, 2)}
    </pre>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#092E3F]/40" aria-hidden />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onChange('')}
        placeholder="Search all log fields (e.g. 50126, FileDownloaded, an IP)…"
        aria-label="Search logs"
        className="w-full h-9 pl-9 pr-3 rounded-[4px] border border-[var(--stroke)] bg-white text-sm text-[#092E3F] placeholder:text-[#092E3F]/40 focus:outline-none focus:border-[#2A96A8] focus:ring-2 focus:ring-[#2A96A8]/15"
      />
    </div>
  );
}

/** Full size: the list beside the selected record, over the page. */
function LogsFullSize({ incidentNumber, total, logs, onClose }: { incidentNumber: string; total: number; logs: LogEntry[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const shown = logs.filter(l => matches(l, query));
  const [selected, setSelected] = useState<string | null>(logs[0]?.id ?? null);
  const sel = shown.find(l => l.id === selected) ?? shown[0];
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={`Logs for incident ${incidentNumber}`} className="w-full max-w-6xl h-[88vh] bg-white rounded-[8px] shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#013042] to-[#184354] px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-base font-bold text-white">Logs</p>
            <p className="text-xs text-white/60 tabular-nums">
              #{incidentNumber} · latest {logs.length} of {total.toLocaleString()} rows
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-[8px] bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(280px,38%)_1fr]">
          <div className="border-r border-[var(--stroke)] flex flex-col min-h-0">
            <div className="p-3 border-b border-[var(--stroke)]">
              <SearchBox value={query} onChange={setQuery} />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {shown.length === 0 && <p className="p-4 text-xs text-[#092E3F]/60">No log rows match “{query}”.</p>}
              {shown.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelected(l.id)}
                  aria-pressed={sel?.id === l.id}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${sel?.id === l.id ? 'bg-[#e5f2f4]' : 'hover:bg-[#fafbfb]'}`}
                >
                  <span className="block text-xs text-[#092E3F]/60 tabular-nums">
                    {when(l.time)} · {l.table}
                  </span>
                  <span className="block text-sm text-[#092E3F] line-clamp-2">{l.summary}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            {sel ? (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm text-[#092E3F]">{sel.summary}</p>
                    <p className="text-xs text-[#092E3F]/60 tabular-nums">
                      {when(sel.time)} · {sel.table}
                    </p>
                  </div>
                  <button onClick={() => copyRaw(sel)} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[var(--stroke)] text-sm text-[#092E3F] hover:border-[#092E3F] transition-colors">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <RawRecord log={sel} />
              </>
            ) : (
              <p className="text-sm text-[#092E3F]/60">Select a log row to see its raw record.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The Logs section's body. The section header (title, count, toggle) is the
 * panel's own, so it matches the other sections.
 */
export default function IncidentLogs({ incidentNumber, total }: { incidentNumber: string; total: number }) {
  const logs = useMemo(() => incidentLogs(incidentNumber), [incidentNumber]);
  const [query, setQuery] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const shown = logs.filter(l => matches(l, query));

  if (logs.length === 0) return <p className="text-sm text-[#092E3F]/60">No log rows are linked to this incident.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <button
          onClick={() => setFull(true)}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-[4px] border border-[var(--stroke)] bg-white text-sm text-[#092E3F] hover:border-[#092E3F] transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Full size
        </button>
      </div>

      <div className="rounded-[8px] border border-[var(--stroke)] divide-y divide-gray-100 overflow-hidden">
        {shown.length === 0 && <p className="px-4 py-3 text-xs text-[#092E3F]/60">No log rows match “{query}”.</p>}
        {shown.map(l => {
          const open = openRow === l.id;
          return (
            <div key={l.id}>
              <button
                onClick={() => setOpenRow(open ? null : l.id)}
                aria-expanded={open}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[#092E3F] truncate">{l.summary}</span>
                  <span className="block text-xs text-[#092E3F]/60 tabular-nums">
                    {when(l.time)} · {l.table}
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-[#092E3F]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="px-4 pb-3 space-y-2">
                  <RawRecord log={l} />
                  <button onClick={() => copyRaw(l)} className="inline-flex items-center gap-1.5 text-xs text-[#092E3F]/60 hover:text-[#092E3F]">
                    <Copy className="w-3.5 h-3.5" /> Copy raw log
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[#092E3F]/60 tabular-nums">
        Latest {logs.length} of {total.toLocaleString()} rows. The full set is in Microsoft Sentinel.
      </p>

      {full && <LogsFullSize incidentNumber={incidentNumber} total={total} logs={logs} onClose={() => setFull(false)} />}
    </div>
  );
}
