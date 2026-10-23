import { X, AlertTriangle, ShieldAlert, Check, Clock } from 'lucide-react';
import { describe, TRIGGER_BY_ID, type Flow } from './flowRegister';
import { backtest, verdict, ACTION_LABEL } from './flowBacktest';

// ─── Review before it goes live ──────────────────────────────────────────────
//
// Switching on an automation is the one irreversible-feeling step in this
// whole builder: from the click onward it acts on customers without being
// asked again. Everything up to here is a form, and a form cannot tell you
// whether what you have built is sane.
//
// "Test on last 30 days" was the previous attempt and it asked the wrong
// question — it would have told you the flow executes. Nobody doubts that. The
// question is what it is going to do, and history answers it: replay the draft
// over the last 30 days and count.
//
// So this is where going live is decided. Review is the forward button in the
// builder and it commits nothing on its own — it opens the numbers, and the
// decision is taken here, in front of them, rather than in front of a form.
// Three things in order:
//
//   1. the flow in a sentence       — the plain-English line used to sit in a
//                                     strip at the bottom of the builder, where
//                                     it was decoration. Here it is the thing
//                                     being agreed to, so it moved.
//   2. what it would have done      — one headline number, then each action
//                                     with its own count, destructive ones
//                                     marked, approval-held ones separated.
//   3. a few named incidents        — because a count is only believable if
//                                     you can go and check three of them.
//
// Blockers disable the button; notes do not. The difference is whether the
// flow is wrong (no actions, a condition with no value, nothing would ever
// match) or merely worth reading (it is loud, or it changes customer systems
// with nobody watching). We do not block on the second kind: a user who has
// read the number and still wants it is allowed to have it.

