import { useState } from 'react';
import { AlertTriangle, Pencil, Power, Undo2 } from 'lucide-react';

// ─── Flow status ─────────────────────────────────────────────────────────────
//
// The flows list says Active or Draft; the builder said nothing. So you could
// open an automation that is isolating devices right now, change what it does,
// and never be told it was live — the one fact that decides how carefully you
// edit.
//
// Three states, because "not live" covers two different situations and they
// need different words:
//
//   New      never saved. Nothing is running.
//   Draft    saved but switched off. Edits are free.
//   Live     running. Edits land on a flow that is acting on customer
//            systems, so this one says so out loud rather than relying on a
//            green dot being noticed.
//
// This is a *report*, not a control. It used to carry an Enabled switch, which
// put the decision in two places at once: you set the switch here, then pressed
// a Save button whose only job was to describe what the switch said. Now the
// save buttons below own the decision, and this says where things stand.

interface Props {
  /** Never saved — there is nothing running to describe. */
  isNew: boolean;
  /** Whether the saved flow is running right now. */
  isActive: boolean;
}

export default function FlowStatus({ isNew, isActive }: Props) {
  const label = isNew ? 'New' : isActive ? 'Live' : 'Draft';
  const tone = isActive
    ? 'bg-[#e3f0e8] text-[#2f7d52]'
    : isNew
      ? 'bg-[#eef1f3] text-[#5c707a]'
      : 'bg-[#f7efdf] text-[#c07d1e]';

  return (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      {/* Editing something that is already running is worth a sentence, not a
          colour someone has to decode. */}
      {isActive && (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#c07d1e]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          This automation is running — changes apply when you save
        </span>
      )}

      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-xs font-medium ${tone}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#2f7d52]' : isNew ? 'bg-[#b7c4c9]' : 'bg-[#c07d1e]'}`} />
        {label}
      </span>
    </div>
  );
}

// ─── the way out ─────────────────────────────────────────────────────────────
//
// One "Save automation" button named the mechanism and left the consequence to
// be guessed: does pressing it put this thing into service, or park it? That
// doubt is worst exactly where it matters — a flow that isolates devices.
//
// Making one label follow a switch elsewhere on screen was no better. You still
// had to look in two places and hold both in your head.
//
// So the choice *is* the button. Two of them, each naming its own outcome, and
// nothing to reconcile:
//
//   not live yet   Save as draft  ·  Save and set live
//   already live   Save and turn off  ·  Save changes
//
// Set live is the filled one while a flow is parked, because putting a finished
// automation into service is what you came here to do. Once it is running, Save
// changes takes the fill and turning it off steps back to outline — standing
// down a working automation should be the deliberate click, not the easy one.

export function SaveActions({ isLive, disabled, onSave }: {
  /** Whether the saved flow is running right now. */
  isLive: boolean;
  disabled: boolean;
  /** true saves it running, false saves it parked. */
  onSave: (live: boolean) => void;
}) {
  const OUTLINE = `h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                   hover:border-[#2A96A8] transition-colors disabled:opacity-40 disabled:pointer-events-none`;
  const FILLED = `h-9 px-4 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                  hover:bg-[#1e7d8f] transition-colors disabled:opacity-40 disabled:pointer-events-none`;

  return isLive ? (
    <>
      <button
        onClick={() => onSave(false)}
        disabled={disabled}
        title="Save, and stop it running"
        className={OUTLINE}
      >
        Save and turn off
      </button>
      <button
        onClick={() => onSave(true)}
        disabled={disabled}
        title="Save — it keeps running, with these changes"
        className={FILLED}
      >
        Save changes
      </button>
    </>
  ) : (
    <>
      <button
        onClick={() => onSave(false)}
        disabled={disabled}
        title="Save it without running it — nothing happens until you set it live"
        className={OUTLINE}
      >
        Save as draft
      </button>
      <button
        onClick={() => onSave(true)}
        disabled={disabled}
        title="Save it and start running it on live alerts"
        className={FILLED}
      >
        Save and set live
      </button>
    </>
  );
}

// ─── looking, not editing ────────────────────────────────────────────────────
//
// Opening a saved flow used to drop you straight into an editable form with
// both save buttons live, before you had touched anything. On a flow that is
// isolating devices right now that is the wrong default twice over: it invites
// a stray keystroke into something running, and it makes "Save" meaningless by
// offering it when there is nothing to save.
//
// So a saved flow opens as a record of itself. Edit unlocks it. Turning it on
// or off is not editing — it changes no content — so those stay available
// without unlocking anything.

export function ViewActions({ isLive, onEdit, onSetLive, onTurnOff }: {
  isLive: boolean;
  onEdit: () => void;
  onSetLive: () => void;
  onTurnOff: () => void;
}) {
  const OUTLINE = `flex items-center gap-2 h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px]
                   text-sm text-[#092E3F] hover:border-[#2A96A8] transition-colors`;

  return (
    <>
      <button onClick={onEdit} title="Unlock it and change what it does" className={OUTLINE}>
        <Pencil className="w-4 h-4" />Edit
      </button>
      {isLive ? (
        <button
          onClick={onTurnOff}
          title="Stop it running — the flow and its history stay"
          className="flex items-center gap-2 h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px]
                     text-sm text-[#092E3F] hover:border-[#c07d1e] hover:text-[#c07d1e] transition-colors"
        >
          <Power className="w-4 h-4" />Turn off
        </button>
      ) : (
        <button
          onClick={onSetLive}
          title="Review it, then start running it on live alerts"
          className="h-9 px-4 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium
                     hover:bg-[#1e7d8f] transition-colors"
        >
          Set live
        </button>
      )}
    </>
  );
}

// ─── backing out of an edit ──────────────────────────────────────────────────
//
// Cancel used to mean "leave the page", which is a strange thing to offer
// someone who has just pressed Edit: changing your mind about editing is not
// the same as changing your mind about looking. Leaving already has its own
// door — Back to flows, at the top — so here Cancel undoes the unlocking and
// puts the flow back the way it was found.
//
// With nothing changed that is a plain Cancel and it happens at once. With
// work on screen it asks first, in place rather than in a dialog: a dialog for
// a two-word question is heavier than the question, and an undo that fires on
// one click is how people lose ten minutes of work.

export function CancelEdit({ dirty, onCancel }: { dirty: boolean; onCancel: () => void }) {
  const [asking, setAsking] = useState(false);

  const OUTLINE = `h-9 px-4 bg-white border border-[var(--stroke)] rounded-[8px] text-sm text-[#092E3F]
                   hover:border-[#2A96A8] transition-colors`;

  if (!dirty) {
    return (
      <button onClick={onCancel} title="Stop editing — nothing has changed" className={OUTLINE}>
        Cancel
      </button>
    );
  }

  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        title="Put it back the way you found it"
        className={`flex items-center gap-2 ${OUTLINE}`}
      >
        <Undo2 className="w-4 h-4" />Discard changes
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-[#c07d1e]">Discard your edits?</span>
      <button onClick={() => setAsking(false)} className={OUTLINE}>
        Keep editing
      </button>
      <button
        onClick={() => { setAsking(false); onCancel(); }}
        className="h-9 px-4 rounded-[8px] text-sm font-medium bg-[#f7efdf] text-[#c07d1e]
                   border border-[#f0dfbe] hover:bg-[#f3e5c9] transition-colors"
      >
        Discard
      </button>
    </span>
  );
}
