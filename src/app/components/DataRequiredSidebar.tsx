import { useState, useRef } from 'react';
import {
  X, AlertCircle, Upload, ClipboardList, CheckCircle,
  ChevronDown, ChevronUp, FileText, Loader2, Info, Table2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

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

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  requiredData?: DataRequirement[];
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

// ─── per-requirement state ────────────────────────────────────────────────────

interface ReqState {
  tab: 'upload' | 'paste';
  rawText: string;
  rows: string[][];      // parsed, including header
  fileName: string;
  expanded: boolean;
}

// ─── sub-component: one requirement card ─────────────────────────────────────

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
  const dataRows = state.rows.slice(1);   // skip header row
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
      {/* Card header */}
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

      {/* Expanded body */}
      {state.expanded && (
        <div className="px-4 pb-4 pt-3 bg-white space-y-4">
          <p className="text-xs text-[#092E3F]/70">{req.description}</p>

          {/* Column schema */}
          <div>
            <p className="text-[10px] font-medium text-[#6b828c] uppercase mb-2 tracking-wide">Expected columns</p>
            <div className="flex flex-wrap gap-1.5">
              {req.columns.map(col => (
                <span
                  key={col.name}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    col.required
                      ? 'bg-[#092E3F] text-white'
                      : 'bg-[#e5f2f4] text-[#6b828c]'
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

          {/* Tab switcher */}
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

          {/* Upload tab */}
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

          {/* Paste tab */}
          {state.tab === 'paste' && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Info className="w-3 h-3 text-[#6b828c]" />
                <p className="text-[10px] text-[#6b828c]">
                  First line is treated as the header row
                </p>
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

          {/* Preview table */}
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
                        <th key={i} className="px-2.5 py-1.5 text-left text-white font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-[#f6f6f6]'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2.5 py-1.5 text-[#092E3F] whitespace-nowrap">
                            {cell}
                          </td>
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

// ─── main component ───────────────────────────────────────────────────────────

export default function DataRequiredSidebar({ rule, onClose, onEnabled }: DataRequiredSidebarProps) {
  const reqs = rule.requiredData ?? [];

  const [reqStates, setReqStates] = useState<Record<string, ReqState>>(
    Object.fromEntries(
      reqs.map((r, i) => [r.id, { tab: 'upload' as const, rawText: '', rows: [], fileName: '', expanded: i === 0 }])
    )
  );
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const readyCount = reqs.filter(r => (reqStates[r.id]?.rows.length ?? 0) > 1).length;
  const allReady = readyCount === reqs.length;

  const patchReq = (id: string, patch: Partial<ReqState>) => {
    setReqStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleDeploy = async () => {
    if (!allReady || deploying) return;
    setDeploying(true);

    // Simulate watchlist creation + rule deployment
    await new Promise(res => setTimeout(res, 800));
    reqs.forEach(r => {
      const rows = (reqStates[r.id]?.rows.length ?? 1) - 1;
      toast.success(`Watchlist ${r.sentinelWatchlist} created (${rows} entries)`);
    });

    await new Promise(res => setTimeout(res, 600));
    setDeployed(true);
    toast.success(`Rule enabled: ${rule.name}`);
    onEnabled?.();
    setDeploying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[540px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
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
            style={{ width: reqs.length > 0 ? `${(readyCount / reqs.length) * 100}%` : '0%' }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Explanation banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#092E3F] font-medium mb-1">
                    Customer-specific data required
                  </p>
                  <p className="text-xs text-[#092E3F]/70">
                    This rule references Sentinel watchlists that must be populated with your organisation's data before deployment. Upload or paste each dataset below — they will be created as watchlists in your workspace automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Progress status */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6b828c]">
                <span className="font-semibold text-[#092E3F]">{readyCount}</span> of{' '}
                <span className="font-semibold text-[#092E3F]">{reqs.length}</span> datasets provided
              </p>
              {allReady && !deployed && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> All data ready
                </span>
              )}
            </div>

            {/* Requirement cards */}
            <div className="space-y-3">
              {reqs.map(req => (
                <RequirementCard
                  key={req.id}
                  req={req}
                  state={reqStates[req.id]}
                  onChange={patch => patchReq(req.id, patch)}
                />
              ))}
            </div>

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
                  <p className="text-xs text-[#092E3F]">Alert rule is enabled in Sentinel</p>
                  <p className="text-[10px] text-[#6b828c] mt-0.5">Starts alerting immediately using your watchlist data</p>
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
                    ? `Provide data (${readyCount}/${reqs.length} ready)`
                    : 'Upload Data & Enable Rule'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