interface Props {
  flow: Flow;
  /** Already running — confirming changes it rather than starting it. */
  alreadyLive: boolean;
  /** The label for the confirm button — what pressing it actually does. */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function FlowReview({ flow, alreadyLive, confirmLabel, onConfirm, onClose }: Props) {
  const b = backtest(flow);
  const name = flow.trigger ? describe(flow).replace(/^When /, '') : '';
  const blocked = b.blockers.length > 0;

  const changing = b.actions.filter(a => a.changesCustomerSystems);
  const quiet = b.actions.filter(a => !a.changesCustomerSystems);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#092E3F]/40" onClick={onClose} />

      <div className="relative w-full max-w-[720px] max-h-full flex flex-col bg-white rounded-[8px] shadow-2xl overflow-hidden">

        {/* ── head ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--stroke)]">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-[#092E3F]">
              {alreadyLive ? 'Review the changes' : 'Review before it goes live'}
            </h2>
            <p className="text-xs text-[#6b828c] mt-0.5">
              {flow.name?.trim() || 'Untitled'} — replayed against the last 30 days
            </p>
          </div>
          <button
            onClick={onClose}
            title="Back to editing"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] text-[#87999f]
                       hover:bg-[#f1f4f5] hover:text-[#092E3F] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── 1. the flow, in a sentence ──────────────────────────────── */}
          <section>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
              {alreadyLive ? 'What it will do from now on' : 'What you are switching on'}
            </p>
            <p className="text-sm text-[#092E3F] leading-6 px-4 py-3 rounded-[8px] bg-[#f8fdfe] border border-[#d9edf1]">
              When {name}
            </p>
          </section>

          {/* ── 2. what it would have done ──────────────────────────────── */}
          <section>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
              If it had been live
            </p>
            <p className="text-sm text-[#092E3F] leading-6">
              {verdict(b, flow.trigger ? TRIGGER_BY_ID[flow.trigger].name : '')}
            </p>

            {b.actions.length > 0 && b.matched > 0 && (
              <div className="mt-3 border border-[var(--stroke)] rounded-[8px] overflow-hidden">
                {changing.length > 0 && (
                  <div className="px-4 py-2 bg-[#fdf6e9] border-b border-[#f0dfbe]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#c07d1e]">
                      Reaches into customer systems
                    </p>
                  </div>
                )}
                {changing.map((a, i) => (
                  <Row key={`c${i}`} label={ACTION_LABEL(a)} phrase={a.phrase} held={a.held} danger />
                ))}
                {quiet.length > 0 && changing.length > 0 && (
                  <div className="px-4 py-2 bg-[#fafbfb] border-y border-[var(--stroke)]">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#87999f]">
                      Stays inside Seculyze and Sentinel
                    </p>
                  </div>
                )}
                {quiet.map((a, i) => (
                  <Row key={`q${i}`} label={ACTION_LABEL(a)} phrase={a.phrase} held={a.held} />
                ))}
              </div>
            )}
          </section>

          {/* ── the things worth reading ────────────────────────────────── */}
          {(b.blockers.length > 0 || b.notes.length > 0) && (
            <section className="space-y-2">
              {b.blockers.map((t, i) => (
                <Line key={`b${i}`} icon={AlertTriangle} text={t} tone="block" />
              ))}
              {b.notes.map((t, i) => (
                <Line key={`n${i}`} icon={ShieldAlert} text={t} tone="note" />
              ))}
            </section>
          )}

          {/* ── 3. go and check three of them ───────────────────────────── */}
          {b.samples.length > 0 && (
            <section>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
                {b.isScheduled ? 'The last few runs it would have made' : 'Three it would have caught'}
              </p>
              <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden">
                {b.samples.map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-baseline gap-3 px-4 py-2.5 text-sm ${
                      i > 0 ? 'border-t border-gray-100' : ''
                    }`}
                  >
                    <span className="text-[#092E3F] shrink-0">{s.tenant}</span>
                    <span className="text-[#6b828c] min-w-0 flex-1 truncate">{s.what}</span>
                    <span className="text-xs text-[#87999f] shrink-0">{s.ref}</span>
                    <span className="text-xs text-[#87999f] shrink-0 tabular-nums">{s.when}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#87999f] mt-1.5">
                Sampled from the matches — open any of them to see why it matched.
              </p>
            </section>
          )}
        </div>

        {/* ── the way out ──────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--stroke)] bg-[#fbfcfd]">
          <p className="text-[11px] text-[#87999f]">
            {blocked
              ? `Fix the above before this can ${alreadyLive ? 'be saved' : 'run'}.`
              : alreadyLive
                ? 'These changes reach live alerts as soon as you confirm.'
                : 'Running it saves it and starts it on live alerts.'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                         hover:border-[#2A96A8] transition-colors"
            >
              Back to editing
            </button>
            <button
              onClick={onConfirm}
              disabled={blocked}
              className="h-9 px-4 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                         hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One action and what it would have done, with the held-for-approval split. */
function Row({ label, phrase, held, danger }: {
  label: string; phrase: string; held: number; danger?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-[#092E3F] w-[200px] shrink-0 truncate">{label}</span>
      <span className={`text-sm flex-1 min-w-0 ${danger ? 'text-[#c07d1e]' : 'text-[#6b828c]'}`}>
        {phrase}
      </span>
      {held > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-[#6b828c] shrink-0">
          <Clock className="w-3 h-3" />
          waits for approval
        </span>
      )}
      {held === 0 && !danger && <Check className="w-3.5 h-3.5 text-[#b7c4c9] shrink-0" />}
    </div>
  );
}

function Line({ icon: Icon, text, tone }: { icon: any; text: string; tone: 'block' | 'note' }) {
  const skin = tone === 'block'
    ? 'bg-[#fdeceb] border-[#f3cfcc] text-[#c2453d]'
    : 'bg-[#fdf6e9] border-[#f0dfbe] text-[#8a6418]';
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-[8px] border text-xs leading-5 ${skin}`}>
      <Icon className="w-4 h-4 shrink-0 mt-px" />
      <span>{text}</span>
    </div>
  );
}
