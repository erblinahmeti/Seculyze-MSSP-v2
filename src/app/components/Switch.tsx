// ─── Switch ──────────────────────────────────────────────────────────────────
//
// One on/off control for the whole app. The geometry is lifted from the
// borders toggle so the two read as the same component rather than two
// people's idea of a switch — 32×18 track, 14px knob, teal when on.
//
// It stops propagation itself, because it almost always sits inside a row or a
// card that is clickable for something else, and flipping a switch should
// never also open the thing behind it.

interface Props {
  on: boolean;
  onChange: () => void;
  /** Read out beside the track. Omit where a column header already says it. */
  label?: string;
  title?: string;
  disabled?: boolean;
}

export default function Switch({ on, onChange, label, title, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
    >
      <span
        className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
          on ? 'bg-[#2A96A8]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-all ${
            on ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </span>
      {label && (
        <span className={`text-xs ${on ? 'text-[#092E3F]' : 'text-[#87999f]'}`}>{label}</span>
      )}
    </button>
  );
}
