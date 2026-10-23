import { AlertTriangle } from 'lucide-react';

// ─── a warning where the problem is ──────────────────────────────────────────
//
// The approval warning used to sit in a band across the foot of the builder,
// which is the one place it could not be acted on: it named a condition in
// another column and left you to go and find it. A warning at the bottom of a
// page is a warning about the page; the thing that is wrong is never the page.
//
// So a note attaches to the row it is about. The missing playbook says so on
// the action that needs it, the empty value says so on the condition that is
// empty, and "nothing is holding this back" says so on the Approval row that
// would hold it back. Fixing it means reading it and then looking down, not
// reading it and then hunting.
//
// Quiet on purpose. These appear while someone is part-way through building —
// they are things still to do, not things that have gone wrong — so they are a
// line of amber text, not a box.
//
// #c07d1e is the console's amber on white: the Draft pill, the
// changes-customer-systems chip, the Missing-on-14-clients column, the warning
// beside a live flow being edited, and the unresolved note under Blast radius
// are all this colour. The first draft of this file used #8a5a12, which is the
// darker tone the old banner needed to stay readable on an amber tint — on
// white it is simply a second amber, and two ambers for one meaning is how a
// palette stops meaning anything.

export default function FieldNote({ children, className = '' }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`flex items-start gap-1.5 text-[11px] leading-4 text-[#c07d1e] ${className}`}>
      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
      <span>{children}</span>
    </span>
  );
}

/** What an action is still missing, in the words of the thing it needs. */
export function missingParam(param: { kind: string; placeholder?: string } | undefined): string | null {
  if (!param) return null;
  switch (param.kind) {
    case 'playbook': return 'Pick which playbook to run.';
    case 'enum': return 'Choose one.';
    case 'multi': return 'Choose at least one.';
    case 'number': return param.placeholder ? `Needs a number — ${param.placeholder}.` : 'Needs a number.';
    default: return param.placeholder ? `Needs a value — ${param.placeholder}.` : 'Needs a value.';
  }
}
