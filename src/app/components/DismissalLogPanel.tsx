import { X, BellOff, RotateCcw, Globe, Users, Clock, Search } from 'lucide-react';
import { useState } from 'react';
import { type RuleDismissals } from './DismissRuleModal';

interface LogEntry {
  ruleId: string;
  ruleName: string;
  entryIndex: number;
  by: string;
  at: string;
  scope: 'global' | 'per-tenant';
  tenants?: string[];
  restoredBy?: string;
  restoredAt?: string;
}

interface DismissalLogPanelProps {
  allDismissals: Record<string, RuleDismissals>;
  ruleNames: Record<string, string>;
  onRestore: (ruleId: string, scope: 'global' | 'per-tenant', tenants?: string[]) => void;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DismissalLogPanel({ allDismissals, ruleNames, onRestore, onClose }: DismissalLogPanelProps) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'restored'>('all');

  // Flatten all dismissal entries into a single sorted list
  const entries: LogEntry[] = Object.entries(allDismissals)
    .flatMap(([ruleId, rd]) =>
      rd.entries.map((e, i) => ({
        ruleId,
        ruleName: ruleNames[ruleId] ?? ruleId,
        entryIndex: i,
        by: e.by,
        at: e.at,
        scope: e.scope,
        tenants: e.tenants,
        restoredBy: e.restoredBy,
        restoredAt: e.restoredAt,
      }))
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const filtered = entries.filter(e => {
    const matchesSearch =
      e.ruleName.toLowerCase().includes(search.toLowerCase()) ||
      e.by.toLowerCase().includes(search.toLowerCase()) ||
      (e.restoredBy ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && !e.restoredBy) ||
      (filterActive === 'restored' && !!e.restoredBy);
    return matchesSearch && matchesFilter;
  });

  const activeCount = entries.filter(e => !e.restoredBy).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-[480px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#2A96A8]" />
                <p className="text-[#2A96A8] text-xs uppercase tracking-widest">Dismissal Log</p>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400/80 text-[#092E3F] rounded-full">
                    {activeCount} active
                  </span>
                )}
              </div>
              <h2 className="text-white text-base font-semibold">All Recommendation Dismissals</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Search + filter tabs */}
        <div className="px-5 pt-4 pb-3 border-b border-[#e5f2f4] shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by rule or user…"
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#f6f6f6] border border-[#e5f2f4] rounded-lg text-[#092E3F] placeholder:text-[#d6d6d6] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'restored'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors capitalize ${
                  filterActive === f
                    ? 'bg-[#092E3F] text-white'
                    : 'text-[#6b828c] hover:bg-[#f6f6f6]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-10 h-10 text-[#6b828c] mx-auto mb-3 opacity-30" />
              <p className="text-sm text-[#6b828c]">
                {entries.length === 0 ? 'No dismissals recorded yet' : 'No results match your search'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {filtered.map((entry, i) => (
                <div
                  key={`${entry.ruleId}-${entry.entryIndex}-${i}`}
                  className={`px-5 py-4 transition-colors ${entry.restoredBy ? 'opacity-60' : 'hover:bg-[#f8fdfe]'}`}
                >
                  {/* Rule name + status pill */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-[#092E3F] leading-tight flex-1">{entry.ruleName}</p>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      entry.restoredBy
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.restoredBy ? 'Restored' : 'Dismissed'}
                    </span>
                  </div>

                  {/* Dismissal detail */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-[#6b828c]">
                      <BellOff className="w-3 h-3 shrink-0 text-red-400" />
                      <span>
                        Dismissed by <span className="font-medium text-[#092E3F]">{entry.by}</span>
                        {' · '}
                        <span title={formatTimestamp(entry.at)}>{timeAgo(entry.at)}</span>
                        {' · '}
                        {formatTimestamp(entry.at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#6b828c]">
                      {entry.scope === 'global' ? (
                        <>
                          <Globe className="w-3 h-3 shrink-0" />
                          <span>Scope: <span className="font-medium text-[#092E3F]">All tenants (global)</span></span>
                        </>
                      ) : (
                        <>
                          <Users className="w-3 h-3 shrink-0" />
                          <span>
                            Scope: <span className="font-medium text-[#092E3F]">{entry.tenants?.join(', ')}</span>
                          </span>
                        </>
                      )}
                    </div>

                    {entry.restoredBy && entry.restoredAt && (
                      <div className="flex items-center gap-2 text-[11px] text-[#6b828c]">
                        <RotateCcw className="w-3 h-3 shrink-0 text-green-500" />
                        <span>
                          Restored by <span className="font-medium text-[#092E3F]">{entry.restoredBy}</span>
                          {' · '}
                          {formatTimestamp(entry.restoredAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Restore action for active dismissals */}
                  {!entry.restoredBy && (
                    <button
                      onClick={() => onRestore(entry.ruleId, entry.scope, entry.tenants)}
                      className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#2A96A8] hover:text-[#092E3F] transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer summary */}
        {entries.length > 0 && (
          <div className="border-t border-[#e5f2f4] px-5 py-3 bg-[#f8fdfe] shrink-0">
            <p className="text-[11px] text-[#6b828c]">
              <span className="font-medium text-[#092E3F]">{entries.length}</span> total event{entries.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-medium text-[#092E3F]">{activeCount}</span> active ·{' '}
              <span className="font-medium text-[#092E3F]">{entries.length - activeCount}</span> restored
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
