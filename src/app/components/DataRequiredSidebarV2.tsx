import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  X, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  FileText, Loader2, Building2, Code2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── types ───────────────────────────────────────────────────────────────────

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
  kqlQuery?: string;
  queryParams?: QueryParam[];
  targetClients?: string[];
}

interface DataRequiredSidebarV2Props {
  rule: AlertRule;
  onClose: () => void;
  onEnabled?: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Parse the KQL query into segments for rendering.
// Each segment is either plain text or an editable dynamic([...]) slot.
type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'param'; paramName: string; paramId: string };

function parseQuerySegments(query: string, params: QueryParam[]): Segment[] {
  const paramNames = params.map(p => p.paramName);
  const lines = query.split('\n');
  const segments: Segment[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;

    // Check if this is a `let paramName = dynamic([...])` line
    const letMatch = line.match(/^(\s*let\s+)(\w+)(\s*=\s*)dynamic\(\[.*?\]\)(.*)/);
    if (letMatch && paramNames.includes(letMatch[2])) {
      const param = params.find(p => p.paramName === letMatch[2])!;
      // before: `  let vips = `
      segments.push({ kind: 'text', value: letMatch[1] + letMatch[2] + letMatch[3] + 'dynamic([' });
      segments.push({ kind: 'param', paramName: letMatch[2], paramId: param.id });
      segments.push({ kind: 'text', value: '])' + letMatch[4] + (isLast ? '' : '\n') });
    } else {
      segments.push({ kind: 'text', value: line + (isLast ? '' : '\n') });
    }
  }

  return segments;
}

// ─── inline tag input ─────────────────────────────────────────────────────────

function InlineDynamicInput({
  values,
  onChange,
  example,
  paramName,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  example: string;
  paramName: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!trimmed) return;
    // allow comma-separated paste
    const entries = trimmed.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    onChange([...values, ...entries]);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    }
    if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const removeAt = (i: number) => {
    onChange(values.filter((_, idx) => idx !== i));
  };

  return (
    <span
      className="inline-flex flex-wrap items-center gap-1 bg-[#1a4a5e] border border-[#2A96A8]/60 rounded px-1.5 py-0.5 cursor-text align-middle"
      style={{ minWidth: '120px', maxWidth: '320px', verticalAlign: 'middle' }}
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 bg-[#2A96A8]/30 text-[#7dd3c8] text-[11px] font-mono rounded px-1.5 py-0.5"
        >
          '{v}'
          <button
            onClick={e => { e.stopPropagation(); removeAt(i); }}
            className="text-[#7dd3c8]/60 hover:text-red-400 leading-none ml-0.5"
            tabIndex={-1}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        placeholder={values.length === 0 ? `'${example}'` : '+'}
        className="bg-transparent text-[#7dd3c8] text-[11px] font-mono placeholder:text-[#2A96A8]/50 outline-none"
        style={{ width: draft.length > 0 ? `${draft.length + 2}ch` : values.length === 0 ? '160px' : '28px', minWidth: '28px' }}
        aria-label={`Values for ${paramName}`}
      />
    </span>
  );
}

// ─── query line renderer ─────────────────────────────────────────────────────

function QueryRenderer({
  query,
  params,
  values,
  onChangeParam,
}: {
  query: string;
  params: QueryParam[];
  values: Record<string, string[]>;
  onChangeParam: (paramId: string, v: string[]) => void;
}) {
  const segments = parseQuerySegments(query, params);

  return (
    <div className="bg-[#092E3F] rounded-xl p-4 overflow-x-auto">
      <code className="text-[12px] font-mono leading-6 whitespace-pre-wrap break-words">
        {segments.map((seg, i) => {
          if (seg.kind === 'text') {
            // colorize comments and KQL keywords inline
            const parts = seg.value.split(/(\/\/[^\n]*)/).map((part, j) => (
              part.startsWith('//')
                ? <span key={j} className="text-[#6b9aaa]">{part}</span>
                : <span key={j} className="text-[#c8e6ea]">{part}</span>
            ));
            return <span key={i}>{parts}</span>;
          }
          // editable param slot
          const param = params.find(p => p.id === seg.paramId)!;
          const vals = values[seg.paramId] ?? [];
          return (
            <InlineDynamicInput
              key={i}
              values={vals}
              onChange={v => onChangeParam(seg.paramId, v)}
              example={param.example}
              paramName={seg.paramName}
            />
          );
        })}
      </code>
    </div>
  );
}

