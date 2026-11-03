import SidePanel from './SidePanel';
import {
  TRIGGERS, CONDITIONS, ACTIONS, GROUP_LABEL,
  type Group,
} from './flowRegister';

// ─── Knowledge article: how an automation is put together ────────────────────
//
// Every row in the builder used to carry its own explanation underneath — the
// trigger's source, the condition's reason for existing, the action's system.
// Twenty-odd rows each with a second line in a second colour and a smaller
// size is a wall, and it is a wall you read once: after the first automation
// nobody needs to be told what "Isolate device" does.
//
// So the builder shows names only, and the explanations live here, one click
// away from the toolbar. Pinnable like every other side panel, so it can sit
// beside the columns while someone builds their first one.
//
// Read straight from the register, so the article and the builder cannot
// disagree about what exists.

const GROUPS: Group[] = ['alert', 'schedule', 'platform'];

function Section({ title, intro, children }: {
  title: string; intro: string; children?: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h3 className="text-sm font-semibold text-[#092E3F]">{title}</h3>
      <p className="text-sm text-[#5c707a] leading-6 mt-1 mb-3">{intro}</p>
      {children}
    </section>
  );
}

function Term({ name, children, tag }: { name: string; children?: React.ReactNode; tag?: string }) {
  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0">
      <p className="flex items-center gap-2 text-sm text-[#092E3F]">
        {name}
        {tag && (
          <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-[#eef1f3] text-[#5c707a]">{tag}</span>
        )}
      </p>
      {children && <p className="text-xs text-[#6b828c] leading-5 mt-0.5">{children}</p>}
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-[#87999f] mt-3 mb-1 first:mt-0">{children}</p>
  );
}

export default function AutomationGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changing = ACTIONS.filter(a => a.destructive);
  const quiet = ACTIONS.filter(a => !a.destructive);

  return (
    <SidePanel
      id="automation-guide"
      open={open}
      onClose={onClose}
      width={480}
      header={
        <>
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">Knowledge article</p>
          <h2 className="text-base font-semibold text-white mt-0.5">How automations work</h2>
        </>
      }
    >
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="text-sm text-[#092E3F] leading-6 mb-7">
          An automation is one sentence read left to right: <strong>when</strong> a trigger
          fires, <strong>only if</strong> its conditions hold, <strong>do</strong> these
          actions. The trigger you pick decides which conditions and actions are available —
          the rest are greyed out.
        </p>

        <Section
          title="1 · Triggers"
          intro="What starts the automation. Pick exactly one."
        >
          {GROUPS.map(g => (
            <div key={g}>
              <SubHead>{GROUP_LABEL[g]}</SubHead>
              {TRIGGERS.filter(t => t.group === g).map(t => (
                <Term key={t.id} name={t.name}>{t.source}</Term>
              ))}
            </div>
          ))}
        </Section>

        <Section
          title="2 · Conditions"
          intro="Narrow down when it runs. With none, it runs every time the trigger fires. With several, choose whether all of them or any one has to match."
        >
          {CONDITIONS.map(c => (
            <Term key={c.id} name={c.name} tag={c.unresolved ? 'Not final' : undefined}>{c.hint}</Term>
          ))}
        </Section>

        <Section
          title="3 · Actions"
          intro="What it does. Tick as many as you need."
        >
          <SubHead>Changes customer systems</SubHead>
          <p className="text-xs text-[#6b828c] leading-5 mb-1">
            These reach into the customer's own environment. Pair them with an Approval
            condition if a person should see them first — the builder warns you when nothing
            is holding one back.
          </p>
          {changing.map(a => <Term key={a.id} name={a.name}>{a.system}</Term>)}

          <SubHead>Stays inside Seculyze and Sentinel</SubHead>
          {quiet.map(a => <Term key={a.id} name={a.name}>{a.system}</Term>)}
        </Section>

        <Section
          title="Before it goes live"
          intro="Review replays the automation over the last 30 days and shows what it would have done. Nothing runs until you confirm there."
        />
      </div>
    </SidePanel>
  );
}
