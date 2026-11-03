import { X, AlertTriangle, ShieldCheck, Clock, CircleSlash } from 'lucide-react';
import { TRIGGER_BY_ID, CONDITION_BY_ID, type Flow } from './flowRegister';
import { backtest, ACTION_LABEL, type Backtest } from './flowBacktest';
import { meansAll } from './MultiSelect';
import { TENANTS } from './tenants';

// ─── Review before turning on ────────────────────────────────────────────────
//
// Switching on an automation is the one irreversible-feeling step in this
// whole builder: from the click onward it acts on customers without being
// asked again. So before it does, the draft is replayed over the last 30 days
// and the result is put in front of the person deciding.
//
// The first version of this dialog showed everything it knew at the same
// weight — the rule as a sentence, a paragraph of arithmetic, a tinted table,
// a tinted note, three examples and a footnote explaining the button. Nobody
// could tell which part was the answer. This one is built around a single
// question, "is it safe to switch on?", and reads top to bottom in the order
// someone needs it:
//
//   1. the answer       — one status line: blocked, risky, or fine. It is the
//                         only coloured thing in the dialog, so it is the first
//                         thing read.
//   2. the evidence     — three numbers, then each action with its count.
//   3. the rule         — When / If / Then, the same three parts as the
//                         builder's columns, quiet, for checking.
//   4. examples         — three real incidents, for spot-checking the count.
//
// The button follows Noise Reduction in production, whose confirm says "Turn
// on Noise Reduction": it names what pressing it does ("Turn on automation"),
// so there is no footnote explaining it.
//
// Blockers disable the button; risks do not. A flow that is wrong (no actions,
// an empty condition, nothing would ever match) cannot be turned on. A flow that
// is merely risky can — a user who has read the number and still wants it is
// allowed to have it.

