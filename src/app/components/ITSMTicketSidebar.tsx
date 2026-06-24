import { useState } from 'react';
import {
  X, Ticket, CheckCircle, AlertCircle, Loader2, ExternalLink,
  Lock, ChevronDown, RotateCcw, Link2, Activity, GitBranch, Zap
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// ─── types ────────────────────────────────────────────────────────────────────

export interface ITSMContext {
  sourceType: 'incident' | 'alert';
  sourceId: string;           // incident number or alert rule ID
  title: string;              // incident type / alert name
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  client: string;
  description?: string;
  entities?: string[];
}

interface ITSMTicketSidebarProps {
  context: ITSMContext;
  onClose: () => void;
}

// ─── platform definitions ─────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  instance?: string;
  connected: boolean;
  accentColor: string;
  bgColor: string;
  ticketPrefix: string;
  labels: { summary: string; description: string; priority: string; queue: string; category: string };
  queueDefault: string;
  Icon: React.FC<{ className?: string }>;
}

const PLATFORMS: Platform[] = [
  {
    id: 'servicenow',
    name: 'ServiceNow',
    instance: 'acme.service-now.com',
    connected: true,
    accentColor: '#81B5A1',
    bgColor: '#f0f7f5',
    ticketPrefix: 'INC',
    labels: { summary: 'Short Description', description: 'Work Notes', priority: 'Priority', queue: 'Assignment Group', category: 'Category' },
    queueDefault: 'SOC — Tier 2',
    Icon: ({ className }) => <Activity className={className} />,
  },
  {
    id: 'jira',
    name: 'Jira',
    instance: 'acme.atlassian.net',
    connected: true,
    accentColor: '#0052CC',
    bgColor: '#e8f0ff',
    ticketPrefix: 'SEC',
    labels: { summary: 'Summary', description: 'Description', priority: 'Priority', queue: 'Component', category: 'Issue Type' },
    queueDefault: 'Security Operations',
    Icon: ({ className }) => <GitBranch className={className} />,
  },
  {
    id: 'xurrent',
    name: 'Xurrent',
    instance: undefined,
    connected: false,
    accentColor: '#FF6B2B',
    bgColor: '#fff4ee',
    ticketPrefix: 'TKT',
    labels: { summary: 'Subject', description: 'Note', priority: 'Impact', queue: 'Team', category: 'Service' },
    queueDefault: 'IT Security',
    Icon: ({ className }) => <Zap className={className} />,
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, Record<string, string>> = {
  servicenow: { Critical: '1 — Critical', High: '2 — High', Medium: '3 — Moderate', Low: '4 — Low' },
  jira:        { Critical: 'Blocker',      High: 'High',     Medium: 'Medium',       Low: 'Low' },
  xurrent:     { Critical: 'Top',          High: 'High',     Medium: 'Medium',       Low: 'Low' },
};

const MOCK_TICKET_IDS: Record<string, string> = {
  servicenow: 'INC0023817',
  jira: 'SEC-491',
  xurrent: 'TKT-1104',
};

function buildDescription(ctx: ITSMContext): string {
  const lines = [
    `Security ${ctx.sourceType === 'incident' ? 'Incident' : 'Alert'}: ${ctx.title}`,
    '',
    `Client: ${ctx.client}`,
    `Reference: ${ctx.sourceId}`,
    `Severity: ${ctx.severity}`,
    ctx.entities?.length ? `Entities: ${ctx.entities.join(', ')}` : '',
    '',
    ctx.description ?? '',
    '',
    'This ticket was automatically created from the Seculyze MSSP Portal.',
  ].filter(l => l !== undefined);
  return lines.join('\n').trim();
}

// ─── component ────────────────────────────────────────────────────────────────

type State = 'form' | 'submitting' | 'success' | 'error';

export default function ITSMTicketSidebar({ context, onClose }: ITSMTicketSidebarProps) {
  const connectedPlatforms = PLATFORMS.filter(p => p.connected);
  const hasConnected = connectedPlatforms.length > 0;

  const [selectedId, setSelectedId] = useState<string>(connectedPlatforms[0]?.id ?? '');
  const [uiState, setUiState] = useState<State>('form');
  const [ticketId, setTicketId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // editable fields
  const [summary, setSummary] = useState(`[${context.severity}] ${context.title} — ${context.client}`);
  const [description, setDescription] = useState(buildDescription(context));
  const [priorityOverride, setPriorityOverride] = useState('');
  const [queueOverride, setQueueOverride] = useState('');
  const [extraNotes, setExtraNotes] = useState('');

  const platform = PLATFORMS.find(p => p.id === selectedId);
  const priority = priorityOverride || (platform ? PRIORITY_MAP[platform.id][context.severity] : '');
  const queue = queueOverride || platform?.queueDefault || '';

  const handleCreate = async () => {
    if (!platform || !platform.connected) return;
    setUiState('submitting');

    await new Promise(res => setTimeout(res, 1800));

    // Simulate occasional error (never on first attempt for demo clarity)
    const id = MOCK_TICKET_IDS[platform.id];
    setTicketId(id);
    setUiState('success');
    toast.success(`${platform.name} ticket ${id} created`);
  };

  const handleRetry = () => {
    setErrorMsg('');
    setUiState('form');
  };

  const selectPlatform = (id: string) => {
    const p = PLATFORMS.find(pl => pl.id === id);
    if (!p?.connected) return;
    setSelectedId(id);
    setPriorityOverride('');
    setQueueOverride('');
    setUiState('form');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-end bg-black/30 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={uiState !== 'submitting' ? onClose : undefined} />

      <div className="relative w-[500px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <Ticket className="w-3.5 h-3.5 text-[#2A96A8]" />
                <p className="text-[#2A96A8] text-xs uppercase tracking-widest">Create ITSM Ticket</p>
              </div>
              <h2 className="text-white text-sm font-semibold leading-snug">{context.title}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-white/50 font-mono">{context.sourceId}</span>
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                <span className={`text-[10px] font-medium ${
                  context.severity === 'Critical' ? 'text-red-300' :
                  context.severity === 'High' ? 'text-orange-300' :
                  context.severity === 'Medium' ? 'text-yellow-300' :
                  'text-green-300'
                }`}>{context.severity}</span>
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                <span className="text-[10px] text-white/50">{context.client}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={uiState === 'submitting'}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5 disabled:opacity-40"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* No integrations configured */}
          {!hasConnected && (
            <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#f6f6f6] flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#6b828c]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#092E3F] mb-1">No ITSM integrations configured</p>
                <p className="text-xs text-[#6b828c] max-w-xs mx-auto">
                  Connect a platform — ServiceNow, Jira, or Xurrent — in Settings to enable one-click ticket creation from incidents and alerts.
                </p>
              </div>
              <div className="w-full space-y-2 mt-2">
                {PLATFORMS.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-[#f6f6f6] rounded-xl opacity-50">
                    <p.Icon className="w-4 h-4 text-[#6b828c]" />
                    <span className="text-sm text-[#092E3F]">{p.name}</span>
                    <span className="ml-auto text-[10px] text-[#6b828c] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Not connected
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded bg-[#092e3f] text-white text-sm hover:bg-[#092e3f]/90 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          )}

          {/* Platform selector + form */}
          {hasConnected && uiState !== 'success' && uiState !== 'error' && (
            <div className="px-6 py-5 space-y-5">

              {/* Platform pills */}
              <div>
                <p className="text-[10px] font-medium text-[#6b828c] uppercase tracking-wide mb-2">Select platform</p>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(p => {
                    const isSelected = selectedId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => selectPlatform(p.id)}
                        disabled={!p.connected}
                        className={`relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-center ${
                          !p.connected
                            ? 'border-[#e5f2f4] bg-[#f6f6f6] opacity-45 cursor-not-allowed'
                            : isSelected
                              ? 'border-[#2A96A8] bg-[#e5f2f4]'
                              : 'border-[#e5f2f4] bg-white hover:border-[#2A96A8]/40'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          !p.connected ? 'bg-[#d6d6d6]' : isSelected ? 'bg-[#092E3F]' : 'bg-[#f6f6f6]'
                        }`}>
                          <p.Icon className={`w-3.5 h-3.5 ${!p.connected ? 'text-[#6b828c]' : isSelected ? 'text-white' : 'text-[#092E3F]'}`} />
                        </div>
                        <span className="text-[11px] font-medium text-[#092E3F] leading-tight">{p.name}</span>
                        {p.connected
                          ? <span className="text-[9px] text-green-600 font-medium">Connected</span>
                          : <span className="text-[9px] text-[#6b828c] flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />Not set up</span>
                        }
                      </button>
                    );
                  })}
                </div>
                {platform?.instance && (
                  <p className="text-[10px] text-[#6b828c] mt-1.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {platform.instance}
                  </p>
                )}
              </div>

              {platform && (
                <>
                  {/* Auto-mapped fields */}
                  <div>
                    <p className="text-[10px] font-medium text-[#6b828c] uppercase tracking-wide mb-2">
                      Mapped fields
                      <span className="ml-1.5 px-1.5 py-0.5 bg-[#e5f2f4] text-[#2A96A8] rounded text-[9px] normal-case font-normal">Auto-filled from {context.sourceType}</span>
                    </p>
                    <div className="space-y-3">

                      {/* Summary */}
                      <div>
                        <label className="block text-[10px] text-[#6b828c] mb-1">{platform.labels.summary} *</label>
                        <input
                          type="text"
                          value={summary}
                          onChange={e => setSummary(e.target.value)}
                          className="w-full px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#2A96A8] text-xs text-[#092E3F] focus:outline-none focus:bg-[#e5f2f4]/40 transition-colors"
                        />
                      </div>

                      {/* Priority + Queue row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-[#6b828c] mb-1">{platform.labels.priority}</label>
                          <div className="relative">
                            <select
                              value={priority}
                              onChange={e => setPriorityOverride(e.target.value)}
                              className="w-full appearance-none px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-xs text-[#092E3F] focus:outline-none pr-7"
                            >
                              {Object.values(PRIORITY_MAP[platform.id]).map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c] pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6b828c] mb-1">{platform.labels.category}</label>
                          <input
                            type="text"
                            value="Security Incident"
                            readOnly
                            className="w-full px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#d6d6d6] text-xs text-[#092E3F]/60"
                          />
                        </div>
                      </div>

                      {/* Queue */}
                      <div>
                        <label className="block text-[10px] text-[#6b828c] mb-1">{platform.labels.queue}</label>
                        <input
                          type="text"
                          value={queue}
                          onChange={e => setQueueOverride(e.target.value)}
                          className="w-full px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-xs text-[#092E3F] focus:outline-none focus:bg-[#e5f2f4]/40 transition-colors"
                        />
                      </div>

                      {/* Client (read-only) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-[#6b828c] mb-1">Customer / Account</label>
                          <input
                            type="text"
                            value={context.client}
                            readOnly
                            className="w-full px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#d6d6d6] text-xs text-[#092E3F]/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6b828c] mb-1">Source Reference</label>
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#d6d6d6]">
                            <span className="text-xs text-[#092E3F]/60 font-mono truncate">{context.sourceId}</span>
                            <Link2 className="w-3 h-3 text-[#2A96A8] shrink-0" />
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-[10px] text-[#6b828c] mb-1">{platform.labels.description}</label>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          rows={6}
                          className="w-full px-3 py-2 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-xs text-[#092E3F] font-mono focus:outline-none focus:bg-[#e5f2f4]/40 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional context */}
                  <div>
                    <label className="block text-[10px] font-medium text-[#6b828c] uppercase tracking-wide mb-2">Additional context</label>
                    <textarea
                      value={extraNotes}
                      onChange={e => setExtraNotes(e.target.value)}
                      placeholder="Optional — any extra context for the analyst assigned to this ticket…"
                      rows={3}
                      className="w-full px-3 py-2.5 bg-[#f6f6f6] border-l-2 border-[#d6d6d6] text-xs text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] transition-colors resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Success state ── */}
          {uiState === 'success' && platform && (
            <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#092E3F] mb-1">Ticket created successfully</p>
                <p className="text-xs text-[#6b828c]">
                  {platform.name} · {platform.instance}
                </p>
              </div>

              {/* Ticket card */}
              <div className="w-full bg-[#f6f6f6] rounded-xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <platform.Icon className="w-4 h-4 text-[#6b828c]" />
                    <span className="text-sm font-mono font-bold text-[#092E3F]">{ticketId}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium">Open</span>
                </div>
                <p className="text-xs text-[#092E3F] leading-relaxed">{summary}</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-[#6b828c]">{platform.labels.priority}</p>
                    <p className="text-[#092E3F] font-medium">{priority}</p>
                  </div>
                  <div>
                    <p className="text-[#6b828c]">{platform.labels.queue}</p>
                    <p className="text-[#092E3F] font-medium">{queue}</p>
                  </div>
                  <div>
                    <p className="text-[#6b828c]">Customer</p>
                    <p className="text-[#092E3F] font-medium">{context.client}</p>
                  </div>
                  <div>
                    <p className="text-[#6b828c]">Source</p>
                    <p className="text-[#092E3F] font-mono">{context.sourceId}</p>
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-[#092E3F] text-white text-xs hover:bg-[#092e3f]/90 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View in {platform.name}
                </button>
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => { setUiState('form'); setTicketId(''); }}
                  className="w-full py-2 rounded border border-[#e5f2f4] text-xs text-[#6b828c] hover:text-[#092E3F] transition-colors"
                >
                  Create another ticket
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 rounded bg-[#2A96A8] text-white text-xs hover:bg-[#237f8e] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ── Error state ── */}
          {uiState === 'error' && platform && (
            <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#092E3F] mb-1">Ticket creation failed</p>
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">{errorMsg}</p>
              </div>
              <div className="w-full space-y-2">
                <button
                  onClick={handleRetry}
                  className="w-full py-2 rounded bg-[#092e3f] text-white text-sm hover:bg-[#092e3f]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
                <button onClick={onClose} className="w-full py-2 rounded border border-[#e5f2f4] text-xs text-[#6b828c] hover:text-[#092E3F] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        {hasConnected && uiState === 'form' && (
          <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#6b828c] rounded text-sm hover:text-[#092E3F] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!platform?.connected || !summary.trim()}
                className="flex-1 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" />
                Create {platform?.name} Ticket
              </button>
            </div>
          </div>
        )}

        {/* Submitting overlay */}
        {uiState === 'submitting' && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-4 z-10">
            <Loader2 className="w-10 h-10 text-[#2A96A8] animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#092E3F]">Creating ticket…</p>
              <p className="text-xs text-[#6b828c] mt-1">Connecting to {platform?.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
