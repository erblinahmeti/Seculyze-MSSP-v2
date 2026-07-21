import { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from 'sonner@2.0.3';
import {
  ArrowLeft, ArrowRight, Play, Save, X, Trash2, GripVertical,
  ChevronDown, Zap, ShieldCheck, Bot, GitBranch, Bell,
  Crosshair, FlaskConical, CheckCircle,
} from 'lucide-react';
import {
  SoarFlow, FlowNode, BlockDef, BLOCK_DEFS, TIER_COLORS, NODE_STYLE,
  EXECUTION_MODE_META, PROVIDER_NAMES, ALERT_TYPES, TENANT_NAMES,
  SENTINEL_PLAYBOOKS, ExecutionMode, ImpactTier, RiskLevel,
  blockToNode, nodeLabel, nodeSubtitle, simulateFlow, makeNodeId,
} from './soarData';

// ─── drag types ───────────────────────────────────────────────────────────────
const DND_PALETTE = 'palette-block';
const DND_NODE = 'canvas-node';

const KIND_ICONS: Record<FlowNode['kind'], React.ComponentType<{ className?: string }>> = {
  trigger: Crosshair,
  triage: ShieldCheck,
  respond: Bot,
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

function DropSlot({ index, onDropBlock, onMoveNode }: {
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
    <div ref={dropRef} className="flex items-center self-stretch px-0.5">
      <div className={`w-8 flex items-center justify-center transition-all ${
        isOver ? '' : ''
      }`}>
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

function NodeCard({ node, index, isSelected, onSelect, onRemove }: {
  node: FlowNode;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
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
      className={`group relative w-[172px] shrink-0 pl-4 pr-2.5 py-2.5 rounded-[4px] border-2 ${bgClass} ${borderClass} cursor-pointer overflow-hidden transition-all hover:shadow-[0_2px_6px_rgba(9,46,63,0.12)] ${isDragging ? 'opacity-40' : ''} ${isSelected ? 'shadow-[0_2px_8px_rgba(9,46,63,0.18)]' : ''}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${railClass}`} />
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-[#092E3F]/60 shrink-0" />
          <p className="text-xs font-semibold text-[#092E3F] truncate">{nodeLabel(node)}</p>
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
      <p className="text-[10px] text-[#5c707a] mt-1 truncate">{nodeSubtitle(node)}</p>
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
                <p className="text-xs text-[#092E3F]/70">The trigger defines this flow's scope — which alerts it is eligible for. Alert type and provider are required; refine with tenants or severity in the top bar's scope settings.</p>
              </div>
              <div>
                <FieldLabel>Alert types</FieldLabel>
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
              </div>
              <div>
                <FieldLabel>Provider names</FieldLabel>
                <div className="border border-[#e5e9eb] rounded-[4px] max-h-48 overflow-y-auto p-1">
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
              </div>
            </>
          )}

          {node.kind === 'triage' && (
            <>
              <div className="bg-[#e5f2f4] rounded-[4px] p-3">
                <p className="text-xs text-[#092E3F]/70">The triage agent classifies the incident (TruePositive / FalsePositive / Benign / Suspicious) and emits a confidence and risk score. Confidence and risk here gate the rest of the flow. Scores are mocked in this prototype.</p>
              </div>
              <div>
                <FieldLabel>Minimum confidence — {node.minConfidence}%</FieldLabel>
                <input
                  type="range" min={50} max={99} value={node.minConfidence}
                  onChange={e => onPatch({ minConfidence: Number(e.target.value) })}
                  className="w-full accent-[#2A96A8]"
                />
                <div className="flex justify-between text-[10px] text-[#87999f] mt-1"><span>50%</span><span>99%</span></div>
              </div>
              <div>
                <FieldLabel>Risk floor</FieldLabel>
                <div className="flex gap-2">
                  {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => (
                    <button
                      key={r}
                      onClick={() => onPatch({ minRisk: r })}
                      className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                        node.minRisk === r
                          ? 'bg-[#092E3F] text-white border-[#092E3F]'
                          : 'bg-white text-[#092E3F] border-[#c9d6dc] hover:border-[#092E3F]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {node.kind === 'respond' && (
            <div className="bg-[#e5f2f4] rounded-[4px] p-3">
              <p className="text-xs text-[#092E3F]/70">
                The respond agent takes the triage verdict and produces the action plan — the same <code className="font-mono bg-white px-1 rounded-[3px]">RecommendedAction[]</code> the Agentic SOC generates today. In a flow, that plan is handed to the blocks that follow. No configuration needed.
              </p>
            </div>
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
                  {node.tier === 'high' && 'Destructive / highly disruptive. In staged flows this waits for an analyst to run it.'}
                  {node.tier === 'medium' && 'Contains the account or session. Reversible, moderate user impact.'}
                  {node.tier === 'low' && 'Non-destructive — safe to auto-execute above threshold.'}
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

// ─── scope drawer (flow-level) ────────────────────────────────────────────────

function ScopeDrawer({ flow, onPatchFlow, onClose }: {
  flow: SoarFlow;
  onPatchFlow: (patch: Partial<SoarFlow>) => void;
  onClose: () => void;
}) {
  const allTenants = flow.clientScope.length === 1 && flow.clientScope[0] === 'all';
  const toggleIn = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        <div className="bg-[#092E3F] px-6 py-5 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[#2A96A8] text-xs uppercase tracking-widest mb-1">Flow scope</p>
              <h2 className="text-white text-base font-semibold leading-snug">{flow.name}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="bg-[#e5f2f4] rounded-[4px] p-3">
            <p className="text-xs text-[#092E3F]/70">Scope is the router: which alerts is this flow <span className="font-semibold">eligible</span> for. Alert type + provider are required; the rest are optional refining filters. All filters combine with AND.</p>
          </div>

          <div>
            <FieldLabel>Alert types (required)</FieldLabel>
            <div className="border border-[#e5e9eb] rounded-[4px] max-h-44 overflow-y-auto p-1">
              {ALERT_TYPES.map(t => (
                <CheckboxRow key={t} label={t}
                  checked={flow.alertTypes.includes(t)}
                  onToggle={() => onPatchFlow({ alertTypes: toggleIn(flow.alertTypes, t) })}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Provider names (required)</FieldLabel>
            <div className="border border-[#e5e9eb] rounded-[4px] max-h-40 overflow-y-auto p-1">
              {PROVIDER_NAMES.map(p => (
                <CheckboxRow key={p} label={p}
                  checked={flow.providerNames.includes(p)}
                  onToggle={() => onPatchFlow({ providerNames: toggleIn(flow.providerNames, p) })}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Tenants</FieldLabel>
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
          </div>

          <div>
            <FieldLabel>Severity (optional filter)</FieldLabel>
            <div className="flex gap-2">
              {(['High', 'Medium', 'Low'] as RiskLevel[]).map(s => {
                const active = flow.severityScope?.includes(s) ?? false;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const cur = flow.severityScope ?? [];
                      const next = active ? cur.filter(x => x !== s) : [...cur, s];
                      onPatchFlow({ severityScope: next.length ? next : undefined });
                    }}
                    className={`flex-1 py-2 rounded-[4px] text-xs font-medium border transition-colors ${
                      active ? 'bg-[#092E3F] text-white border-[#092E3F]' : 'bg-white text-[#6b828c] border-[#e5e9eb] hover:border-[#c9d6dc]'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#87999f] mt-2">No selection = all severities.</p>
          </div>

          <div className="bg-[#f6f6f6] rounded-[4px] p-3">
            <p className="text-[11px] font-semibold text-[#092E3F] uppercase tracking-wide mb-1">Precedence</p>
            <p className="text-xs text-[#092E3F]/70">If an alert matches multiple flows, the highest-priority flow (its position in the library) executes — one flow per alert, never two.</p>
          </div>
        </div>

        <div className="border-t border-[#e5f2f4] px-6 py-4 bg-white shrink-0 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-[#092e3f] text-white rounded-[4px] text-sm font-medium hover:bg-[#092e3f]/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
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
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#f6f6f6] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#092E3F]">{result.matched}</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Alerts matched scope</p>
            </div>
            <div className="bg-[#e5f2f4] rounded-[4px] p-3 text-center">
              <p className="text-2xl font-bold text-[#1e7d8f]">{result.aboveThreshold}</p>
              <p className="text-[10px] text-[#6b828c] uppercase tracking-wide mt-1">Above threshold ({flow.confidenceThreshold}%)</p>
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
                  <div className="flex items-center gap-2">
                    {a.gated && (
                      <span className="px-1.5 py-0.5 rounded-[3px] text-[9px] font-semibold uppercase tracking-wide bg-[#f7efdf] text-[#c07d1e]">
                        Gated
                      </span>
                    )}
                    <span className="text-xs font-semibold text-[#092E3F]">×{a.count}</span>
                  </div>
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

const PALETTE_GROUPS: BlockDef['group'][] = ['Trigger & agents', 'Logic & control', 'Actions', 'Notify'];

export default function FlowBuilder({ flow: initial, onSave, onBack }: {
  flow: SoarFlow;
  onSave: (flow: SoarFlow) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<SoarFlow>(() => JSON.parse(JSON.stringify(initial)));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showScope, setShowScope] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

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
  const scopeSummary = draft.alertTypes.length > 0
    ? `${draft.alertTypes.length} alert type${draft.alertTypes.length !== 1 ? 's' : ''} · ${draft.providerNames.length} provider${draft.providerNames.length !== 1 ? 's' : ''} · ${draft.clientScope[0] === 'all' ? 'all tenants' : `${draft.clientScope.length} tenants`}`
    : 'No scope set';

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
            onClick={() => setShowScope(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs bg-[#f6f6f6] border border-[#e5e9eb] text-[#092E3F] hover:border-[#2A96A8] transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#2A96A8]" />
            {scopeSummary}
          </button>

          <div className="flex items-center gap-2 text-xs text-[#092E3F]">
            <span className="text-[#6b828c]">Threshold</span>
            <input
              type="range" min={50} max={99} value={draft.confidenceThreshold}
              onChange={e => patchFlow({ confidenceThreshold: Number(e.target.value) })}
              className="w-24 accent-[#2A96A8]"
            />
            <span className="font-semibold w-9">{draft.confidenceThreshold}%</span>
            <span className="text-[#6b828c]">· risk ≥</span>
            <select
              value={draft.minRisk}
              onChange={e => patchFlow({ minRisk: e.target.value as RiskLevel })}
              className="border border-[#e5e9eb] rounded-[4px] px-1.5 py-1 text-xs bg-white focus:outline-none focus:border-[#2A96A8]"
            >
              {['Low', 'Medium', 'High'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Execution mode */}
          <div className="relative">
            <button
              onClick={() => setModeOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium border border-[#e5e9eb] hover:border-[#2A96A8] transition-colors ${EXECUTION_MODE_META[draft.executionMode].pillClass}`}
            >
              {EXECUTION_MODE_META[draft.executionMode].label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModeOpen(false)} />
                <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-[4px] shadow-xl border border-[#e5e9eb] py-1 z-50">
                  {(Object.keys(EXECUTION_MODE_META) as ExecutionMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { patchFlow({ executionMode: mode }); setModeOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-[#f6f6f6] transition-colors ${draft.executionMode === mode ? 'bg-[#e5f2f4]/60' : ''}`}
                    >
                      <span className={`inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold ${EXECUTION_MODE_META[mode].pillClass}`}>
                        {EXECUTION_MODE_META[mode].label}
                      </span>
                      <p className="text-[11px] text-[#6b828c] mt-1">{EXECUTION_MODE_META[mode].description}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

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
              <p className="text-[10px] font-semibold text-[#6b828c] uppercase tracking-widest">Block palette</p>
              <p className="text-[10px] text-[#87999f] mt-1">Drag blocks onto the canvas. Colour = impact tier.</p>
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
            <div className="flex items-center flex-wrap gap-y-6 max-w-full">
              {draft.nodes.map((node, i) => (
                <div key={node.id} className="flex items-center">
                  {i > 0 && <DropSlot index={i} onDropBlock={insertBlock} onMoveNode={moveNode} />}
                  <NodeCard
                    node={node}
                    index={i}
                    isSelected={selectedNodeId === node.id}
                    onSelect={() => setSelectedNodeId(node.id)}
                    onRemove={node.kind === 'trigger' ? undefined : () => removeNode(node.id)}
                  />
                </div>
              ))}
              {/* trailing drop zone */}
              <TrailingDrop
                index={draft.nodes.length}
                onDropBlock={insertBlock}
                onMoveNode={moveNode}
              />
            </div>

            <p className="text-[11px] text-[#87999f] mt-10">
              Click a block to configure it · drag from the palette to insert · drag a block's grip to reorder.
              The flow executes left to right.
            </p>
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
        {showScope && (
          <ScopeDrawer flow={draft} onPatchFlow={patchFlow} onClose={() => setShowScope(false)} />
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
        className={`w-[172px] h-[74px] rounded-[4px] border-2 border-dashed flex items-center justify-center transition-colors ${
          isOver ? 'border-[#2A96A8] bg-[#e5f2f4]' : canDrop ? 'border-[#2A96A8]/40 bg-white/60' : 'border-[#c4d2d6] bg-white/40'
        }`}
      >
        <p className="text-[11px] text-[#87999f]">Drop block here</p>
      </div>
    </div>
  );
}
