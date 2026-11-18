import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Sparkles, Lock, ExternalLink, ShieldCheck, ShieldOff, Bot, Workflow,
  Database, Target, Server, Clock, History, ChevronRight, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { TENANTS } from './tenants';
import { formatDateTime } from './dates';

// ─── LLM data processing consent (US 3191) ───────────────────────────────────
//
// AI features — Agentic SOC triage and response agents, and the agent steps in
// Automated Response flows — send a tenant's security data to a Large Language
// Model. They only run once that tenant's admin has explicitly accepted it, and
// the record of who accepted (or revoked) and when is kept beside the control.
//
// Off by default for every tenant. Accepting is two deliberate actions — tick
// the acknowledgement, then press the button — so a stray click cannot turn it
// on. Revoking asks first and names what stops.
//
// Consent belongs to one tenant, so the control only appears with a single
// tenant in view. In MSSP scope the page is an overview of all of them.

// Provider, region and retention are placeholders until product/legal confirm
// the production values — they live here so there is one place to change them.
const DISCLOSURE = {
  provider: 'Azure OpenAI Service (Microsoft)',
  region: 'Sweden Central, EU',
  retention: 'Not used to train models. The provider may keep prompts and responses for up to 30 days for abuse monitoring, then deletes them.',
  termsVersion: '1.0',
  termsUrl: '#',
};

// The signed-in user in the sidebar.
const CURRENT_USER = { name: 'John Doe', email: 'john.doe@example.com' };

export type Role = 'admin' | 'analyst';

interface ConsentEvent {
  kind: 'accepted' | 'revoked';
  by: string;
  email: string;
  at: string; // ISO
  termsVersion: string;
}

/** Newest first. Empty = never accepted. */
export type ConsentLog = Record<string, ConsentEvent[]>;

const ev = (kind: ConsentEvent['kind'], by: string, at: string): ConsentEvent => ({
  kind, by, email: `${by.toLowerCase().replace(' ', '.')}@example.com`, at, termsVersion: '1.0',
});

export const INITIAL_CONSENT: ConsentLog = {
  Nike:      [ev('accepted', 'Jordan Reyes', '2026-10-02T09:14:00')],
  Adidas:    [ev('accepted', 'Mia Schulz', '2026-10-21T13:42:00')],
  Puma:      [ev('revoked', 'Lena Hoff', '2026-11-09T16:05:00'), ev('accepted', 'Lena Hoff', '2026-10-14T10:30:00')],
  Asics:     [ev('accepted', 'Kenji Mori', '2026-11-03T08:02:00')],
  Salomon:   [ev('accepted', 'Claire Martin', '2026-11-12T11:27:00')],
  Patagonia: [ev('accepted', 'Sam Ortiz', '2026-10-30T15:48:00')],
  Hoka:      [ev('accepted', 'Noah Brooks', '2026-11-16T09:55:00')],
};

export const isAccepted = (log: ConsentLog, tenant: string) => log[tenant]?.[0]?.kind === 'accepted';

// What stops or starts with consent — named, so the choice is concrete.
const FEATURES = [
  { icon: Sparkles, name: 'AI Analysis & Recommendation', where: 'Incidents — triage and response recommendations' },
  { icon: Bot,      name: 'Response agents',             where: 'Agentic SOC — automated investigation and response' },
  { icon: Workflow, name: 'Agent steps in flows',        where: 'Automated Response — steps run by an AI agent' },
];

export default function LlmConsentSection({ log, setLog, role, setRole }: {
  log: ConsentLog;
  setLog: React.Dispatch<React.SetStateAction<ConsentLog>>;
  role: Role;
  setRole: (r: Role) => void;
}) {
  const ws = useWorkspace();
  // Set when a tenant was opened from the overview table, so the tenant view
  // can offer the way back. Picking a tenant in the switcher is a deliberate
  // scope change and gets no back link. The filter lives here so it is still
  // applied when the table comes back.
  const [fromOverview, setFromOverview] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const open = (t: string) => { setFromOverview(true); ws.setTenant(t); };
  const back = () => { setFromOverview(false); ws.setScope('mssp'); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#092E3F]">LLM data processing</h2>
        {/* Prototype only — lets a session see the read-only view without a second login. */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#092E3F]/45">Preview as</span>
          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px]">
            <Seg active={role === 'admin'} onClick={() => setRole('admin')}>Tenant admin</Seg>
            <Seg active={role === 'analyst'} onClick={() => setRole('analyst')}>Analyst</Seg>
          </div>
        </div>
      </div>

      {ws.single ? (
        <>
          {fromOverview && (
            <button
              onClick={back}
              className="inline-flex items-center gap-1.5 mb-4 -ml-1 px-1 py-0.5 text-xs font-medium text-[#2A96A8] hover:text-[#1e7d8f] rounded-[4px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All tenants
            </button>
          )}
          <TenantConsent tenant={ws.tenant!} log={log} setLog={setLog} role={role} />
        </>
      ) : (
        <FleetOverview log={log} onOpen={open} filter={filter} setFilter={setFilter} />
      )}
    </div>
  );
}

