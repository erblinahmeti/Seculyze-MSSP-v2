import { Power, AlertTriangle } from 'lucide-react';
import { ACTION_BY_ID, actionChangesCustomerSystems, type Flow } from './flowRegister';

// ─── before an automation stops ──────────────────────────────────────────────
//
// Turning one off is not destruction — nothing is lost, and switching it back
// on takes a click. What it is, is silent: the automation simply stops, and
// the customers it covered carry on with one fewer safeguard until somebody
// notices. That is the case for asking first, and it is the reason this
// dialog's job is to name what stops rather than to say "are you sure".
//
// So it lists the actions that will no longer happen, says plainly that
// nothing will reach the customers it covers, and counts the runs it has made
// — a flow that fired 214 times last month is a different thing to switch off
// from one that has never run.

export default function ConfirmStopDialog({ flow, alsoSaving, onCancel, onConfirm }: {
  flow: Flow;
  /** The stop is part of a save, so the edits land as well. */
  alsoSaving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const changing = flow.actions.filter(a => actionChangesCustomerSystems(a));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#092E3F]/40" onClick={onCancel} />

      <div className="relative w-full max-w-[420px] bg-white rounded-[8px] shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] bg-[#fdf6e9]">
              <Power className="w-4 h-4 text-[#c07d1e]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-medium text-[#092E3F]">Turn this automation off?</h2>
              <p className="text-sm text-[#6b828c] mt-0.5 break-words">{flow.name}</p>
            </div>
          </div>

          <p className="text-sm text-[#092E3F] leading-6 mt-4">
            It stops acting on new alerts straight away. Nothing already done is undone, and you can
            switch it back on whenever you want.
          </p>

          {/* What stops happening, by name — "are you sure" tells nobody anything. */}
          {flow.actions.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mb-1.5">
                What stops happening
              </p>
              <ul className="space-y-1">
                {flow.actions.map(a => (
                  <li key={a.key} className="flex items-baseline gap-2 text-xs">
                    <span className="w-1 h-1 rounded-full bg-[#c9d6dc] shrink-0 translate-y-[-2px]" />
                    <span className="text-[#092E3F]">{ACTION_BY_ID[a.action].name}</span>
                    {actionChangesCustomerSystems(a) && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#c07d1e]">
                        customer systems
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changing.length > 0 && (
            <p className="flex items-start gap-2 mt-3 text-xs leading-5 text-[#c07d1e]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {changing.length === 1 ? 'This one reaches' : `${changing.length} of these reach`} into
                customer environments. Until it is back on, that containment is manual.
              </span>
            </p>
          )}

          <p className="text-[11px] text-[#87999f] mt-3">
            {flow.runs30d
              ? `It has run ${flow.runs30d} time${flow.runs30d === 1 ? '' : 's'} in the last 30 days.`
              : 'It has not run in the last 30 days.'}
            {alsoSaving && ' Your changes are saved either way.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--stroke)] bg-[#fbfcfd]">
          <button
            onClick={onCancel}
            className="h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                       hover:border-[#2A96A8] transition-colors"
          >
            Keep it running
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-sm font-medium
                       bg-[#c07d1e] text-white hover:bg-[#a86c19] transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            {alsoSaving ? 'Save and turn off' : 'Turn off'}
          </button>
        </div>
      </div>
    </div>
  );
}
