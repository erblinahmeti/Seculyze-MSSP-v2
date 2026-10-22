import { Lock, Pencil } from 'lucide-react';

// ─── viewing or editing ──────────────────────────────────────────────────────
//
// Pressing Edit unlocked the form and almost nothing on screen said so: the
// fields had looked like fields the whole time, so the only difference was
// which buttons sat in the corner. A mode you cannot see is a mode you forget
// you are in, and the two mistakes it causes are opposite and both bad —
// typing into a flow you thought you were only reading, and reading a flow you
// have already half-changed.
//
// So the mode is stated, in the same place in both states, and it is the same
// strip that changes rather than one appearing and another vanishing. A strip
// that swaps its colour and its sentence in place is a change you notice; one
// that only appears is something you scroll past.
//
// It pairs with the fields themselves: locked, they drop their borders and
// backgrounds and read as the sentences they are. Unlocked, they look like
// controls again. Between the two there is no moment where the page looks the
// same as it did before.

interface Props {
  editing: boolean;
  /** Something has actually changed — worth saying out loud, not just enabling a button. */
  dirty: boolean;
  /** Editing something that is acting on customers right now. */
  isLive: boolean;
  className?: string;
}

export default function FlowMode({ editing, dirty, isLive, className = '' }: Props) {
  if (!editing) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#eef1f3] border border-[#e2e7ea] ${className}`}>
        <Lock className="w-3.5 h-3.5 shrink-0 text-[#6b828c]" />
        <p className="text-xs text-[#5c707a]">
          <span className="font-medium text-[#495565]">Viewing</span>
          {' — this is what the automation does. Press Edit to change it.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#f8fdfe] border border-[#2A96A8] ${className}`}>
      <Pencil className="w-3.5 h-3.5 shrink-0 text-[#2A96A8]" />
      <p className="text-xs text-[#1e7d8f]">
        <span className="font-medium text-[#2A96A8]">Editing</span>
        {isLive
          ? ' — this automation is running. Changes reach live alerts when you save.'
          : ' — nothing happens until you save.'}
      </p>
      {dirty && (
        <span className="ml-auto shrink-0 px-2 py-0.5 rounded-[8px] bg-[#2A96A8] text-white text-[10px] font-semibold uppercase tracking-wide">
          Unsaved changes
        </span>
      )}
    </div>
  );
}

/**
 * What a locked body does to the controls inside it. The fieldset already stops
 * them working; this stops them *looking* like they might. Checkboxes keep
 * their appearance, because switched-on is the state being reported.
 */
export const LOCKED_FIELDS =
  '[&_input:not([type=checkbox])]:border-transparent [&_input:not([type=checkbox])]:bg-transparent ' +
  '[&_select]:border-transparent [&_select]:bg-transparent [&_select]:appearance-none ' +
  '[&_input:not([type=checkbox])]:text-[#495565] [&_select]:text-[#495565]';

/**
 * The loading bar, for the half-second after a mode change. It spans the whole
 * builder rather than the strip it used to live in: a two-pixel line inside a
 * box reads as a detail of that box, and the thing that changed is the page.
 *
 * Mounted with a key, because the animation only plays on a fresh element —
 * a class already sitting there does not replay.
 */
export function ModeSweep({ editing }: { editing: boolean }) {
  return (
    <span
      className={`flow-mode-sweep absolute left-0 top-0 h-0.5 w-full z-20 ${
        editing ? 'bg-[#2A96A8]' : 'bg-[#b7c4c9]'
      }`}
    />
  );
}
