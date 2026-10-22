// ─── all / any ───────────────────────────────────────────────────────────────
//
// This is the only control in the builder that changes the *logic* of a flow
// rather than its contents, and it was dressed as a label: the word "Match"
// and two small words beside it. Someone skimming reads it as a heading and
// never learns that the flow fires on one condition instead of all three.
//
// So it says the whole sentence instead, with the trigger in it:
//
//     Run when True positive meets [all] of these 3 conditions
//
// Naming the trigger matters because "all" and "any" are meaningless on their
// own — they only mean something relative to the thing that starts the flow.
// Reading the row out loud now gives you the rule, and the selected half of
// the control is filled teal rather than a shade of grey, so which one is on
// survives a glance.
//
// It only appears with two or more conditions on, because with one condition
// "all" and "any" are the same rule and the choice is noise.

interface Props {
  /** The trigger's name, as the sentence's subject. */
  triggerName: string;
  /** How many conditions are switched on — "these 3 conditions". */
  count: number;
  matchAll: boolean;
  onChange: (all: boolean) => void;
  className?: string;
}

export default function MatchToggle({ triggerName, count, matchAll, onChange, className = '' }: Props) {
  return (
    <p className={`text-xs text-[#6b828c] leading-7 ${className}`}>
      Run when <span className="font-medium text-[#092E3F]">{triggerName}</span> meets{' '}
      <span className="inline-flex align-middle rounded-[8px] border border-[var(--stroke)] bg-white overflow-hidden">
        {(['all', 'any'] as const).map(m => (
          <button
            key={m}
            onClick={() => onChange(m === 'all')}
            aria-pressed={(m === 'all') === matchAll}
            title={m === 'all'
              ? 'Every condition has to be true'
              : 'One condition being true is enough'}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              (m === 'all') === matchAll
                ? 'bg-[#2A96A8] text-white'
                : 'text-[#6b828c] hover:bg-[#f6f6f6]'
            }`}
          >
            {m}
          </button>
        ))}
      </span>{' '}
      of these {count} conditions
    </p>
  );
}
