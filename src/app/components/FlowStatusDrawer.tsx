import { useMemo } from 'react';
import { ScrollText, Power, CircleDot } from 'lucide-react';
import SidePanel from './SidePanel';
import { RUNS, OUTCOME_LABEL, fmtWhen, fmtDuration, type RunOutcome } from './flowRuns';
import { type Flow } from './flowRegister';

// ─── The Active stage ────────────────────────────────────────────────────────
//
// The third stage of a flow's life is the one that lasts: it is running, and
// from here on the question is not "what does it do" but "what has it been
// doing". That is a different kind of looking, and it does not deserve a
// screen of its own — you are usually checking on a flow *while* editing
// another one, and a full page throws away the thing you were in the middle
// of.
//
// So it is a drawer, and a pinnable one, which means it can stay open beside
// the builder for as long as it is useful. Four things, in the order someone
// asks for them:
//
//   is it on           — and the way to turn it off, since that is what you
//                        came to do if the answer is "yes, and it should not be"
//   how much           — runs in the last 30 days, and when it last went off
//   how it went        — the outcome split, because 40 runs of which 9 failed
//                        is a different flow from 40 that all worked
//   what it did        — the last few runs by name, then a way through to the
//                        full audit when the drawer is not enough
//
// Nothing here is editable except the switch. This is the report; the designer
// behind it is where things change.

const TONE: Record<RunOutcome, string> = {
  succeeded: 'bg-[#e3f0e8] text-[#2f7d52]',
  partial: 'bg-[#f7efdf] text-[#c07d1e]',
  failed: 'bg-[#f7e6e4] text-[#c2453d]',
  'awaiting-approval': 'bg-[#eef1f3] text-[#5c707a]',
  cancelled: 'bg-[#eef1f3] text-[#5c707a]',
};

interface Props {
  flow: Flow;
  open: boolean;
  onClose: () => void;
  /** Turns it off without leaving the drawer — saves immediately. */
  onTurnOff?: () => void;
  /** Through to the audit log, scoped to this flow. */
  onAuditLog?: () => void;
}

export default function FlowStatusDrawer({ flow, open, onClose, onTurnOff, onAuditLog }: Props) {
  const runs = useMemo(
    () => RUNS.filter(r => r.flowName === flow.name).slice(0, 6),
    [flow.name],
  );

  const tally = useMemo(() => {
    const all = RUNS.filter(r => r.flowName === flow.name);
    const by = {} as Record<RunOutcome, number>;
    for (const r of all) by[r.outcome] = (by[r.outcome] ?? 0) + 1;
    return { total: all.length, by };
  }, [flow.name]);

  return (
    <SidePanel
      id="flow-status"
      open={open}
      onClose={onClose}
      width={460}
      header={
        <>
          <p className="text-sm font-medium text-white truncate">{flow.name || 'Untitled'}</p>
          <p className="text-xs text-white/60">{flow.isActive ? 'Running' : 'Not running'}</p>
        </>
      }
    >
      <div className="p-5 space-y-5">

        {/* ── is it on ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[8px] border border-[var(--stroke)] bg-white">
          <span className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${flow.isActive ? 'bg-[#2f7d52]' : 'bg-[#b7c4c9]'}`} />
            <span className="text-sm text-[#092E3F]">
              {flow.isActive ? 'Live on every matching alert' : 'Parked — nothing is running'}
            </span>
          </span>
          {flow.isActive && onTurnOff && (
            <button
              onClick={onTurnOff}
              title="Stop it running — the flow and its history stay"
              className="flex items-center gap-1.5 h-8 px-3 shrink-0 bg-white border border-[var(--stroke)]
                         rounded-[8px] text-xs text-[#092E3F] hover:border-[#c07d1e] hover:text-[#c07d1e]
                         transition-colors"
            >
              <Power className="w-3.5 h-3.5" />Turn off
            </button>
          )}
        </div>

        {/* ── how much ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Runs, last 30 days" value={flow.runs30d ?? tally.total} />
          <Stat label="Last run" value={flow.lastRun ?? (runs[0] ? fmtWhen(runs[0].startedAt) : '—')} small />
        </div>

        {/* ── how it went ──────────────────────────────────────────────── */}
        {tally.total > 0 && (
          <section>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">How it went</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(tally.by) as RunOutcome[]).map(o => (
                <span key={o} className={`px-2 py-1 rounded-[8px] text-xs font-medium ${TONE[o]}`}>
                  {tally.by[o]} {OUTCOME_LABEL[o].toLowerCase()}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── what it did ──────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
            {runs.length ? 'Most recent runs' : 'Runs'}
          </p>

          {runs.length === 0 ? (
            <p className="text-xs text-[#87999f] px-4 py-6 text-center border border-dashed border-[var(--stroke)] rounded-[8px]">
              {flow.isActive
                ? 'Nothing yet — it has not matched anything since it went live.'
                : 'It has never run.'}
            </p>
          ) : (
            <div className="border border-[var(--stroke)] rounded-[8px] overflow-hidden bg-white">
              {runs.map((r, i) => (
                <div key={r.id} className={`px-4 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <CircleDot className="w-3 h-3 shrink-0 text-[#c9d6dc] translate-y-0.5" />
                    <span className="text-sm text-[#092E3F] min-w-0 flex-1 truncate">{r.tenant}</span>
                    <span className={`px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium shrink-0 ${TONE[r.outcome]}`}>
                      {OUTCOME_LABEL[r.outcome]}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#87999f] mt-0.5 ml-5">
                    {r.sourceRef} · {fmtWhen(r.startedAt)} · {fmtDuration(r.durationMs)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {onAuditLog && (
            <button
              onClick={onAuditLog}
              className="flex items-center gap-2 mt-3 h-9 px-3 w-full justify-center bg-white
                         border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                         hover:border-[#2A96A8] transition-colors"
            >
              <ScrollText className="w-4 h-4" />
              Every action it has taken
            </button>
          )}
        </section>
      </div>
    </SidePanel>
  );
}

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className="px-4 py-3 rounded-[8px] border border-[var(--stroke)] bg-white">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f]">{label}</p>
      <p className={`text-[#092E3F] mt-0.5 ${small ? 'text-sm' : 'text-xl tabular-nums'}`}>{value}</p>
    </div>
  );
}
