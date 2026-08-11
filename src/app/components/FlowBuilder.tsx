import { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner@2.0.3';
import {
  ArrowLeft, ArrowRight, ArrowDown, Play, Save, X, GripVertical,
  Zap, Bot, GitBranch, Bell,
  Crosshair, FlaskConical, CheckCircle, Building2,
} from 'lucide-react';
import {
  SoarFlow, FlowNode, BlockDef, BLOCK_DEFS, TIER_COLORS, NODE_STYLE,
  PROVIDER_NAMES, ALERT_TYPES, TENANT_NAMES,
  SENTINEL_PLAYBOOKS, ImpactTier, ScopeMode, SoarAction,
  blockToNode, nodeLabel, nodeSubtitle, simulateFlow, makeNodeId,
} from './soarData';

// ─── drag types ───────────────────────────────────────────────────────────────
const DND_PALETTE = 'palette-block';
const DND_NODE = 'canvas-node';

const KIND_ICONS: Record<FlowNode['kind'], React.ComponentType<{ className?: string }>> = {
  trigger: Crosshair,
  analyze: Bot,
  condition: GitBranch,
  action: Zap,
  notify: Bell,
};

// ─── palette item ─────────────────────────────────────────────────────────────

function PaletteItem({ block }: { block: BlockDef }) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DND_PALETTE,
    item: { blockKey: block.key },
    collect: m => ({ isDragging: m.isDragging() }),
  }), [block.key]);

  const style = block.kind === 'action' && block.tier
    ? TIER_COLORS[block.tier]
    : null;
  const railClass = style ? style.rail : NODE_STYLE[block.kind].rail;
  const Icon = KIND_ICONS[block.kind];

  return (
    <div
      ref={dragRef}
      className={`relative flex items-start gap-2.5 pl-3.5 pr-3 py-2.5 bg-white border border-[#e5e9eb] rounded-[4px] cursor-grab select-none overflow-hidden hover:border-[#2A96A8]/50 hover:shadow-[0_1px_3px_rgba(9,46,63,0.08)] transition-all ${isDragging ? 'opacity-40' : ''}`}
      title={block.description}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${railClass}`} />
      <Icon className="w-3.5 h-3.5 text-[#6b828c] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#092E3F] leading-tight">{block.label}</p>
        {block.source && <p className="text-[10px] text-[#87999f] mt-0.5 truncate">{block.source}</p>}
      </div>
    </div>
  );
}

// ─── drop slot between nodes ──────────────────────────────────────────────────

function DropSlot({ index, onDropBlock, onMoveNode, orientation = 'horizontal' }: {
  index: number;
  onDropBlock: (blockKey: string, at: number) => void;
  onMoveNode: (from: number, to: number) => void;
  orientation?: 'horizontal' | 'vertical';
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: [DND_PALETTE, DND_NODE],
    drop: (item: { blockKey?: string; index?: number }) => {
      if (item.blockKey) onDropBlock(item.blockKey, index);
      else if (item.index !== undefined) onMoveNode(item.index, index);
    },
    collect: m => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  }), [index, onDropBlock, onMoveNode]);

  if (orientation === 'vertical') {
    return (
      <div ref={dropRef} className="flex justify-center self-stretch py-0.5">
        <div className="h-8 flex items-center justify-center transition-all">
          {isOver ? (
            <div className="h-8 w-full rounded-[4px] border-2 border-dashed border-[#2A96A8] bg-[#e5f2f4]" />
          ) : (
            <ArrowDown className={`w-4 h-4 shrink-0 ${canDrop ? 'text-[#2A96A8]/60' : 'text-[#b7c4c9]'}`} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={dropRef} className="flex items-center self-stretch px-0.5">
      <div className="w-8 flex items-center justify-center transition-all">
        {isOver ? (
          <div className="w-8 h-12 rounded-[4px] border-2 border-dashed border-[#2A96A8] bg-[#e5f2f4]" />
        ) : (
          <ArrowRight className={`w-4 h-4 shrink-0 ${canDrop ? 'text-[#2A96A8]/60' : 'text-[#b7c4c9]'}`} />
        )}
      </div>
    </div>
  );
}

// ─── canvas node card ─────────────────────────────────────────────────────────

function NodeCard({ node, index, isSelected, onSelect, onRemove, tenantSummary }: {
  node: FlowNode;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  tenantSummary?: string;
}) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DND_NODE,
    item: { index },
    canDrag: node.kind !== 'trigger',
    collect: m => ({ isDragging: m.isDragging() }),
  }), [index, node.kind]);

  const style = node.kind === 'action'
    ? TIER_COLORS[node.tier]
    : null;
  const base = NODE_STYLE[node.kind];
  const railClass = style ? style.rail : base.rail;
  const bgClass = style ? style.bg : base.bg;
  const borderClass = isSelected ? 'border-[#092E3F]' : (style ? style.border : base.border);
  const Icon = KIND_ICONS[node.kind];

  return (
    <div
      ref={dragRef}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative w-[188px] shrink-0 pl-4 pr-2.5 py-2.5 rounded-[4px] border-2 ${bgClass} ${borderClass} cursor-pointer overflow-hidden transition-all hover:shadow-[0_2px_6px_rgba(9,46,63,0.12)] ${isDragging ? 'opacity-40' : ''} ${isSelected ? 'shadow-[0_2px_8px_rgba(9,46,63,0.18)]' : ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${railClass}`} />
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-[#092E3F]/60 shrink-0" />
          <p className="text-sm font-semibold text-[#092E3F] truncate">{nodeLabel(node)}</p>
        </div>
        <div className="flex items-center shrink-0">
          {node.kind !== 'trigger' && (
            <GripVertical className="w-3.5 h-3.5 text-[#b7c4c9] opacity-0 group-hover:opacity-100 cursor-grab" />
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-0.5 text-[#b7c4c9] hover:text-[#c2453d] opacity-0 group-hover:opacity-100 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-[#5c707a] mt-1 truncate">{nodeSubtitle(node)}</p>
      {node.kind === 'trigger' && tenantSummary && (
        <p className="flex items-center gap-1 text-[11px] text-[#87999f] mt-1">
          <Building2 className="w-3 h-3" />
          {tenantSummary}
        </p>
      )}
      {node.kind === 'action' && (
        <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase tracking-wide ${TIER_COLORS[node.tier].bg} ${TIER_COLORS[node.tier].text}`}>
          {node.tier} impact
        </span>
      )}
    </div>
  );
}

// ─── config drawer (per node kind) ────────────────────────────────────────────

function CheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-[#f6f6f6] rounded-[4px] cursor-pointer">
      <div
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        className={`w-4 h-4 rounded-[3px] border-2 flex items-center justify-center transition-colors shrink-0 ${
          checked ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-[#c4d2d6] bg-white'
        }`}
      >
        {checked && <CheckCircle className="w-3 h-3 text-white" />}
      </div>
      <span className="text-xs text-[#092E3F]">{label}</span>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">{children}</p>;
}

function NodeConfigDrawer({ node, flow, onPatch, onPatchFlow, onClose }: {
  node: FlowNode;
  flow: SoarFlow;
  onPatch: (patch: Partial<FlowNode>) => void;
  onPatchFlow: (patch: Partial<SoarFlow>) => void;
  onClose: () => void;
}) {
  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Configure block</p>
              <h2 className="text-white text-base font-semibold leading-snug">{nodeLabel(node)}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {node.kind === 'trigger' && (
            <>
              <div className="bg-[#e5f2f4] rounded-[4px] p-3">
                <p className="text-xs text-[#092E3F]/70">Choose what this flow watches for — a broad alert type, or a specific data source. Then pick which tenants it applies to.</p>
              </div>

              <div>
                <FieldLabel>Match by</FieldLabel>
                <div className="flex gap-2 mb-3">
                  {([['alertTypes', 'Alert type'], ['providerNames', 'Provider']] as [ScopeMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => {
                        onPatch({ scopeMode: mode, alertTypes: [], providerNames: [] });
                        onPatchFlow({ scopeMode: mode, alertTypes: [], providerNames: [] });
                      }}
                      className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                        node.scopeMode === mode
                          ? 'bg-[#092E3F] text-white border-[#092E3F]'
                          : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#87999f] mb-3">Alert type is broader (fires from any source); provider is specific to one data source.</p>

                {node.scopeMode === 'alertTypes' ? (
                  <div className="border border-[#e5e9eb] rounded-[4px] max-h-56 overflow-y-auto p-1">
                    {ALERT_TYPES.map(t => (
                      <CheckboxRow
                        key={t} label={t}
                        checked={node.alertTypes.includes(t)}
                        onToggle={() => {
                          const next = toggleIn(node.alertTypes, t);
                          onPatch({ alertTypes: next });
                          onPatchFlow({ alertTypes: next });
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border border-[#e5e9eb] rounded-[4px] max-h-56 overflow-y-auto p-1">
                    {PROVIDER_NAMES.map(p => (
                      <CheckboxRow
                        key={p} label={p}
                        checked={node.providerNames.includes(p)}
                        onToggle={() => {
                          const next = toggleIn(node.providerNames, p);
                          onPatch({ providerNames: next });
                          onPatchFlow({ providerNames: next });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Tenants</FieldLabel>
                <TenantPicker flow={flow} onPatchFlow={onPatchFlow} />
              </div>
            </>
          )}

          {node.kind === 'analyze' && (
            <>
              <div className="bg-[#e5f2f4] rounded-[4px] p-3">
                <p className="text-xs text-[#092E3F]/70">
                  AI reviews the incident, decides if it's a real threat, and builds a recommended action plan — the same one the Agentic SOC generates today. No configuration needed.
                </p>
              </div>
              <div className="bg-[#f6f6f6] rounded-[4px] p-3">
                <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-1">How the plan is used</p>
                <p className="text-xs text-[#092E3F]/70">
                  If the AI recommends an action you've added below, this flow runs it automatically — no approval step. If it recommends something you haven't added — e.g. Block user — that's <span className="font-semibold">not</span> run automatically; it just shows up as a suggestion on the incident page for an analyst to act on.
                </p>
              </div>
            </>
          )}

          {node.kind === 'condition' && (
            <div>
              <FieldLabel>Expression</FieldLabel>
              <input
                type="text"
                value={node.expr}
                onChange={e => onPatch({ expr: e.target.value })}
                placeholder="confidence >= 80 && risk >= High"
                className="w-full px-3 py-2 text-xs font-mono bg-[#f6f6f6] border border-[#e5e9eb] rounded-[4px] text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
              />
              <p className="text-[10px] text-[#87999f] mt-2">The flow only continues past this block when the expression is true. Supports confidence, risk, hour, severity.</p>
            </div>
          )}

          {node.kind === 'action' && (
            <>
              <div className={`rounded-[4px] p-3 ${TIER_COLORS[node.tier].bg}`}>
                <p className={`text-xs font-semibold ${TIER_COLORS[node.tier].text} uppercase tracking-wide mb-1`}>{node.tier} impact</p>
                <p className="text-xs text-[#092E3F]/70">
                  {node.tier === 'high' && 'Destructive / highly disruptive. Runs automatically whenever the AI recommends it.'}
                  {node.tier === 'medium' && 'Contains the account or session. Reversible, moderate user impact.'}
                  {node.tier === 'low' && 'Non-destructive — safe to run automatically.'}
                </p>
              </div>

              {node.action === 'run_sentinel_playbook' && (
                <>
                  <div>
                    <FieldLabel>Sentinel playbook</FieldLabel>
                    <div className="space-y-1.5">
                      {SENTINEL_PLAYBOOKS.map(pb => (
                        <button
                          key={pb}
                          onClick={() => onPatch({ params: { ...node.params, playbook: pb } } as Partial<FlowNode>)}
                          className={`w-full text-left px-3 py-2 rounded-[4px] text-xs border transition-colors ${
                            node.params?.playbook === pb
                              ? 'bg-[#e5f2f4] border-[#2A96A8]/50 text-[#092E3F] font-medium'
                              : 'bg-white border-[#e5e9eb] text-[#6b828c] hover:border-[#c9d6dc]'
                          }`}
                        >
                          {pb}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#87999f] mt-2">Manage playbooks on the Playbooks page.</p>
                  </div>
                  <div>
                    <FieldLabel>Impact tier override</FieldLabel>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as ImpactTier[]).map(t => (
                        <button
                          key={t}
                          onClick={() => onPatch({ tier: t } as Partial<FlowNode>)}
                          className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors capitalize ${
                            node.tier === t
                              ? `${TIER_COLORS[t].bg} ${TIER_COLORS[t].text} ${TIER_COLORS[t].border}`
                              : 'bg-white text-[#6b828c] border-[#e5e9eb] hover:border-[#c9d6dc]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#87999f] mt-2">A playbook can do anything — tier it by what this one actually does.</p>
                  </div>
                </>
              )}

              {node.action === 'send_itsm_ticket' && (
                <div>
                  <FieldLabel>ITSM system</FieldLabel>
                  <div className="flex gap-2 flex-wrap">
                    {['ServiceNow', 'Jira', 'PagerDuty'].map(sys => (
                      <button
                        key={sys}
                        onClick={() => onPatch({ params: { ...node.params, system: sys } } as Partial<FlowNode>)}
                        className={`px-4 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                          node.params?.system === sys
                            ? 'bg-[#092E3F] text-white border-[#092E3F]'
                            : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'
                        }`}
                      >
                        {sys}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(node.action === 'isolate_device' || node.action === 'block_user' || node.action === 'revoke_sessions' || node.action === 'reset_password') && (
                <div className="bg-[#f6f6f6] rounded-[4px] p-3">
                  <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-1">Target</p>
                  <p className="text-xs text-[#092E3F]/70">
                    {node.action === 'isolate_device'
                      ? 'The device entity from the incident. Executed via Defender for Endpoint.'
                      : 'The user entity from the incident. Executed via Entra ID.'}
                  </p>
                </div>
              )}
            </>
          )}

          {node.kind === 'notify' && (
            <>
              <div>
                <FieldLabel>Channels</FieldLabel>
                <div className="space-y-1.5">
                  {([
                    ['email', 'Email — soc@seculyze.com'],
                    ['Slack', 'Slack — #soc-alerts'],
                    ['ServiceNow', 'ServiceNow — incident queue'],
                    ['phone', 'SMS — on-call rotation'],
                  ] as const).map(([key, label]) => {
                    const active = node.channels.some(c => (c.itsmType ?? c.type) === key);
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          const next = active
                            ? node.channels.filter(c => (c.itsmType ?? c.type) !== key)
                            : [...node.channels,
                                key === 'email' ? { id: makeNodeId(), type: 'email' as const, value: 'soc@seculyze.com' }
                                : key === 'phone' ? { id: makeNodeId(), type: 'phone' as const, value: '+45 on-call' }
                                : { id: makeNodeId(), type: 'itsm' as const, value: key === 'Slack' ? '#soc-alerts' : 'incident queue', itsmType: key }];
                          onPatch({ channels: next } as Partial<FlowNode>);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-[4px] text-xs border transition-colors ${
                          active
                            ? 'bg-[#e5f2f4] border-[#2A96A8]/50 text-[#092E3F] font-medium'
                            : 'bg-white border-[#e5e9eb] text-[#6b828c] hover:border-[#c9d6dc]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <FieldLabel>Message template</FieldLabel>
                <textarea
                  value={node.template}
                  onChange={e => onPatch({ template: e.target.value } as Partial<FlowNode>)}
                  placeholder="Sessions revoked for {{user}} after {{alertType}}…"
                  rows={4}
                  className="w-full px-3 py-2 text-xs bg-[#f6f6f6] border border-[#e5e9eb] rounded-[4px] text-[#092E3F] font-mono focus:outline-none focus:border-[#2A96A8] resize-none"
                />
                <p className="text-[10px] text-[#87999f] mt-1.5">
                  Variables: {'{{user}} {{device}} {{alertType}} {{tenant}} {{ticket}} {{actions}}'}
                </p>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── tenant picker (shared by the trigger config) ─────────────────────────────

function tenantSummaryText(clientScope: string[]) {
  return clientScope[0] === 'all' ? 'All tenants' : `${clientScope.length} tenant${clientScope.length !== 1 ? 's' : ''}`;
}

function TenantPicker({ flow, onPatchFlow }: {
  flow: SoarFlow;
  onPatchFlow: (patch: Partial<SoarFlow>) => void;
}) {
  const allTenants = flow.clientScope.length === 1 && flow.clientScope[0] === 'all';
  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  return (
    <>
      <button
        onClick={() => onPatchFlow({ clientScope: allTenants ? [] : ['all'] })}
        className={`w-full text-left px-3 py-2 mb-2 rounded-[4px] text-xs border font-medium transition-colors ${
          allTenants ? 'bg-[#e5f2f4] border-[#2A96A8]/50 text-[#092E3F]' : 'bg-white border-[#e5e9eb] text-[#6b828c]'
        }`}
      >
        All tenants
      </button>
      {!allTenants && (
        <div className="border border-[#e5e9eb] rounded-[4px] max-h-40 overflow-y-auto p-1">
          {TENANT_NAMES.map(t => (
            <CheckboxRow key={t} label={t}
              checked={flow.clientScope.includes(t)}
              onToggle={() => onPatchFlow({ clientScope: toggleIn(flow.clientScope, t) })}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── simulate modal ───────────────────────────────────────────────────────────

function SimulateModal({ flow, onClose }: { flow: SoarFlow; onClose: () => void }) {
  const result = simulateFlow(flow);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-[#092E3F] px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Dry run · last 30 days</p>
              <h3 className="text-white text-base font-semibold">Simulation — {flow.name}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f6f6f6] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#092E3F]">{result.matched}</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Alerts matched scope</p>
            </div>
            <div className="bg-[#e3f0e8] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#2f7d52]">{Math.round(result.minutesSaved / 60)}h</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Analyst time saved</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-2">Actions that would have fired</p>
            <div className="border border-[#e5e9eb] rounded-[4px] divide-y divide-[#f0f3f4]">
              {result.actionsFired.length === 0 && (
                <p className="px-3 py-2.5 text-xs text-[#87999f] italic">No action blocks on the canvas yet.</p>
              )}
              {result.actionsFired.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-[#092E3F]">{a.label}</span>
                  <span className="text-xs font-semibold text-[#092E3F]">×{a.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#f6f6f6] rounded-[4px] p-3 flex items-start gap-2">
            <FlaskConical className="w-3.5 h-3.5 text-[#2A96A8] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#6b828c]">Dry run only — nothing was executed. Numbers are computed against mock alert history for this prototype.</p>
          </div>
        </div>
        <div className="border-t border-[#e5f2f4] px-6 py-4 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main builder ─────────────────────────────────────────────────────────────

const PALETTE_GROUPS: BlockDef['group'][] = ['Trigger & AI', 'Logic & control', 'Actions', 'Notify'];

// Groups consecutive action nodes so they render as one vertical stack within
// the otherwise left-to-right flow — one flow, but multiple actions in a row
// read top-to-bottom instead of sprawling sideways.
type FlowSegment =
  | { type: 'node'; node: FlowNode; index: number }
  | { type: 'actions'; nodes: Extract<FlowNode, { kind: 'action' }>[]; indices: number[] };

function buildSegments(nodes: FlowNode[]): FlowSegment[] {
  const segments: FlowSegment[] = [];
  let i = 0;
  while (i < nodes.length) {
    if (nodes[i].kind === 'action') {
      const groupNodes: Extract<FlowNode, { kind: 'action' }>[] = [];
      const indices: number[] = [];
      while (i < nodes.length && nodes[i].kind === 'action') {
        groupNodes.push(nodes[i] as Extract<FlowNode, { kind: 'action' }>);
        indices.push(i);
        i++;
      }
      segments.push({ type: 'actions', nodes: groupNodes, indices });
    } else {
      segments.push({ type: 'node', node: nodes[i], index: i });
      i++;
    }
  }
  return segments;
}

export default function FlowBuilder({ flow: initial, onSave, onBack }: {
  flow: SoarFlow;
  onSave: (flow: SoarFlow) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<SoarFlow>(() => JSON.parse(JSON.stringify(initial)));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSimulate, setShowSimulate] = useState(false);

  const patchFlow = (patch: Partial<SoarFlow>) => setDraft(prev => ({ ...prev, ...patch }));

  const patchNode = (id: string, patch: Partial<FlowNode>) =>
    setDraft(prev => ({
      ...prev,
      nodes: prev.nodes.map(nd => nd.id === id ? ({ ...nd, ...patch } as FlowNode) : nd),
    }));

  const insertBlock = (blockKey: string, at: number) => {
    const def = BLOCK_DEFS.find(b => b.key === blockKey);
    if (!def) return;
    if (def.kind === 'trigger' && draft.nodes.some(nd => nd.kind === 'trigger')) {
      toast.error('A flow has exactly one trigger');
      return;
    }
    const node = blockToNode(def);
    setDraft(prev => {
      const nodes = [...prev.nodes];
      nodes.splice(Math.max(1, at), 0, node); // never before the trigger
      return { ...prev, nodes };
    });
    setSelectedNodeId(node.id);
  };

  const moveNode = (from: number, to: number) => {
    if (from === 0) return; // trigger is pinned
    setDraft(prev => {
      const nodes = [...prev.nodes];
      const [moved] = nodes.splice(from, 1);
      nodes.splice(Math.max(1, from < to ? to - 1 : to), 0, moved);
      return { ...prev, nodes };
    });
  };

  const removeNode = (id: string) => {
    setDraft(prev => ({ ...prev, nodes: prev.nodes.filter(nd => nd.id !== id) }));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const selectedNode = draft.nodes.find(nd => nd.id === selectedNodeId) ?? null;
  const scopeList = draft.scopeMode === 'alertTypes' ? draft.alertTypes : draft.providerNames;
  const scopeSummary = scopeList.length > 0
    ? `${scopeList.length} ${draft.scopeMode === 'alertTypes' ? 'alert type' : 'provider'}${scopeList.length !== 1 ? 's' : ''} · ${tenantSummaryText(draft.clientScope)}`
    : 'No scope set';

  const configuredActions = new Set(
    draft.nodes.filter((nd): nd is Extract<FlowNode, { kind: 'action' }> => nd.kind === 'action').map(nd => nd.action)
  );
  const unconfiguredActions = BLOCK_DEFS.filter(
    (b): b is BlockDef & { action: SoarAction; tier: ImpactTier } => b.kind === 'action' && !configuredActions.has(b.action!)
  );

  const handleSave = (enable?: boolean) => {
    const next = enable === undefined ? draft : { ...draft, isActive: enable };
    setDraft(next);
    onSave(next);
    toast.success(enable ? `Flow enabled: ${next.name}` : `Flow saved: ${next.name}`);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">

        {/* ── Top bar ── */}
        <div className="bg-white border-b border-[#e5e9eb] px-5 py-3 flex items-center gap-4 shrink-0 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#6b828c] hover:text-[#092E3F] transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Flows
          </button>
          <div className="w-px h-6 bg-[#e5e9eb] shrink-0" />

          <input
            value={draft.name}
            onChange={e => patchFlow({ name: e.target.value })}
            className="text-sm font-semibold text-[#092E3F] bg-transparent border border-transparent hover:border-[#e5e9eb] focus:border-[#2A96A8] rounded-[4px] px-2 py-1 focus:outline-none min-w-[180px]"
          />

          <button
            onClick={() => setSelectedNodeId(draft.nodes.find(nd => nd.kind === 'trigger')?.id ?? null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs bg-[#f6f6f6] border border-[#e5e9eb] text-[#092E3F] hover:border-[#2A96A8] transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#2A96A8]" />
            {scopeSummary}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setShowSimulate(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Test / simulate
          </button>
          <button
            onClick={() => handleSave()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-white border border-[#c9d6dc] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-xs font-medium bg-[#092e3f] text-white hover:bg-[#092e3f]/90 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            {draft.isActive ? 'Update & keep enabled' : 'Enable flow'}
          </button>
        </div>

        {/* ── Body: palette + canvas ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Palette */}
          <div className="w-60 bg-white border-r border-[#e5e9eb] overflow-y-auto shrink-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-[#6b828c] uppercase tracking-widest">Steps</p>
              <p className="text-[10px] text-[#87999f] mt-1">Drag a step onto the flow. Colour = impact.</p>
            </div>
            {PALETTE_GROUPS.map(group => (
              <div key={group} className="px-4 pb-4">
                <p className="text-[10px] font-medium text-[#87999f] uppercase tracking-wide mb-2">{group}</p>
                <div className="space-y-1.5">
                  {BLOCK_DEFS.filter(b => b.group === group).map(block => (
                    <PaletteItem key={block.key} block={block} />
                  ))}
                </div>
              </div>
            ))}
            <div className="px-4 pb-5">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#87999f] uppercase tracking-wide">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] bg-[#2f7d52]" />Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] bg-[#c07d1e]" />Medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] bg-[#c2453d]" />High</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px] bg-[#2A96A8]" />Agent</span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 overflow-auto p-8"
            style={{ backgroundImage: 'radial-gradient(circle, #d3dde0 1px, transparent 1px)', backgroundSize: '22px 22px' }}
            onClick={() => setSelectedNodeId(null)}
          >
            <div className="flex items-start flex-wrap gap-y-6 max-w-full">
              {buildSegments(draft.nodes).map(seg => (
                seg.type === 'node' ? (
                  <div key={seg.node.id} className="flex items-center">
                    {seg.index > 0 && <DropSlot index={seg.index} onDropBlock={insertBlock} onMoveNode={moveNode} />}
                    <NodeCard
                      node={seg.node}
                      index={seg.index}
                      isSelected={selectedNodeId === seg.node.id}
                      onSelect={() => setSelectedNodeId(seg.node.id)}
                      onRemove={seg.node.kind === 'trigger' ? undefined : () => removeNode(seg.node.id)}
                      tenantSummary={seg.node.kind === 'trigger' ? tenantSummaryText(draft.clientScope) : undefined}
                    />
                  </div>
                ) : (
                  <div key={`actions-${seg.indices[0]}`} className="flex items-center">
                    {seg.indices[0] > 0 && <DropSlot index={seg.indices[0]} onDropBlock={insertBlock} onMoveNode={moveNode} />}
                    <div className="flex flex-col gap-2">
                      {seg.nodes.map((node, k) => (
                        <div key={node.id} className="flex flex-col items-center">
                          {k > 0 && <DropSlot index={seg.indices[k]} onDropBlock={insertBlock} onMoveNode={moveNode} orientation="vertical" />}
                          <NodeCard
                            node={node}
                            index={seg.indices[k]}
                            isSelected={selectedNodeId === node.id}
                            onSelect={() => setSelectedNodeId(node.id)}
                            onRemove={() => removeNode(node.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
              {/* trailing drop zone */}
              <TrailingDrop
                index={draft.nodes.length}
                onDropBlock={insertBlock}
                onMoveNode={moveNode}
              />
            </div>

            <p className="text-[11px] text-[#87999f] mt-10">
              Click a step to configure it · drag from the left to add a step. Runs left to right — multiple actions stack vertically.
            </p>

            {unconfiguredActions.length > 0 && (
              <div className="mt-6 max-w-2xl">
                <p className="text-[11px] font-semibold text-[#6b828c] uppercase tracking-wide mb-2">Other actions AI may recommend</p>
                <div className="flex flex-wrap gap-2">
                  {unconfiguredActions.map(b => (
                    <span
                      key={b.key}
                      title="Not added to this flow — shown as a recommendation on the incident page only."
                      className="px-2 py-1 rounded-[4px] text-[11px] font-medium bg-white border border-dashed border-[#c9d6dc] text-[#87999f]"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-[#87999f] mt-1.5">Not wired in — the AI can still surface these on the incident page for an analyst to run manually.</p>
              </div>
            )}
          </div>
        </div>

        {/* Drawers & modals */}
        {selectedNode && (
          <NodeConfigDrawer
            node={selectedNode}
            flow={draft}
            onPatch={(patch) => patchNode(selectedNode.id, patch)}
            onPatchFlow={patchFlow}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
        {showSimulate && (
          <SimulateModal flow={draft} onClose={() => setShowSimulate(false)} />
        )}
      </div>
    </DndProvider>
  );
}

// Large open drop area at the end of the sequence
function TrailingDrop({ index, onDropBlock, onMoveNode }: {
  index: number;
  onDropBlock: (blockKey: string, at: number) => void;
  onMoveNode: (from: number, to: number) => void;
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: [DND_PALETTE, DND_NODE],
    drop: (item: { blockKey?: string; index?: number }) => {
      if (item.blockKey) onDropBlock(item.blockKey, index);
      else if (item.index !== undefined) onMoveNode(item.index, index);
    },
    collect: m => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  }), [index, onDropBlock, onMoveNode]);

  return (
    <div className="flex items-center">
      <ArrowRight className={`w-4 h-4 mx-1 shrink-0 ${canDrop ? 'text-[#2A96A8]/60' : 'text-[#b7c4c9]'}`} />
      <div
        ref={dropRef}
        className={`w-[188px] h-16 rounded-[4px] border-2 border-dashed flex items-center justify-center transition-colors shrink-0 ${
          isOver ? 'border-[#2A96A8] bg-[#e5f2f4]' : canDrop ? 'border-[#2A96A8]/40 bg-white/60' : 'border-[#c4d2d6] bg-white/40'
        }`}
      >
        <p className="text-[11px] text-[#87999f]">Drop step here</p>
      </div>
    </div>
  );
}