// ─── per-tenant card ─────────────────────────────────────────────────────────

function TenantQueryCard({
  tenant,
  query,
  params,
  values,
  touched,
  onChangeParam,
  defaultOpen,
}: {
  tenant: string;
  query: string;
  params: QueryParam[];
  values: Record<string, string[]>;
  touched: boolean;
  onChangeParam: (paramId: string, v: string[]) => void;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  const requiredParams = params.filter(p => p.required);
  const isReady = requiredParams.every(p => (values[p.id] ?? []).length > 0);
  const isConfirmed = isReady && touched;
  const isPrefilled = isReady && !touched;
  const totalValues = params.reduce((sum, p) => sum + (values[p.id] ?? []).length, 0);

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      isConfirmed ? 'border-green-200' : isPrefilled ? 'border-amber-200' : 'border-[#e5f2f4]'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
          isConfirmed ? 'bg-green-50/60' : isPrefilled ? 'bg-amber-50/60' : 'bg-[#f6f6f6]'
        }`}
      >
        {isConfirmed
          ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          : <Building2 className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#092E3F]">{tenant}</span>
            {isConfirmed
              ? <span className="text-[10px] text-green-600 font-medium">{totalValues} value{totalValues !== 1 ? 's' : ''} configured</span>
              : isPrefilled
              ? <span className="text-[10px] text-amber-600 font-medium">Pre-filled — review required</span>
              : <span className="text-[10px] text-amber-600 font-medium">Needs configuration</span>
            }
          </div>
          {!expanded && isReady && (
            <p className="text-[10px] text-[#6b828c] truncate mt-0.5">
              {params.filter(p => p.required).map(p => {
                const vals = values[p.id] ?? [];
                return vals.length > 0 ? `${p.paramName}: ${vals.join(', ')}` : null;
              }).filter(Boolean).join(' · ')}
              {isPrefilled && <span className="text-amber-500 ml-1">· click to verify</span>}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-[#6b828c] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#6b828c] shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-3">
          {/* Instruction */}
          <div className="flex items-start gap-2 text-[11px] text-[#6b828c]">
            <Code2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#2A96A8]" />
            <span>
              Edit the highlighted <code className="font-mono bg-[#e5f2f4] px-1 rounded">dynamic([…])</code> values directly in the query below.
              Press <kbd className="font-mono bg-[#f0f0f0] border border-[#d6d6d6] px-1 rounded">Enter</kbd> or <kbd className="font-mono bg-[#f0f0f0] border border-[#d6d6d6] px-1 rounded">,</kbd> to confirm each value.
            </span>
          </div>

          {/* required param hints */}
          <div className="flex flex-wrap gap-2">
            {params.map(p => {
              const filled = (values[p.id] ?? []).length;
              return (
                <span key={p.id} className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                  filled > 0 && touched
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : filled > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : p.required
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-[#e5f2f4] text-[#6b828c] border border-[#d6d6d6]'
                }`}>
                  {filled > 0 && touched && <CheckCircle className="w-2.5 h-2.5" />}
                  {p.paramName}
                  {p.required ? '' : ' (optional)'}
                  {filled > 0 && `: ${filled}`}
                </span>
              );
            })}
          </div>

          <QueryRenderer
            query={query}
            params={params}
            values={values}
            onChangeParam={onChangeParam}
          />
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function DataRequiredSidebarV2({ rule, onClose, onEnabled }: DataRequiredSidebarV2Props) {
  const qParams = rule.queryParams ?? [];
  const tenants = rule.targetClients ?? [];
  const query = rule.kqlQuery ?? '';

  // tenantValues[tenant][paramId] = string[]
  const [tenantValues, setTenantValues] = useState<Record<string, Record<string, string[]>>>(
    Object.fromEntries(tenants.map(t => [
      t,
      Object.fromEntries(qParams.map(p => [p.id, p.example ? [p.example] : []]))
    ]))
  );
  const [touchedTenants, setTouchedTenants] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const requiredParams = qParams.filter(p => p.required);
  const tenantsReady = tenants.filter(t =>
    touchedTenants.has(t) &&
    requiredParams.every(p => (tenantValues[t]?.[p.id] ?? []).length > 0)
  ).length;
  const allReady = tenants.length === 0 || tenantsReady === tenants.length;

  const patchTenantParam = (tenant: string, paramId: string, values: string[]) => {
    setTenantValues(prev => ({
      ...prev,
      [tenant]: { ...prev[tenant], [paramId]: values },
    }));
    setTouchedTenants(prev => new Set(prev).add(tenant));
  };

  const handleDeploy = async () => {
    if (!allReady || deploying) return;
    setDeploying(true);
    await new Promise(res => setTimeout(res, 800));
    toast.success(`Query parameters configured for ${tenants.length} tenant${tenants.length !== 1 ? 's' : ''}`);
    await new Promise(res => setTimeout(res, 600));
    setDeployed(true);
    toast.success(`Rule enabled: ${rule.name}`);
    onEnabled?.();
    setDeploying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[620px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[#2A96A8] text-xs uppercase tracking-widest">Data Required</p>
                <span className="text-[10px] bg-[#2A96A8]/20 text-[#2A96A8] px-2 py-0.5 rounded font-medium">Query Editor</span>
              </div>
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
            style={{ width: tenants.length > 0 ? `${(tenantsReady / tenants.length) * 100}%` : '0%' }}
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
                  <p className="text-sm text-[#092E3F] font-medium mb-1">Fill in the query for each tenant</p>
                  <p className="text-xs text-[#092E3F]/70">
                    Each tenant runs this rule with its own values. Edit the <code className="font-mono bg-amber-100 px-1 rounded">dynamic([…])</code> slots directly inside the query — type a value and press <kbd className="font-mono bg-white border border-amber-200 px-1 rounded text-[10px]">Enter</kbd> to add it.
                  </p>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6b828c]">
                <span className="font-semibold text-[#092E3F]">{tenantsReady}</span> of{' '}
                <span className="font-semibold text-[#092E3F]">{tenants.length}</span> tenants configured
              </p>
              {allReady && !deployed && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> All tenants ready
                </span>
              )}
            </div>

            {/* Tenant query cards */}
            <div className="space-y-3">
              {tenants.map((tenant, i) => (
                <TenantQueryCard
                  key={tenant}
                  tenant={tenant}
                  query={query}
                  params={qParams}
                  values={tenantValues[tenant] ?? {}}
                  touched={touchedTenants.has(tenant)}
                  onChangeParam={(paramId, vals) => patchTenantParam(tenant, paramId, vals)}
                  defaultOpen={i === 0}
                />
              ))}
            </div>

            {/* What happens next */}
            <div className="bg-[#f6f6f6] rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-medium text-[#092E3F] uppercase tracking-wide">What happens when you deploy</p>
              <div className="flex items-start gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                  allReady ? 'bg-green-100 text-green-700' : 'bg-[#e5f2f4] text-[#6b828c]'
                }`}>1</div>
                <div>
                  <p className="text-xs text-[#092E3F]">Per-tenant query variants are generated</p>
                  <p className="text-[10px] text-[#6b828c] mt-0.5">
                    Each tenant's <code className="font-mono">dynamic([…])</code> values are injected into the query before deployment
                  </p>
                </div>
              </div>
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
                  <p className="text-[10px] text-[#6b828c] mt-0.5">Each tenant runs the rule with their own version of the query</p>
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
                    ? `Configure tenants (${tenantsReady}/${tenants.length} ready)`
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
