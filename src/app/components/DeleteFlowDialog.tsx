import { useState } from 'react';
import { Trash2, AlertTriangle, Power } from 'lucide-react';
import { actionsLogged } from './flowRuns';
import { type Flow } from './flowRegister';

// ─── deleting an automation ──────────────────────────────────────────────────
//
// There was no way to delete one at all, which is its own kind of wrong: a
// console you can only add to fills up with half-built drafts nobody dares
// touch. But the opposite is worse, so this is not a menu item that fires on
// one click next to Clone.
//
// Two things make it heavier than the usual confirm:
//
//   A live one gets stopped first. Deleting something that is acting on
//   customer systems right now, in a single step, is not a decision anyone
//   should be able to take by mis-clicking. Turn it off, watch nothing break,
//   then delete it — and the dialog offers that as the easier path.
//
//   The history is named. Deleting a flow that has done 214 things to real
//   tenants is a different act from deleting an empty draft, and the only way
//   to know which one you are doing is to be told. The runs stay in the audit
//   log afterwards, which is also worth saying: an automation being gone must
//   never quietly take the record of what it did with it.
//
// Typing the name is deliberately not asked for. That ritual is for things
// that cannot be undone and cannot be rebuilt; a flow is ten minutes of work
// and its history survives, so the cost of the ceremony outweighs the mistake
// it prevents.

export default function DeleteFlowDialog({ flow, onCancel, onConfirm, onTurnOff }: {
  flow: Flow;
  onCancel: () => void;
  onConfirm: () => void;
  /** Stops it without deleting — the safer half of the decision. */
  onTurnOff: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const logged = actionsLogged(flow.name);
  const live = flow.isActive;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#092E3F]/40" onClick={onCancel} />

      <div className="relative w-full max-w-[440px] bg-white rounded-[8px] shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-[#fdeceb]">
              <Trash2 className="w-4 h-4 text-[#c2453d]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-medium text-[#092E3F]">Delete this automation?</h2>
              <p className="text-sm text-[#6b828c] mt-0.5 break-words">{flow.name}</p>
            </div>
          </div>

          {/* What is actually being thrown away, in numbers rather than in a
              word like "permanently". */}
          <div className="mt-4 border border-[var(--stroke)] rounded-[8px] overflow-hidden">
            <Row label="Status">
              {live
                ? <span className="text-[#c07d1e]">Running now</span>
                : <span className="text-[#6b828c]">Not running</span>}
            </Row>
            <Row label="Runs, 30 days">{flow.runs30d ?? 0}</Row>
            <Row label="Actions on record">{logged}</Row>
          </div>

          {logged > 0 && (
            <p className="text-[11px] text-[#87999f] mt-2">
              Its {logged} recorded action{logged === 1 ? '' : 's'} stay in the audit log. Deleting the
              automation does not delete what it did.
            </p>
          )}

          {live && (
            <div className="mt-4 px-3 py-2.5 rounded-[8px] bg-[#fdf6e9] border border-[#f0dfbe]">
              <p className="flex items-start gap-2 text-xs text-[#c07d1e] leading-5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  This automation is running and will act on the next matching alert. Turning it off
                  first lets you see what stops happening before you throw it away.
                </span>
              </p>
              <button
                onClick={onTurnOff}
                className="flex items-center gap-1.5 mt-2.5 h-8 px-3 bg-white border border-[#f0dfbe]
                           rounded-[8px] text-xs font-medium text-[#c07d1e] hover:bg-[#fdf6e9] transition-colors"
              >
                <Power className="w-3.5 h-3.5" />Turn it off instead
              </button>
            </div>
          )}

          {/* The deliberate step. On a live flow it is the only thing standing
              between a stray click and an automation disappearing mid-shift. */}
          {live && (
            <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5 shrink-0 accent-[#c2453d]"
              />
              <span className="text-xs text-[#092E3F] leading-5">
                I understand this is running now, and deleting it stops it for every customer it covers.
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--stroke)] bg-[#fbfcfd]">
          <button
            onClick={onCancel}
            className="h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                       hover:border-[#2A96A8] transition-colors"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={live && !acknowledged}
            className="h-9 px-4 rounded-[8px] text-sm font-medium bg-[#c2453d] text-white
                       hover:bg-[#a83a33] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-[11px] text-[#87999f] w-[104px] shrink-0">{label}</span>
      <span className="text-sm text-[#092E3F] tabular-nums">{children}</span>
    </div>
  );
}
