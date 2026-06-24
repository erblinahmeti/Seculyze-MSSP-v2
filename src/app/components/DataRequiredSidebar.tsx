import { useState, useRef } from 'react';
import {
  X, AlertCircle, Upload, ClipboardList, CheckCircle,
  ChevronDown, ChevronUp, FileText, Loader2, Info, Table2,
  Code2, Plus, Trash2, Users, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── types ───────────────────────────────────────────────────────────────────

export interface WatchlistColumn {
  name: string;
  required: boolean;
  example: string;
}

export interface DataRequirement {
  id: string;
  name: string;
  sentinelWatchlist: string;
  description: string;
  columns: WatchlistColumn[];
}

export interface QueryParam {
  id: string;
  name: string;
  paramName: string;
  description: string;
  type: 'string-array' | 'string';
  example: string;
  required: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  kqlQuery?: string;
  requiredData?: DataRequirement[];
  queryParams?: QueryParam[];
  targetClients?: string[];
}

interface DataRequiredSidebarProps {
  rule: AlertRule;
  onClose: () => void;
  onEnabled?: () => void;
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSV(raw: string): string[][] {
  return raw
    .trim()
    .split('\n')
    .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
    .filter(row => row.some(cell => cell.length > 0));
}

// ─── per-watchlist-requirement state ─────────────────────────────────────────

interface ReqState {
  tab: 'upload' | 'paste';
  rawText: string;
  rows: string[][];
  fileName: string;
  expanded: boolean;
}

// ─── per-tenant query param values ───────────────────────────────────────────
// tenantParamValues[tenantName][paramId] = string[]
type TenantParamValues = Record<string, Record<string, string[]>>;

// ─── sub-component: watchlist requirement card ───────────────────────────────

function RequirementCard({
  req,
  state,
  onChange,
}: {
  req: DataRequirement;
  state: ReqState;
  onChange: (patch: Partial<ReqState>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dataRows = state.rows.slice(1);
  const isReady = dataRows.length > 0;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      onChange({ rawText: text, rows: parsed, fileName: file.name, tab: 'upload' });
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    const parsed = parseCSV(text);
    onChange({ rawText: text, rows: parsed, fileName: '' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      isReady ? 'border-green-200' : 'border-[#e5f2f4]'
    }`}>
      <button
        onClick={() => onChange({ expanded: !state.expanded })}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
          isReady ? 'bg-green-50/60' : 'bg-[#f6f6f6]'
        }`}
      >
        {isReady
          ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          : <ClipboardList className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#092E3F]">{req.name}</span>
            {isReady
              ? <span className="text-[10px] text-green-600 font-medium">{dataRows.length} rows ready</span>
              : <span className="text-[10px] text-amber-600 font-medium">Required</span>
            }
          </div>
          <span className="text-[10px] text-[#6b828c]">Watchlist: {req.sentinelWatchlist}</span>
        </div>
        {state.expanded
          ? <ChevronUp className="w-4 h-4 text-[#6b828c] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
      </button>

      {state.expanded && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-4">
          <p className="text-xs text-[#092E3F]/70">{req.description}</p>

          <div>
            <p className="text-[10px] font-medium text-[#6b828c] uppercase mb-2 tracking-wide">Expected columns</p>
            <div className="flex flex-wrap gap-1.5">
              {req.columns.map(col => (
                <span
                  key={col.name}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    col.required ? 'bg-[#092E3F] text-white' : 'bg-[#e5f2f4] text-[#6b828c]'
                  }`}
                  title={`Example: ${col.example}`}
                >
                  {col.name}{col.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-[#6b828c] mt-1.5">
              Example row: {req.columns.map(c => c.example).join(', ')}
            </p>
          </div>

          <div className="flex rounded-lg border border-[#e5f2f4] overflow-hidden">
            {(['upload', 'paste'] as const).map(t => (
              <button
                key={t}
                onClick={() => onChange({ tab: t })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  state.tab === t
                    ? 'bg-[#092E3F] text-white'
                    : 'bg-white text-[#6b828c] hover:bg-[#f6f6f6]'
                }`}
              >
                {t === 'upload' ? 'Upload CSV' : 'Paste Values'}
              </button>
            ))}
          </div>

          {state.tab === 'upload' && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[#d6d6d6] rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#2A96A8] hover:bg-[#e5f2f4]/30 transition-all"
            >
              <Upload className="w-6 h-6 text-[#6b828c]" />
              {state.fileName
                ? <p className="text-sm text-[#092E3F] font-medium">{state.fileName}</p>
                : <>
                    <p className="text-sm text-[#092E3F]">Drop CSV here or click to browse</p>
                    <p className="text-[10px] text-[#6b828c]">.csv or .txt · UTF-8 with header row</p>
                  </>
              }
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>
          )}

          {state.tab === 'paste' && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Info className="w-3 h-3 text-[#6b828c]" />
                <p className="text-[10px] text-[#6b828c]">First line is treated as the header row</p>
              </div>
              <textarea
                value={state.rawText}
                onChange={e => handlePaste(e.target.value)}
                placeholder={`${req.columns.map(c => c.name).join(',')}\n${req.columns.map(c => c.example).join(',')}`}
                className="w-full px-3 py-2.5 bg-[#f6f6f6] border-l-2 border-[#6b828c] text-xs text-[#092E3F] font-mono placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] transition-all resize-none"
                rows={5}
              />
            </div>
          )}

          {state.rows.length > 1 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Table2 className="w-3.5 h-3.5 text-[#2A96A8]" />
                <p className="text-[10px] font-medium text-[#092E3F] uppercase tracking-wide">
                  Preview — {dataRows.length} row{dataRows.length !== 1 ? 's' : ''} detected
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#e5f2f4]">
                <table className="min-w-full text-[10px]">
                  <thead>
                    <tr className="bg-[#092E3F]">
                      {state.rows[0].map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 text-left text-white font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#f6f6f6]'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2.5 py-1.5 text-[#092E3F] whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                    {dataRows.length > 3 && (
                      <tr>
                        <td colSpan={state.rows[0].length} className="px-2.5 py-1.5 text-[#6b828c] text-center">
                          +{dataRows.length - 3} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── sub-component: per-tenant query param editor ────────────────────────────

function TenantParamCard({
  tenant,
  params,
  values,
  onChange,
}: {
  tenant: string;
  params: QueryParam[];
  values: Record<string, string[]>;
  onChange: (paramId: string, newValues: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const requiredParams = params.filter(p => p.required);
  const isReady = requiredParams.every(p => (values[p.id] ?? []).filter(v => v.trim()).length > 0);
  const totalValues = params.reduce((sum, p) => sum + (values[p.id] ?? []).filter(v => v.trim()).length, 0);

  const addValue = (paramId: string) => {
    const current = values[paramId] ?? [];
    onChange(paramId, [...current, '']);
  };

  const updateValue = (paramId: string, index: number, val: string) => {
    const current = [...(values[paramId] ?? [])];
    current[index] = val;
    onChange(paramId, current);
  };

  const removeValue = (paramId: string, index: number) => {
    const current = [...(values[paramId] ?? [])];
    current.splice(index, 1);
    onChange(paramId, current);
  };

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      isReady ? 'border-green-200' : 'border-[#e5f2f4]'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
          isReady ? 'bg-green-50/60' : 'bg-[#f6f6f6]'
        }`}
      >
        {isReady
          ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          : <Building2 className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#092E3F]">{tenant}</span>
            {isReady
              ? <span className="text-[10px] text-green-600 font-medium">{totalValues} value{totalValues !== 1 ? 's' : ''} set</span>
              : <span className="text-[10px] text-amber-600 font-medium">Needs configuration</span>
            }
          </div>
          {!expanded && isReady && (
            <p className="text-[10px] text-[#6b828c] truncate mt-0.5">
              {params.filter(p => p.required).map(p => {
                const vals = (values[p.id] ?? []).filter(v => v.trim());
                return vals.length > 0 ? `${p.paramName}: ${vals.join(', ')}` : null;
              }).filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-[#6b828c] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-4">
          {params.map(param => {
            const currentValues = values[param.id] ?? [];
            const filled = currentValues.filter(v => v.trim());
            return (
              <div key={param.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono bg-[#092E3F]/8 text-[#092E3F] px-1.5 py-0.5 rounded">
                      {param.paramName}
                    </code>
                    {param.required
                      ? <span className="text-[10px] text-amber-600 font-medium">Required</span>
                      : <span className="text-[10px] text-[#6b828c]">Optional</span>
                    }
                    {filled.length > 0 && (
                      <span className="text-[10px] text-green-600 font-medium">{filled.length} value{filled.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[#6b828c] mb-2">{param.description}</p>

                <div className="space-y-1.5">
                  {currentValues.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={val}
                        onChange={e => updateValue(param.id, idx, e.target.value)}
                        placeholder={param.example}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-[#f6f6f6] border border-[#e5f2f4] rounded-lg text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8] transition-colors font-mono"
                      />
                      <button
                        onClick={() => removeValue(param.id, idx)}
                        className="p-1.5 text-[#6b828c] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addValue(param.id)}
                    className="flex items-center gap-1.5 text-[11px] text-[#2A96A8] hover:text-[#092E3F] transition-colors py-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add {currentValues.length === 0 ? 'value' : 'another'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── KQL query preview ────────────────────────────────────────────────────────

function KqlPreview({ query, params, tenantValues, selectedTenant }: {
  query: string;
  params: QueryParam[];
  tenantValues: Record<string, string[]>;
  selectedTenant: string | null;
}) {
  const [open, setOpen] = useState(false);

  const interpolated = selectedTenant
    ? params.reduce((q, p) => {
        const vals = (tenantValues[p.id] ?? []).filter(v => v.trim());
        const replacement = vals.length > 0
          ? `dynamic([${vals.map(v => `'${v}'`).join(',')}])`
          : `dynamic([])`;
        return q.replace(
          new RegExp(`dynamic\\(\\[.*?\\]\\)`, 'g'),
          (_match, offset) => {
            const linesBefore = q.slice(0, offset).split('\n');
            const lastLine = linesBefore[linesBefore.length - 1];
            if (lastLine.includes(`let ${p.paramName}`)) return replacement;
            return _match;
          }
        );
      }, query)
    : query;

  // Simple highlight: mark let lines
  const lines = interpolated.split('\n');

  return (
    <div className="rounded-xl border border-[#e5f2f4] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between bg-[#f6f6f6] hover:bg-[#eef7f8] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-[#2A96A8]" />
          <span className="text-[11px] font-medium text-[#092E3F]">KQL Query Preview</span>
          {selectedTenant && (
            <span className="text-[10px] text-[#6b828c]">— showing values for {selectedTenant}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#6b828c]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />}
      </button>
      {open && (
        <div className="bg-[#092E3F] px-4 py-3 overflow-x-auto">
          <pre className="text-[11px] font-mono leading-5">
            {lines.map((line, i) => {
              const isLetLine = line.trim().startsWith('let ');
              const isComment = line.trim().startsWith('//');
              return (
                <div key={i} className={
                  isComment ? 'text-[#6b9aaa]' :
                  isLetLine ? 'text-[#7dd3c8]' :
                  'text-[#c8e6ea]'
                }>
                  {line || ' '}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DataRequiredSidebar({ rule, onClose, onEnabled }: DataRequiredSidebarProps) {
  const reqs = rule.requiredData ?? [];
  const qParams = rule.queryParams ?? [];
  const tenants = rule.targetClients ?? [];
  const hasQueryParams = qParams.length > 0;

  // Watchlist state
  const [reqStates, setReqStates] = useState<Record<string, ReqState>>(
    Object.fromEntries(
      reqs.map((r, i) => [r.id, { tab: 'upload' as const, rawText: '', rows: [], fileName: '', expanded: i === 0 }])
    )
  );

  // Per-tenant query param state: tenantParamValues[tenant][paramId] = string[]
  const [tenantParamValues, setTenantParamValues] = useState<TenantParamValues>(
    Object.fromEntries(tenants.map(t => [t, {}]))
  );

  const [previewTenant, setPreviewTenant] = useState<string | null>(tenants[0] ?? null);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const readyWatchlists = reqs.filter(r => (reqStates[r.id]?.rows.length ?? 0) > 1).length;
  const allWatchlistsReady = reqs.length === 0 || readyWatchlists === reqs.length;

  const requiredQParams = qParams.filter(p => p.required);
  const tenantsReady = tenants.filter(t =>
    requiredQParams.every(p => (tenantParamValues[t]?.[p.id] ?? []).filter(v => v.trim()).length > 0)
  ).length;
  const allTenantsReady = tenants.length === 0 || tenantsReady === tenants.length;

  const allReady = allWatchlistsReady && (hasQueryParams ? allTenantsReady : true);

  const totalSteps = reqs.length + (hasQueryParams ? tenants.length : 0);
  const completedSteps = readyWatchlists + (hasQueryParams ? tenantsReady : 0);

  const patchReq = (id: string, patch: Partial<ReqState>) => {
    setReqStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const patchTenantParam = (tenant: string, paramId: string, values: string[]) => {
    setTenantParamValues(prev => ({
      ...prev,
      [tenant]: { ...prev[tenant], [paramId]: values },
    }));
  };

  const handleDeploy = async () => {
    if (!allReady || deploying) return;
    setDeploying(true);

    await new Promise(res => setTimeout(res, 800));
    reqs.forEach(r => {
      const rows = (reqStates[r.id]?.rows.length ?? 1) - 1;
      toast.success(`Watchlist ${r.sentinelWatchlist} created (${rows} entries)`);
    });
    if (hasQueryParams) {
      toast.success(`Query parameters configured for ${tenants.length} tenant${tenants.length !== 1 ? 's' : ''}`);
    }

    await new Promise(res => setTimeout(res, 600));
    setDeployed(true);
    toast.success(`Rule enabled: ${rule.name}`);
    onEnabled?.();
    setDeploying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[560px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Data Required</p>
              <h2 className="text-white text-base font-semibold leading-snug">{rule.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#e5f2f4] shrink-0">
          <div
            className="h-full bg-[#2A96A8] transition-all duration-500"
            style={{ width: totalSteps > 0 ? `${(completedSteps / totalSteps) * 100}%` : '0%' }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">Customer-specific data required</p>
                  <p className="text-xs text-[#092E3F]/70">
                    {hasQueryParams
                      ? 'This rule contains query parameters that must be configured per tenant before deployment. Each tenant can have different values — e.g. different VIP email lists.'
                      : 'This rule references Sentinel watchlists that must be populated with your organisation\'s data before deployment.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Progress status */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6b828c]">
                <span className="font-semibold text-[#092E3F]">{completedSteps}</span> of{' '}
                <span className="font-semibold text-[#092E3F]">{totalSteps}</span> configurations complete
              </p>
              {allReady && !deployed && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> All data ready
                </span>
              )}
            </div>

            {/* Watchlist requirements */}
            {reqs.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5 text-[#2A96A8]" />
                  Sentinel Watchlists
                </p>
                {reqs.map(req => (
                  <RequirementCard
                    key={req.id}
                    req={req}
                    state={reqStates[req.id]}
                    onChange={patch => patchReq(req.id, patch)}
                  />
                ))}
              </div>
            )}

            {/* Query params section */}
            {hasQueryParams && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[#2A96A8]" />
                    Per-Tenant Query Parameters
                  </p>
                  <span className="text-[10px] text-[#6b828c]">
                    {tenantsReady}/{tenants.length} tenants configured
                  </span>
                </div>

                {/* Parameter legend */}
                <div className="bg-[#f6f6f6] rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-medium text-[#092E3F] uppercase tracking-wide mb-1">Parameters in this query</p>
                  {qParams.map(p => (
                    <div key={p.id} className="flex items-start gap-2">
                      <code className="text-[11px] font-mono bg-white border border-[#e5f2f4] text-[#092E3F] px-1.5 py-0.5 rounded shrink-0">
                        {p.paramName}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#092E3F]">{p.name}</span>
                          {p.required
                            ? <span className="text-[10px] text-amber-600">· required</span>
                            : <span className="text-[10px] text-[#6b828c]">· optional</span>
                          }
                        </div>
                        <p className="text-[10px] text-[#6b828c]">{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* KQL preview */}
                {rule.kqlQuery && (
                  <div className="space-y-2">
                    {tenants.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6b828c]">Preview for:</span>
                        <div className="flex gap-1 flex-wrap">
                          {tenants.map(t => (
                            <button
                              key={t}
                              onClick={() => setPreviewTenant(t)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                previewTenant === t
                                  ? 'bg-[#092E3F] text-white'
                                  : 'bg-[#e5f2f4] text-[#6b828c] hover:bg-[#092E3F]/10'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <KqlPreview
                      query={rule.kqlQuery}
                      params={qParams}
                      tenantValues={previewTenant ? tenantParamValues[previewTenant] ?? {} : {}}
                      selectedTenant={previewTenant}
                    />
                  </div>
                )}

                {/* Per-tenant cards */}
                <div className="space-y-2">
                  {tenants.map(tenant => (
                    <TenantParamCard
                      key={tenant}
                      tenant={tenant}
                      params={qParams}
                      values={tenantParamValues[tenant] ?? {}}
                      onChange={(paramId, vals) => {
                        patchTenantParam(tenant, paramId, vals);
                        setPreviewTenant(tenant);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="bg-[#f6f6f6] rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-medium text-[#092E3F] uppercase tracking-wide">What happens when you deploy</p>
              {reqs.map((req, i) => (
                <div key={req.id} className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    (reqStates[req.id]?.rows.length ?? 0) > 1 ? 'bg-green-100 text-green-700' : 'bg-[#e5f2f4] text-[#6b828c]'
                  }`}>{i + 1}</div>
                  <div>
                    <p className="text-xs text-[#092E3F]">
                      Watchlist <span className="font-mono font-medium">{req.sentinelWatchlist}</span> is created in your Sentinel workspace
                    </p>
                    <p className="text-[10px] text-[#6b828c] mt-0.5">
                      {(reqStates[req.id]?.rows.length ?? 1) - 1 > 0
                        ? `${(reqStates[req.id]?.rows.length ?? 1) - 1} entries ready to upload`
                        : 'Awaiting data'}
                    </p>
                  </div>
                </div>
              ))}
              {hasQueryParams && (
                <div className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                    allTenantsReady ? 'bg-green-100 text-green-700' : 'bg-[#e5f2f4] text-[#6b828c]'
                  }`}>{reqs.length + 1}</div>
                  <div>
                    <p className="text-xs text-[#092E3F]">
                      Query parameters are injected per-tenant before deployment
                    </p>
                    <p className="text-[10px] text-[#6b828c] mt-0.5">
                      {allTenantsReady
                        ? `All ${tenants.length} tenants configured`
                        : `${tenantsReady}/${tenants.length} tenants ready`}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  deployed ? 'bg-green-100' : 'bg-[#e5f2f4]'
                }`}>
                  {deployed
                    ? <CheckCircle className="w-3 h-3 text-green-600" />
                    : <FileText className="w-3 h-3 text-[#6b828c]" />
                  }
                </div>
                <div>
                  <p className="text-xs text-[#092E3F]">Alert rule is enabled across all tenants</p>
                  <p className="text-[10px] text-[#6b828c] mt-0.5">Each tenant runs the query with their own parameter values</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0">
          {deployed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Rule deployed and enabled</span>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#6b828c] rounded text-sm hover:text-[#092E3F] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeploy}
                disabled={!allReady || deploying}
                className="flex-1 py-2 bg-[#092e3f] text-white rounded text-sm hover:bg-[#092e3f]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deploying && <Loader2 className="w-4 h-4 animate-spin" />}
                {deploying
                  ? 'Deploying…'
                  : !allReady
                    ? `Configure data (${completedSteps}/${totalSteps} ready)`
                    : 'Deploy & Enable Rule'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
