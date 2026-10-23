// ─── what a locked builder looks like ────────────────────────────────────────
//
// Being in view mode was once announced by a banner across the top of the
// page, which made the least surprising fact on screen look like the most
// important one. It is said quietly instead, by the things already on screen:
// locked fields drop their borders and read as the sentences they are, the
// buttons change from Edit to Cancel and Save, the corner carries the state,
// and pressing Edit plays a short refresh so the switch registers as an event.
//
// What is left here are the two pieces that do that work.

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
