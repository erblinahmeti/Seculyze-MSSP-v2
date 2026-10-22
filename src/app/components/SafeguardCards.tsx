import { ArrowRight, TrendingUp, Wallet } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { NOTIFY_RULES, unmanned, ruleCount, type NotifySection } from './notifyRules';

// ─── the safeguards nobody is listening for ──────────────────────────────────
//
// Configurations tells you what is switched on. It did not tell you what would
// happen in silence, and the two easiest things to miss are the ingestion
// alarms: a log source that goes quiet, and a bill that runs away.
//
// The gap is not a missing automation — the thresholds already exist on the
// Notifications page, numbered and listed, looking for all the world like they
// are set up. What is missing is somewhere to send. A threshold with no
// channel fires into an empty room, and that is worse than no threshold at
// all, because it reads as covered.
//
// The button does not say "Add contacts". Two of the three things you can add
// are not contacts: an ITSM integration — Jira, Autotask, Xurrent — is toggled
// on so the alert lands as a ticket, and nobody would call switching on Jira
// "adding a contact". "Set up" covers a person and a queue in the same breath
// and stays out of the way in a row this short — it can afford to be this
// terse because the line above it has already named the thing being set up.
//
// The line above therefore spends its words on what is on offer — e-mail, SMS
// or a ticket — rather than repeating "nothing set up" at the button.
//
// So each card names the section, names the thresholds that are silent, and
// hands you straight to that section of the page. They are not dismissible: a
// card you can wave away stops meaning anything, and there is already a good
// way to make this one disappear — add somebody.
//
// One row each, not a panel. These are advice on a page whose actual job is
// the settings table below, and the first draft took a quarter of the screen
// before anyone saw a single setting. The reasoning — why a silent threshold
// matters — is on hover, because it is the explanation, not the alert.
//
// Single tenant only, for now. In the MSSP view "nobody is notified" is sixty
// different answers, and one card cannot carry them; that view needs a count
// of affected customers and a way in to each, which is its own design.
//
// Teal, not amber. Amber on this page means something that exists needs
// attention — it is on the Missing-on-14-clients rows in the table below.
// These are opportunities, and dressing one as a warning spends the warning
// budget the real ones depend on.

interface Safeguard {
  section: NotifySection;
  icon: typeof TrendingUp;
  title: string;
  /** What goes wrong while nobody is listening. */
  risk: string;
}

const SAFEGUARDS: Safeguard[] = [
  {
    section: 'anomaly',
    icon: TrendingUp,
    title: 'Nobody is notified about ingestion anomalies',
    risk: 'A log source that stops sending is invisible until someone looks. Detections keep passing while the data behind them is gone.',
  },
  {
    section: 'budget',
    icon: Wallet,
    title: 'Nobody is notified about the ingestion budget',
    risk: 'Overspend is found at the end of the month, when it has already happened and nothing can be done about it.',
  },
];

export default function SafeguardCards({ onNavigate }: {
  /** Takes a page key, optionally with a deep-link argument after '?'. */
  onNavigate?: (page: string) => void;
}) {
  const ws = useWorkspace();

  // One customer at a time, for now — see the note above.
  if (!ws.single || !onNavigate) return null;

  const open = SAFEGUARDS
    .map(s => ({ ...s, gaps: unmanned(NOTIFY_RULES, s.section), total: ruleCount(NOTIFY_RULES, s.section) }))
    .filter(s => s.gaps.length > 0);

  if (open.length === 0) return null;

  return (
    <div className={`grid gap-2 mb-5 ${open.length > 1 ? 'min-[1280px]:grid-cols-2' : ''}`}>
      {open.map(s => (
        <div
          key={s.section}
          title={s.risk}
          className="flex items-center gap-3 p-3 rounded-[8px] bg-white border border-[var(--stroke)]
                     border-l-2 border-l-[#2A96A8]"
        >
          <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-[#e5f2f4]">
            <s.icon className="w-4 h-4 text-[#2A96A8]" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm text-[#092E3F] truncate">{s.title}</p>
            {/* The thresholds by name, because seeing them makes it obvious
                this is a missing contact and not a missing rule. */}
            <p className="text-[11px] text-[#87999f] truncate">
              {s.gaps.map(g => g.short).join(' · ')} — no e-mail, SMS or ticket
            </p>
          </div>

          <button
            onClick={() => onNavigate(`notifications?focus=${s.section}`)}
            className="shrink-0 flex items-center gap-1.5 h-8 px-3 bg-white border border-[var(--stroke)]
                       rounded-[8px] text-xs text-[#092E3F] hover:border-[#2A96A8] transition-colors"
          >
            Set up
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
