import { useState } from 'react';
import FlowRuleBuilder from './FlowRuleBuilder';
import FlowGuidedBuilder from './FlowGuidedBuilder';
import FlowColumnsBuilder from './FlowColumnsBuilder';
import FlowCardsBuilder from './FlowCardsBuilder';
import FlowBlocksBuilder from './FlowBlocksBuilder';
import type { Flow } from './flowRegister';

// ─── Variant switch for the automation builder ───────────────────────────────
//
// Five answers to the same screen, so they can be put in front of the same
// user on the same automation rather than described to them:
//
//   A — form.     Start empty, press + to add a condition or an action.
//   B — guided.   Four questions down the page; everything the trigger allows
//                 is already on screen and you tick what you want. Picking a
//                 trigger hides the rest.
//   C — columns.  The same choices side by side, trigger → conditions →
//                 actions. Nothing collapses: the trigger list stays put, so
//                 switching it is one click and you watch the other two
//                 columns reshape.
//   D — cards.    A again, with the trigger picked from a card grid instead of
//                 a dropdown, the name asked at the end instead of the start,
//                 and + replaced by a labelled menu of what it would add.
//   E — blocks.   Drag and drop, but into one vertical stack rather than onto
//                 a canvas. Order is the connection, so there is nothing to
//                 lay out and nothing to wire.
//
// The choice persists, so a test session doesn't silently reset between
// automations, and it is deliberately a plain switch rather than a hidden flag
// — whoever is running the session has to be able to flip it mid-conversation.
//
// Each variant builds from the flow it was handed, so flipping mid-build starts
// that variant clean rather than half-filled by another layout's idea of state.

export type BuilderVariant = 'A' | 'B' | 'C' | 'D' | 'E';

const KEY = 'seculyze:builder-variant';

const VARIANTS = [
  { id: 'A' as const, label: 'Form', hint: 'Version A — add rows with +', component: FlowRuleBuilder },
  { id: 'B' as const, label: 'Guided', hint: 'Version B — four questions, tick what you want', component: FlowGuidedBuilder },
  { id: 'C' as const, label: 'Columns', hint: 'Version C — trigger, conditions and actions side by side', component: FlowColumnsBuilder },
  { id: 'D' as const, label: 'Cards', hint: 'Version D — version A, but the trigger is a card grid and the name comes last', component: FlowCardsBuilder },
  { id: 'E' as const, label: 'Blocks', hint: 'Version E — drag blocks from a palette into one vertical stack', component: FlowBlocksBuilder },
];

const read = (): BuilderVariant => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'B' || v === 'C' || v === 'D' || v === 'E' ? v : 'A';
  } catch {
    return 'A';
  }
};

interface Props {
  flow: Flow;
  onSave: (flow: Flow) => void;
  onBack: () => void;
}

export default function FlowBuilderAB({ flow, onSave, onBack }: Props) {
  const [variant, setVariant] = useState<BuilderVariant>(read);

  const pick = (v: BuilderVariant) => {
    setVariant(v);
    try { localStorage.setItem(KEY, v); } catch { /* private window — the session still works */ }
  };

  const Builder = (VARIANTS.find(v => v.id === variant) ?? VARIANTS[0]).component;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* In normal flow, not floating. A fixed overlay can always end up on top
          of the footer buttons at some scroll position, and it did. */}
      <div
        data-keep-border
        className="shrink-0 flex items-center justify-end gap-2 px-6 py-2
                   bg-white border-b border-[var(--stroke)]"
      >
        <span className="text-xs text-[#6b828c]">Builder version</span>
        <div className="flex items-center rounded-[8px] bg-[#eef1f3] p-0.5">
          {VARIANTS.map(v => (
            <button
              key={v.id}
              onClick={() => pick(v.id)}
              title={v.hint}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors ${
                variant === v.id ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#6b828c] hover:text-[#092E3F]'
              }`}
            >
              {v.id} · {v.label}
            </button>
          ))}
        </div>
      </div>

      <Builder flow={flow} onSave={onSave} onBack={onBack} />
    </div>
  );
}