interface Props {
  flow: Flow;
  /** Already running — confirming changes it rather than starting it. */
  alreadyLive: boolean;
  /** The confirm button. Names the act — "Turn on automation". */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

const LABEL = 'text-[10px] font-medium uppercase tracking-wide text-[#87999f]';

export default function FlowReview({ flow, alreadyLive, confirmLabel, onConfirm, onClose }: Props) {
  const b = backtest(flow);
  const blocked = b.blockers.length > 0;
  const approver = flow.conditions.find(c => c.id === 'approval' && c.value)?.value;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#092E3F]/40" onClick={onClose} />

      <div className="relative w-full max-w-[640px] max-h-full flex flex-col bg-white rounded-[8px] shadow-2xl overflow-hidden">

        {/* ── head ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--stroke)]">
          <div className="min-w-0">
            <h2 className="text-lg text-[#092E3F]">
              {alreadyLive ? 'Review changes to a live automation' : 'Review before turning on'}
            </h2>
            <p className="text-sm text-[#6b828c] mt-0.5 truncate">{flow.name?.trim() || 'Untitled'}</p>
          </div>
          <button
            onClick={onClose}
            title="Cancel"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] text-[#87999f]
                       hover:bg-[#f1f4f5] hover:text-[#092E3F] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── 1. the answer ───────────────────────────────────────────── */}
          <Verdict b={b} approver={approver} />

          {/* ── 2. the evidence ─────────────────────────────────────────── */}
          {b.matched > 0 && (
            <section>
              <p className={`${LABEL} mb-2`}>Last 30 days, if it had been on</p>
              <div className="grid grid-cols-3 border border-[var(--stroke)] rounded-[8px] divide-x divide-[var(--stroke)]">
                <Stat value={b.matched.toLocaleString()} label={b.isScheduled ? 'runs' : 'alerts matched'} />
                <Stat value={String(b.tenants)} label={b.tenants === 1 ? 'customer' : 'customers'} />
                <Stat value={b.perDay < 1 ? '<1' : String(Math.round(b.perDay))} label="per day" />
              </div>

              {b.actions.length > 0 && (
                <div className="mt-3">
                  {b.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
                      <span className="text-sm text-[#092E3F] flex-1 min-w-0 truncate">{ACTION_LABEL(a)}</span>
                      <span className="text-sm text-[#5c707a] tabular-nums shrink-0">{a.phrase}</span>
                      {a.changesCustomerSystems && (
                        a.held > 0
                          ? <Tag icon={Clock}>Waits for approval</Tag>
                          : <Tag icon={AlertTriangle} warn>No approval</Tag>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 3. the rule ─────────────────────────────────────────────── */}
          <section>
            <p className={`${LABEL} mb-2`}>{alreadyLive ? 'What it will do from now on' : 'What you are turning on'}</p>
            <dl className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-[#87999f]">For</dt>
              <dd className={forOf(flow) ? 'text-[#092E3F]' : 'text-[#87999f]'}>{forOf(flow) ?? 'No customers chosen'}</dd>
              <dt className="text-[#87999f]">When</dt>
              <dd className="text-[#092E3F]">{whenOf(flow)}</dd>
              <dt className="text-[#87999f]">If</dt>
              <dd className="text-[#092E3F]">{ifOf(flow)}</dd>
              <dt className="text-[#87999f]">Then</dt>
              <dd className="text-[#092E3F]">{flow.actions.length ? b.actions.map(ACTION_LABEL).join(', ') : '—'}</dd>
            </dl>
          </section>

          {/* ── 4. examples ─────────────────────────────────────────────── */}
          {b.samples.length > 0 && (
            <section>
              <p className={`${LABEL} mb-2`}>{b.isScheduled ? 'Recent runs' : 'Examples it would have caught'}</p>
              {b.samples.map((s, i) => (
                <div key={i} className="flex items-baseline gap-3 py-1.5 text-sm">
                  <span className="text-[#092E3F] w-[88px] shrink-0 truncate">{s.tenant}</span>
                  <span className="text-[#6b828c] min-w-0 flex-1 truncate">{s.what}</span>
                  <span className="text-xs text-[#87999f] shrink-0 tabular-nums">{s.when}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* ── the way out ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--stroke)]">
          <button
            onClick={onClose}
            className="h-9 px-5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                       hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={blocked}
            className="h-9 px-5 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                       hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── the answer ──────────────────────────────────────────────────────────────
// One line, one colour, picked from the worst thing true about the flow.
// Blocked beats risky beats fine; only the winner is shown, so the dialog
// never asks someone to weigh three notes against each other.

function Verdict({ b, approver }: { b: Backtest; approver?: string }) {
  const changes = b.actions.some(a => a.changesCustomerSystems);
  const loud = !b.isScheduled && b.matched > 600;

  if (b.blockers.length > 0) {
    return (
      <Banner tone="block" icon={CircleSlash} title="This can't be turned on yet">
        {b.blockers.length === 1 ? b.blockers[0] : (
          <ul className="list-disc pl-4 space-y-0.5">{b.blockers.map((t, i) => <li key={i}>{t}</li>)}</ul>
        )}
      </Banner>
    );
  }

  if (b.unheldChanges > 0) {
    return (
      <Banner tone="warn" icon={AlertTriangle}
        title={`${b.unheldChanges.toLocaleString()} changes to customer systems with no approval`}>
        Nobody would have checked these first. Add an Approval condition if a person should.
      </Banner>
    );
  }

  const title = changes
    ? `Every change waits for ${approver ? approver.charAt(0).toLowerCase() + approver.slice(1) : 'approval'}`
    : 'Nothing changes in customer systems';
  const body = changes
    ? 'Nothing in a customer environment changes until someone approves it.'
    : 'Everything it does stays inside Seculyze and Sentinel.';

  return (
    <Banner tone="ok" icon={ShieldCheck} title={title}>
      {body}
      {loud && ` At about ${Math.round(b.perDay)} a day it will be one of the busiest automations — consider narrowing it.`}
    </Banner>
  );
}

const TONE = {
  block: 'bg-[#fdeceb] text-[#c2453d]',
  warn: 'bg-[#fdf6e9] text-[#c07d1e]',
  ok: 'bg-[#eaf4ee] text-[#2f7d52]',
};

function Banner({ tone, icon: Icon, title, children }: {
  tone: keyof typeof TONE; icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-[8px] bg-[#f8fafb] border border-[var(--stroke)]">
      <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] ${TONE[tone]}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#092E3F]">{title}</p>
        <div className="text-sm text-[#5c707a] leading-5 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xl font-semibold text-[#092E3F] tabular-nums">{value}</p>
      <p className="text-xs text-[#6b828c]">{label}</p>
    </div>
  );
}

function Tag({ icon: Icon, warn, children }: { icon: React.ElementType; warn?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] shrink-0 ${
      warn ? 'bg-[#fdf6e9] text-[#c07d1e]' : 'bg-[#eef1f3] text-[#5c707a]'
    }`}>
      <Icon className="w-3 h-3" />{children}
    </span>
  );
}

// ─── the rule, in the builder's three parts ──────────────────────────────────

function whenOf(f: Flow): string {
  if (!f.trigger) return '—';
  return TRIGGER_BY_ID[f.trigger].name + (f.triggerParam ? ` (${f.triggerParam})` : '');
}

/** Who it runs for. Its own row, because it always applies — never "or". */
function forOf(f: Flow): string | null {
  const c = f.conditions.find(x => x.id === 'customers' && x.value.trim());
  if (!c) return null;
  const who = meansAll(c.value) ? `All ${TENANTS.length} customers` : c.value;
  return c.operator === 'is not one of' ? `Every customer except ${c.value}` : who;
}

function ifOf(f: Flow): string {
  const cs = f.conditions
    .filter(c => c.value && c.id !== 'customers')
    .map(c => `${CONDITION_BY_ID[c.id].name} ${c.operator} ${c.value}`);
  if (cs.length === 0) return 'Always — no conditions';
  return cs.join(f.matchAll ? ' and ' : ' or ');
}
