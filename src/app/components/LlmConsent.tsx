import { useEffect, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { ExternalLink, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import Switch from './Switch';
import Pagination from './Pagination';
import { TABLE_SHELL, GRID_SCROLL, GRID_HEAD, GRID_ROW, GRID_BODY } from './tableStyles';
import { useWorkspace } from './WorkspaceContext';
import { TENANTS } from './tenants';
import { formatDateTime } from './dates';

// ─── LLM data processing ─────────────────────────────────────────────────────
//
// A plain on/off per tenant for the AI features that send data to an LLM —
// Agentic SOC triage and response agents, and the agent steps in Automated
// Response flows. On by default: the models run on Azure OpenAI, inside the
// Azure services the DPA already covers, so there is no separate agreement to
// collect — only a switch for a tenant that wants AI features off.
//
// Every flip is recorded with who did it and when. The latest shows beside the
// switch; a tenant's row expands (like the Data Collection table) to its full
// decision history. Only tenant admins can flip it; everyone else sees it read-only.

// Placeholders until product/legal confirm the production values.
const PROVIDER = { name: 'Azure OpenAI', region: 'Denmark Central', termsUrl: '#' };

// The signed-in user in the sidebar.
const CURRENT_USER_EMAIL = 'john.doe@seculyze.com';

export type Role = 'admin' | 'analyst';

interface SwitchEvent {
  on: boolean;
  by: string; // email
  at: string; // ISO
}

/** Per tenant, newest first. No events = on, the default. */
export type ConsentLog = Record<string, SwitchEvent[]>;

const ev = (on: boolean, by: string, at: string): SwitchEvent => ({ on, by, at });

export const INITIAL_CONSENT: ConsentLog = {
  Puma: [
    ev(false, 'kristian@seculyze.com', '2026-11-18T15:03:00'),
    ev(true, 'kristian@seculyze.com', '2026-11-18T14:58:00'),
    ev(false, 'kristian@seculyze.com', '2026-11-18T12:52:00'),
  ],
  Converse: [ev(false, 'lena.hoff@seculyze.com', '2026-11-12T09:40:00')],
  Fila:     [ev(false, 'sam.ortiz@seculyze.com', '2026-10-29T13:15:00')],
};

export const isOn = (log: ConsentLog, tenant: string) => log[tenant]?.[0]?.on ?? true;

export default function LlmConsentSection({ log, setLog, role, setRole }: {
  log: ConsentLog;
  setLog: React.Dispatch<React.SetStateAction<ConsentLog>>;
  role: Role;
  setRole: (r: Role) => void;
}) {
  const ws = useWorkspace();
  const tenants = ws.single ? [ws.tenant!] : TENANTS;
  const isAdmin = role === 'admin';
  const onCount = tenants.filter(t => isOn(log, t)).length;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [ws.single, ws.tenant]);
  const paged = tenants.slice((page - 1) * pageSize, page * pageSize);
  const [expanded, setExpanded] = useState<string | null>(null);

  const set = (tenant: string, on: boolean) =>
    setLog(prev => ({ ...prev, [tenant]: [ev(on, CURRENT_USER_EMAIL, new Date().toISOString()), ...(prev[tenant] ?? [])] }));

  const flip = (tenant: string) => {
    const next = !isOn(log, tenant);
    set(tenant, next);
    toast.success(`AI features turned ${next ? 'on' : 'off'} for ${tenant}`, {
      action: { label: 'Undo', onClick: () => set(tenant, !next) },
      duration: 6000,
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#092E3F]">LLM data processing</h2>
        {/* Prototype only — lets a session see the read-only view without a second login. */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#092E3F]/45">Preview as</span>
          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px]">
            <Seg active={isAdmin} onClick={() => setRole('admin')}>Tenant admin</Seg>
            <Seg active={!isAdmin} onClick={() => setRole('analyst')}>Analyst</Seg>
          </div>
        </div>
      </div>

      <p className="max-w-[820px] text-sm leading-6 text-[#092E3F]/75">
        To triage alerts, recommend responses and run automated responses, Seculyze&rsquo;s AI features — the
        Agentic SOC triage and response agents, and the agent steps in Automated Response flows — send a
        tenant&rsquo;s <span className="font-semibold text-[#092E3F]">alert, incident and entity data</span> to{' '}
        {PROVIDER.name} ({PROVIDER.region}). On by default.
      </p>
      <a
        href={PROVIDER.termsUrl}
        onClick={e => e.preventDefault()}
        className="inline-flex items-center gap-1.5 mt-1 mb-4 text-sm text-[#2A96A8] hover:text-[#1e7d8f] underline underline-offset-2"
      >
        Read the full terms
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      {!isAdmin && (
        <p className="flex items-center gap-2 mb-3 text-xs text-[#6b828c]">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Read-only. Only a tenant admin can turn AI features on or off.
        </p>
      )}

      {ws.single ? (
        // One tenant: just its switch and who last changed it.
        <div className="max-w-[560px] px-4 py-3 border border-[var(--stroke)] rounded-[8px]">
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm font-medium text-[#092E3F]">AI features for {ws.tenant}</span>
            <Switch
              on={isOn(log, ws.tenant!)}
              onChange={() => flip(ws.tenant!)}
              disabled={!isAdmin}
              title={`AI features for ${ws.tenant}`}
              label={isOn(log, ws.tenant!) ? 'On' : 'Off'}
            />
          </div>
          <LastChange e={log[ws.tenant!]?.[0]} className="mt-1" />
          {/* The line above already says "never changed", so an empty history
              would only repeat it. */}
          {(log[ws.tenant!]?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <DecisionHistory events={log[ws.tenant!]} />
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-[#092E3F]/70 mb-3">
            <span className="font-medium text-[#092E3F]">{onCount} of {tenants.length}</span> tenants have AI features on.
          </p>
          <div className={TABLE_SHELL}>
            <div className={GRID_SCROLL}>
              <div className={`grid ${COLS} gap-3 ${GRID_HEAD}`}>
                <div>Tenant</div><div>AI features</div><div>Last changed by</div><div>When</div>
              </div>
              <div className={GRID_BODY}>
                {paged.map(t => {
                  const last = log[t]?.[0];
                  const on = isOn(log, t);
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
                        <Switch on={on} onChange={() => flip(t)} disabled={!isAdmin} title={`AI features for ${t}`} label={on ? 'On' : 'Off'} />
                      </div>
                      <div className="truncate text-[#092E3F]/80">{last ? last.by : <span className="text-[#092E3F]/35">—</span>}</div>
                      <div className="text-[#092E3F]/80">{last ? formatDateTime(last.at) : <span className="text-[#092E3F]/35">—</span>}</div>
                    </div>
                    {open && (
                      <div className="px-5 pl-[42px] py-4 bg-[#fafbfb] border-t border-gray-100">
                        <DecisionHistory events={log[t] ?? []} defaultOpen />
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={tenants.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}

const COLS = 'grid-cols-[minmax(180px,1.4fr)_minmax(120px,0.8fr)_minmax(180px,1fr)_minmax(150px,1fr)]';

function LastChange({ e, className = '' }: { e: SwitchEvent | undefined; className?: string }) {
  return (
    <p className={`text-xs text-[#6b828c] ${className}`}>
      {e
        ? <>Turned {e.on ? 'on' : 'off'} by <span className="text-[#092E3F]">{e.by}</span> on {formatDateTime(e.at)}</>
        : 'On by default — never changed.'}
    </p>
  );
}

/** Every on/off change for one tenant, newest first, folded under a count. */
function DecisionHistory({ events, defaultOpen = false }: { events: SwitchEvent[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (events.length === 0) return <p className="text-xs text-[#6b828c]">Decision history — on by default, never changed.</p>;
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs text-[#6b828c] hover:text-[#092E3F]"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Decision history ({events.length})
      </button>
      {open && (
        <ul className="mt-2 ml-[18px] list-disc space-y-0.5 text-xs text-[#092E3F]/70 marker:text-[#092E3F]/50">
          {events.map((e, i) => (
            <li key={i}>
              Turned {e.on ? 'on' : 'off'} by {e.by} on {formatDateTime(e.at)}
            </li>
          ))}
        </ul>
      )}
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
