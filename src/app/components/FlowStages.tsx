import { Check, AlertTriangle } from 'lucide-react';

// ─── Create → Review → Active ────────────────────────────────────────────────
//
// This screen is a designer: you come here to build an automation or change
// one. But building it is only the first of three things that happen to it,
// and the screen used to show none of that. The review appeared as a modal out
// of nowhere, and "live" was a coloured pill in a corner — so there was no
// sense of being anywhere in particular, or of what came next.
//
// Three stages, named for what they are:
//
//   Create    the columns below. Done once there is a trigger and an action —
//             anything less is not a flow yet, it is a half-filled form.
//   Review    what it would have done over the last 30 days. Not optional on
//             the way to live, and reachable any time you want to look.
//   Active    it is running. This is where the statuses live — last run, how
//             often, what it actually did — and it opens as a drawer, because
//             checking on a flow should not mean leaving the one you are
//             editing.
//
// The rail is navigation as well as a report: Review opens the review, Active
// opens the status drawer. A stage you cannot be in yet is inert rather than
// hidden, so the shape of the journey is visible from the first screen.

export type Stage = 'create' | 'review' | 'active';

interface Props {
  /** Never saved — nothing has happened to it yet. */
  isNew: boolean;
  /** Running right now. */
  isActive: boolean;
  /** Enough of a flow to be worth reviewing: a trigger and at least one action. */
  canReview: boolean;
  onReview: () => void;
  onStatus: () => void;
}

export default function FlowStages({ isNew, isActive, canReview, onReview, onStatus }: Props) {
  // Where the flow has got to — not where the cursor is. A live flow sits on
  // Active even while you are editing it, because that is the true answer to
  // "what is this thing right now".
  const at: Stage = isActive ? 'active' : canReview ? 'review' : 'create';

  const steps: { id: Stage; label: string; note: string; onClick?: () => void; enabled: boolean }[] = [
    {
      id: 'create',
      label: 'Create',
      note: canReview ? 'Trigger and actions set' : isNew ? 'Pick a trigger to start' : 'Editing',
      enabled: false,
    },
    {
      id: 'review',
      label: 'Review',
      note: canReview ? 'See the last 30 days' : 'Needs a trigger and an action',
      onClick: onReview,
      enabled: canReview,
    },
    {
      id: 'active',
      label: isActive ? 'Active' : 'Activate',
      // A flow that has been switched off still has a history, and that is
      // exactly when someone asks what it did before it was parked. So the
      // stage opens for anything that has been saved — only a flow that has
      // never existed has nothing to report.
      note: isActive
        ? 'Running — open its status'
        : isNew ? 'After the review' : 'Not running — open its status',
      onClick: onStatus,
      enabled: !isNew,
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => {
        const done = (s.id === 'create' && canReview) || (s.id === 'review' && isActive);
        const here = s.id === at;
        const Tag = s.enabled ? 'button' : 'div';

        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <span className="w-5 h-px bg-[var(--stroke)]" />}
            <Tag
              {...(s.enabled ? { onClick: s.onClick, title: s.note } : {})}
              className={`flex items-center gap-2 h-9 pl-2 pr-3 rounded-[8px] border text-left transition-colors ${
                here
                  ? 'bg-white border-[#2A96A8]'
                  : done
                    ? 'bg-white border-[var(--stroke)]'
                    : 'bg-transparent border-transparent'
              } ${s.enabled ? 'cursor-pointer hover:border-[#2A96A8]' : ''}`}
            >
              <span
                className={`w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-semibold ${
                  done
                    ? 'bg-[#e3f0e8] text-[#2f7d52]'
                    : here
                      ? 'bg-[#2A96A8] text-white'
                      : 'bg-[#eef1f3] text-[#b7c4c9]'
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="leading-tight">
                <span className={`block text-xs font-medium ${here || done ? 'text-[#092E3F]' : 'text-[#b7c4c9]'}`}>
                  {s.label}
                </span>
                <span className="block text-[10px] text-[#87999f]">{s.note}</span>
              </span>
            </Tag>
          </div>
        );
      })}

      {/* Editing something that is already running is worth a sentence, not a
          colour someone has to decode. */}
      {isActive && (
        <span className="inline-flex items-center gap-1.5 ml-1 text-[11px] text-[#c07d1e]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Changes apply when you save
        </span>
      )}
    </div>
  );
}