// ─── One tenant ──────────────────────────────────────────────────────────────

function TenantConsent({ tenant, log, setLog, role }: {
  tenant: string;
  log: ConsentLog;
  setLog: React.Dispatch<React.SetStateAction<ConsentLog>>;
  role: Role;
}) {
  const events = log[tenant] ?? [];
  const latest = events[0];
  const accepted = latest?.kind === 'accepted';
  const isAdmin = role === 'admin';
  const [ack, setAck] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const record = (kind: ConsentEvent['kind']) => {
    const e: ConsentEvent = {
      kind, by: CURRENT_USER.name, email: CURRENT_USER.email,
      at: new Date().toISOString(), termsVersion: DISCLOSURE.termsVersion,
    };
    setLog(prev => ({ ...prev, [tenant]: [e, ...(prev[tenant] ?? [])] }));
  };

  const accept = () => {
    record('accepted');
    setAck(false);
    toast.success(`LLM data processing accepted for ${tenant} — AI features are on`);
  };

  const revoke = () => {
    record('revoked');
    setConfirmRevoke(false);
    toast.success(`LLM data processing revoked for ${tenant} — AI features are off`);
  };

  return (
    <div className="max-w-[800px]">
      <p className="text-sm text-[#092E3F]/70 leading-6 mb-5">
        AI features send <span className="font-medium text-[#092E3F]">{tenant}</span>&rsquo;s security data to a
        Large Language Model. They only run after a tenant admin has accepted the terms below.
      </p>

      {/* Status — what is true right now, and who made it so. */}
      <div className={`flex items-start gap-3 px-4 py-3.5 mb-5 rounded-[4px] border-l-2 ${
        accepted ? 'bg-[#e5f2f4] border-[#2A96A8]' : 'bg-[#f1f4f5] border-[#87999f]'
      }`}>
        {accepted
          ? <ShieldCheck className="w-4 h-4 mt-0.5 text-[#1e7d8f] shrink-0" />
          : <ShieldOff className="w-4 h-4 mt-0.5 text-[#5c707a] shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${accepted ? 'text-[#1e7d8f]' : 'text-[#092E3F]'}`}>
              {accepted ? 'Accepted — AI features are on' : 'Not accepted — AI features are off'}
            </span>
          </div>
          <p className="text-xs text-[#092E3F]/60 mt-0.5">
            {latest
              ? <>{latest.kind === 'accepted' ? 'Accepted' : 'Revoked'} by <span className="font-medium text-[#092E3F]">{latest.by}</span> ({latest.email}) on {formatDateTime(latest.at)} · terms v{latest.termsVersion}</>
              : 'No one has accepted LLM data processing for this tenant yet. Off by default.'}
          </p>
        </div>
      </div>

      {/* Disclosure — what, why, where, how long. */}
      <div className="border border-[var(--stroke)] rounded-[4px] overflow-hidden mb-5">
        <div className="px-4 py-2.5 bg-[#fafbfb] border-b border-gray-100">
          <span className="text-xs font-semibold text-[#092E3F]">What you are agreeing to</span>
        </div>
        <dl className="divide-y divide-gray-100">
          <DisclosureRow icon={Database} label="Data sent">
            <ul className="space-y-1">
              <li><span className="font-medium">Alert data</span> — titles, descriptions, severity, MITRE tactics and alert fields</li>
              <li><span className="font-medium">Incident data</span> — title, timeline, comments and related alerts</li>
              <li><span className="font-medium">Entity data</span> — user accounts, hosts, IP addresses, file hashes, URLs and mailboxes</li>
            </ul>
          </DisclosureRow>
          <DisclosureRow icon={Target} label="Why it is sent">
            Triage, response recommendations and automated responses — only for the incidents an AI feature runs on.
          </DisclosureRow>
          <DisclosureRow icon={Server} label="Provider & region">
            {DISCLOSURE.provider} · hosted in {DISCLOSURE.region}
          </DisclosureRow>
          <DisclosureRow icon={Clock} label="Retention">
            {DISCLOSURE.retention}
          </DisclosureRow>
        </dl>
        <a
          href={DISCLOSURE.termsUrl}
          onClick={e => e.preventDefault()}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#2A96A8] hover:text-[#1e7d8f] bg-[#fafbfb] border-t border-gray-100"
        >
          Read the full LLM data processing terms (v{DISCLOSURE.termsVersion})
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* What depends on it. */}
      <div className="mb-5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-2">Features that need this</p>
        <div className="border border-[var(--stroke)] rounded-[4px] divide-y divide-gray-100">
          {FEATURES.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5">
              <f.icon className="w-4 h-4 text-[#2A96A8] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#092E3F]">{f.name}</p>
                <p className="text-xs text-[#092E3F]/50">{f.where}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                accepted ? 'bg-[#e5f2f4] text-[#1e7d8f]' : 'bg-[#eef1f3] text-[#5c707a]'
              }`}>
                {accepted ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The control. Admins act; everyone else sees why they can't. */}
      {!isAdmin ? (
        <div className="flex items-start gap-2.5 px-4 py-3 mb-6 bg-[#fafbfb] border border-[var(--stroke)] rounded-[4px]">
          <Lock className="w-4 h-4 text-[#87999f] mt-0.5 shrink-0" />
          <p className="text-xs text-[#092E3F]/70 leading-5">
            Read-only. Only a tenant admin for {tenant} can {accepted ? 'revoke' : 'accept'} LLM data processing.
          </p>
        </div>
      ) : accepted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-6 border border-[var(--stroke)] rounded-[4px]">
          <p className="text-xs text-[#092E3F]/70">
            Revoking turns AI features off for {tenant} straight away.
          </p>
          <button
            onClick={() => setConfirmRevoke(true)}
            className="px-4 py-2 border border-[#d9534f]/40 text-[#c0392b] bg-white rounded-[4px] text-xs font-medium hover:bg-[#fdf1f0] transition-colors"
          >
            Revoke consent
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 mb-6 border border-[var(--stroke)] rounded-[4px]">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ack}
              onChange={e => setAck(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#2A96A8] shrink-0 cursor-pointer"
            />
            <span className="text-sm text-[#092E3F] leading-5">
              I have read the disclosure and the full terms, and I am authorised to allow {tenant}&rsquo;s
              alert, incident and entity data to be sent to {DISCLOSURE.provider}.
            </span>
          </label>
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={accept}
              disabled={!ack}
              className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Accept and turn on AI features
            </button>
          </div>
        </div>
      )}

      {/* The record of who agreed and when. */}
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-2">
          <History className="w-3.5 h-3.5" /> Consent history
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-[#092E3F]/50">No changes recorded.</p>
        ) : (
          <div className="border border-[var(--stroke)] rounded-[4px] divide-y divide-gray-100">
            {events.map((e, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
                <span className={`w-20 font-medium ${e.kind === 'accepted' ? 'text-[#1e7d8f]' : 'text-[#5c707a]'}`}>
                  {e.kind === 'accepted' ? 'Accepted' : 'Revoked'}
                </span>
                <span className="flex-1 min-w-[180px] text-[#092E3F]">
                  {e.by} <span className="text-[#092E3F]/45">· {e.email}</span>
                </span>
                <span className="text-[#092E3F]/60">{formatDateTime(e.at)}</span>
                <span className="text-[#092E3F]/40">terms v{e.termsVersion}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmRevoke && (
        <RevokeDialog tenant={tenant} onCancel={() => setConfirmRevoke(false)} onConfirm={revoke} />
      )}
    </div>
  );
}

function DisclosureRow({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 px-4 py-3">
      <dt className="flex items-center gap-2 self-start text-xs text-[#092E3F]/55">
        <Icon className="w-3.5 h-3.5 text-[#87999f] shrink-0" />
        {label}
      </dt>
      <dd className="text-xs leading-5 text-[#092E3F]">{children}</dd>
    </div>
  );
}

function RevokeDialog({ tenant, onCancel, onConfirm }: { tenant: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#092E3F]/40" onClick={onCancel} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[420px] bg-white rounded-[4px] shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[4px] bg-[#fdf6e9]">
              <ShieldOff className="w-4 h-4 text-[#c07d1e]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-medium text-[#092E3F]">Revoke LLM data processing?</h2>
              <p className="text-sm text-[#6b828c] mt-0.5">{tenant}</p>
            </div>
          </div>
          <p className="text-sm text-[#092E3F] leading-6 mt-4">
            No more of {tenant}&rsquo;s data is sent to the LLM from now on. You can accept again at any time.
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mt-3 mb-1.5">What stops</p>
          <ul className="space-y-1">
            {FEATURES.map(f => (
              <li key={f.name} className="flex items-baseline gap-2 text-xs text-[#092E3F]">
                <span className="w-1 h-1 rounded-full bg-[#c9d6dc] shrink-0 translate-y-[-2px]" />
                {f.name}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 mt-3 text-xs leading-5 text-[#c07d1e]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Data already sent is not recalled — the provider deletes it under its retention terms.</span>
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-[#fafbfb] border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-[#092E3F] border border-[var(--stroke)] bg-white rounded-[4px] hover:bg-[#f6f6f6]">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-xs font-medium text-white bg-[#c0392b] rounded-[4px] hover:bg-[#a93226]">
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── All tenants ─────────────────────────────────────────────────────────────

type Filter = 'all' | 'accepted' | 'off';

function FleetOverview({ log, onOpen, filter, setFilter }: {
  log: ConsentLog;
  onOpen: (t: string) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const acceptedCount = TENANTS.filter(t => isAccepted(log, t)).length;
  const rows = TENANTS.filter(t =>
    filter === 'all' ? true : filter === 'accepted' ? isAccepted(log, t) : !isAccepted(log, t));

  return (
    <div>
      <p className="text-sm text-[#092E3F]/70 leading-6 mb-4">
        Consent is given per tenant, by that tenant&rsquo;s admin. AI features only run for tenants that have accepted.
        <span className="font-medium text-[#092E3F]"> {acceptedCount} of {TENANTS.length}</span> have accepted.
      </p>

      <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px] mb-3">
        <Seg active={filter === 'all'} onClick={() => setFilter('all')}>All ({TENANTS.length})</Seg>
        <Seg active={filter === 'accepted'} onClick={() => setFilter('accepted')}>Accepted ({acceptedCount})</Seg>
        <Seg active={filter === 'off'} onClick={() => setFilter('off')}>Not accepted ({TENANTS.length - acceptedCount})</Seg>
      </div>

      <div className="border border-[var(--stroke)] rounded-[4px] overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1.4fr_1fr_32px] gap-4 px-4 py-2 bg-[#fafbfb] border-b border-gray-100 text-[11px] font-medium text-[#092E3F]/50">
          <span>Tenant</span><span>Status</span><span>Last change by</span><span>When</span><span />
        </div>
        <div className="divide-y divide-gray-100 max-h-[520px] overflow-auto">
          {rows.map(t => {
            const latest = log[t]?.[0];
            const on = latest?.kind === 'accepted';
            return (
              <button
                key={t}
                onClick={() => onOpen(t)}
                className="w-full grid grid-cols-[1.2fr_1fr_1.4fr_1fr_32px] gap-4 items-center px-4 py-2.5 text-left text-xs hover:bg-[#f6f9fa] transition-colors"
              >
                <span className="text-sm text-[#092E3F] truncate">{t}</span>
                <span>
                  <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                    on ? 'bg-[#e5f2f4] text-[#1e7d8f]' : 'bg-[#eef1f3] text-[#5c707a]'
                  }`}>
                    {on ? 'Accepted' : latest ? 'Revoked' : 'Not accepted'}
                  </span>
                </span>
                <span className="text-[#092E3F] truncate">{latest ? latest.by : <span className="text-[#092E3F]/35">—</span>}</span>
                <span className="text-[#092E3F]/60">{latest ? formatDateTime(latest.at) : <span className="text-[#092E3F]/35">—</span>}</span>
                <ChevronRight className="w-4 h-4 text-[#87999f]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]'
          : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      {children}
    </button>
  );
}
