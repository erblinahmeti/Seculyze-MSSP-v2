import { useEffect, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Sparkles, Lock, ExternalLink, ShieldOff, Bot, Workflow, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import Pagination from './Pagination';
import { TABLE_SHELL, GRID_SCROLL, GRID_HEAD, GRID_ROW, GRID_BODY } from './tableStyles';
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
// Laid out like the Data Collection table: a row per tenant (just the one in
// single-tenant scope), expanding in place to the full disclosure, the
// features it gates, the accept/revoke control and the consent history.

// Provider, region and retention are placeholders until product/legal confirm
// the production values — they live here so there is one place to change them.
const DISCLOSURE = {
  provider: 'Azure OpenAI',
  region: 'Denmark Central',
  retention: 'Placeholder: confirm with legal before release',
  termsVersion: '1.0',
  termsUrl: '#',
};

// The signed-in user in the sidebar.
const CURRENT_USER = { name: 'John Doe', email: 'john.doe@seculyze.com' };

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
  kind, by, email: `${by.toLowerCase().replace(' ', '.')}@seculyze.com`, at, termsVersion: '1.0',
});

export const INITIAL_CONSENT: ConsentLog = {
  Nike:      [ev('accepted', 'Jordan Reyes', '2026-10-02T09:14:00')],
  Adidas:    [ev('accepted', 'Mia Schulz', '2026-10-21T13:42:00')],
  Puma:      [ev('revoked', 'Kristian', '2026-11-18T12:18:00'), ev('accepted', 'Kristian', '2026-10-14T10:30:00')],
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
  const tenants = ws.single ? [ws.tenant!] : TENANTS;
  const acceptedCount = tenants.filter(t => isAccepted(log, t)).length;

  // Same table as Data Collection: one row per tenant, the row expands in
  // place with everything about that tenant's consent. With one tenant in
  // view its row starts open, since there is nothing else to choose.
  const [expanded, setExpanded] = useState<string | null>(ws.single ? ws.tenant : null);
  useEffect(() => { setExpanded(ws.single ? ws.tenant : null); setPage(1); }, [ws.single, ws.tenant]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const paged = tenants.slice((page - 1) * pageSize, page * pageSize);

  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const record = (tenant: string, kind: ConsentEvent['kind']) => {
    const e: ConsentEvent = {
      kind, by: CURRENT_USER.name, email: CURRENT_USER.email,
      at: new Date().toISOString(), termsVersion: DISCLOSURE.termsVersion,
    };
    setLog(prev => ({ ...prev, [tenant]: [e, ...(prev[tenant] ?? [])] }));
  };

  const accept = (tenant: string) => {
    record(tenant, 'accepted');
    toast.success(`LLM data processing accepted for ${tenant} — AI features are on`);
  };

  const revoke = (tenant: string) => {
    record(tenant, 'revoked');
    setConfirmRevoke(null);
    toast.success(`LLM data processing revoked for ${tenant} — AI features are off`);
  };

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

      {!ws.single && (
        <p className="text-sm text-[#092E3F]/70 mb-4">
          <span className="font-medium text-[#092E3F]">{acceptedCount} of {tenants.length}</span> tenants have accepted LLM data processing.
        </p>
      )}

      <div className={TABLE_SHELL}>
        <div className={GRID_SCROLL}>
          <div className={`grid ${COLS} gap-3 ${GRID_HEAD}`}>
            <div>Tenant</div><div>Status</div><div>Last change by</div><div>When</div>
          </div>
          <div className={GRID_BODY}>
            {paged.map(t => {
              const latest = log[t]?.[0];
              const on = latest?.kind === 'accepted';
              const open = expanded === t;
              return (
                <div key={t}>
                  <div
                    onClick={() => setExpanded(p => p === t ? null : t)}
                    aria-expanded={open}
                    className={`grid ${COLS} gap-3 items-center cursor-pointer ${GRID_ROW}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {open
                        ? <ChevronDown className="w-4 h-4 text-[#87999f] shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-[#87999f] shrink-0" />}
                      <span className="font-medium truncate">{t}</span>
                    </div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${
                        on ? 'bg-[#e5f2f4] text-[#1e7d8f]' : 'bg-[#eef1f3] text-[#5c707a]'
                      }`}>
                        {on ? 'Accepted' : latest ? 'Revoked' : 'Not accepted'}
                      </span>
                    </div>
                    <div className="truncate text-[#092E3F]/80">{latest ? latest.email : <span className="text-[#092E3F]/35">—</span>}</div>
                    <div className="text-[#092E3F]/80">{latest ? formatDateTime(latest.at) : <span className="text-[#092E3F]/35">—</span>}</div>
                  </div>

                  {open && (
                    <ConsentDetail
                      key={`${t}-${on}`}
                      tenant={t}
                      events={log[t] ?? []}
                      isAdmin={role === 'admin'}
                      onAccept={() => accept(t)}
                      onRevoke={() => setConfirmRevoke(t)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {!ws.single && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={tenants.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {confirmRevoke && (
        <RevokeDialog tenant={confirmRevoke} onCancel={() => setConfirmRevoke(null)} onConfirm={() => revoke(confirmRevoke)} />
      )}
    </div>
  );
}

const COLS = 'grid-cols-[minmax(180px,1.4fr)_minmax(120px,0.8fr)_minmax(160px,1fr)_minmax(150px,1fr)]';

// ─── Expanded row ────────────────────────────────────────────────────────────

function statusSentence(e: ConsentEvent | undefined) {
  if (!e) return 'Not accepted. AI-driven features are off for this tenant until a tenant admin accepts.';
  const when = `${e.email} on ${formatDateTime(e.at)}`;
  return e.kind === 'accepted'
    ? `Accepted by ${when}. AI-driven features are on for this tenant.`
    : `Revoked by ${when}. AI-driven features are off for this tenant until a tenant admin accepts again.`;
}

function ConsentDetail({ tenant, events, isAdmin, onAccept, onRevoke }: {
  tenant: string;
  events: ConsentEvent[];
  isAdmin: boolean;
  onAccept: () => void;
  onRevoke: () => void;
}) {
  const accepted = events[0]?.kind === 'accepted';
  const [ack, setAck] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="px-5 pl-[42px] py-4 bg-[#fafbfb] border-t border-gray-100">
      <div className="max-w-[760px] space-y-3">
        <p className="text-sm text-[#092E3F]">{statusSentence(events[0])}</p>

        <p className="text-sm leading-6 text-[#092E3F]/75">
          To triage alerts, recommend responses and run automated responses, Seculyze&rsquo;s AI features — the
          Agentic SOC triage and response agents, and the agent steps in Automated Response flows — send this
          tenant&rsquo;s <span className="font-semibold text-[#092E3F]">alert, incident and entity data</span> to a
          Large Language Model (LLM). They run only on data a tenant admin has accepted to share here.
        </p>

        <dl className="grid grid-cols-[minmax(200px,auto)_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-[#6b828c]">LLM provider</dt>
          <dd className="font-medium text-[#092E3F]">{DISCLOSURE.provider}</dd>
          <dt className="text-[#6b828c]">Hosting region</dt>
          <dd className="font-medium text-[#092E3F]">{DISCLOSURE.region}</dd>
          <dt className="text-[#6b828c]">How long the provider keeps the data</dt>
          <dd className="font-medium text-[#092E3F]">{DISCLOSURE.retention}</dd>
        </dl>

        <a
          href={DISCLOSURE.termsUrl}
          onClick={e => e.preventDefault()}
          className="inline-flex items-center gap-1.5 text-sm text-[#2A96A8] hover:text-[#1e7d8f] underline underline-offset-2"
        >
          Read the full terms
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* The control. Admins act; everyone else sees why they can't. */}
      <div className="max-w-[760px] mt-4 pt-4 border-t border-gray-200/70">
        {!isAdmin ? (
          <p className="flex items-center gap-2 text-xs text-[#6b828c]">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Read-only. Only a tenant admin for {tenant} can {accepted ? 'revoke' : 'accept'} LLM data processing.
          </p>
        ) : accepted ? (
          <button
            onClick={onRevoke}
            className="px-3 py-1.5 bg-white border border-[var(--stroke)] text-[#092E3F] rounded-[8px] text-sm font-medium hover:bg-[#f6f6f6] transition-colors"
          >
            Revoke LLM data processing
          </button>
        ) : (
          <>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={ack}
                onChange={e => setAck(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#2A96A8] shrink-0 cursor-pointer"
              />
              <span className="text-sm text-[#092E3F] leading-5">
                I have read the disclosure above and accept that this tenant&rsquo;s alert, incident and entity data
                is sent to the LLM provider for processing.
              </span>
            </label>
            <button
              onClick={onAccept}
              disabled={!ack}
              className="mt-3 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium hover:bg-[#1e7d8f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Accept LLM data processing
            </button>
          </>
        )}
      </div>

      {events.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory(v => !v)}
            aria-expanded={showHistory}
            className="inline-flex items-center gap-1 text-xs text-[#6b828c] hover:text-[#092E3F]"
          >
            {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Decision history ({events.length})
          </button>
          {showHistory && (
            <ul className="mt-2 ml-[18px] space-y-1">
              {events.map((e, i) => (
                <li key={i} className="text-xs text-[#092E3F]/70">
                  <span className={`font-medium ${e.kind === 'accepted' ? 'text-[#1e7d8f]' : 'text-[#092E3F]'}`}>
                    {e.kind === 'accepted' ? 'Accepted' : 'Revoked'}
                  </span>{' '}
                  by {e.email} on {formatDateTime(e.at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
          <button onClick={onConfirm} className="px-4 py-2 text-xs font-medium text-white bg-[#c07d1e] rounded-[4px] hover:bg-[#a86c19] transition-colors">
            Revoke
          </button>
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
