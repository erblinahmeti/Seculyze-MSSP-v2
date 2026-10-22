import { type TriggerId } from './flowRegister';
import ResponseFlows from './ResponseFlows';

// ─── Automated Response Flow (C) ─────────────────────────────────────────────
//
// The version users picked, on its own page: the three-column builder with no
// A–E switch over it, because the comparison is over.
//
// The one behavioural difference from the page it was tested on is where the
// audit log lives. There it hung off the list and opened every action across
// every automation, which answered a question nobody had asked. Here it is a
// button inside an opened automation, and it opens that automation's log —
// "what has *this* one actually done".
//
// It is a thin wrapper rather than a copy. The list, the recommendations and
// the enable switches are the same code as Response Flows, so a fix to one is
// a fix to both and the two cannot drift apart while both are on the sidebar.

export default function ResponseFlowsC({ onNavigate, startTrigger }: {
  onNavigate?: (page: string) => void;
  startTrigger?: TriggerId;
}) {
  return (
    <ResponseFlows
      onNavigate={onNavigate}
      startTrigger={startTrigger}
      lockBuilder="C"
      title="Automated Response Flow (C)"
      subtitle="Open an automation to build it in three columns, or to see what it has done."
    />
  );
}
