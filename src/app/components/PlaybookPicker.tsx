import {
  RUNNABLE_PLAYBOOKS, PLAYBOOK_BY_ID, EXCLUDED_REASON, playbookDetail,
  type PlaybookTrigger,
} from './sentinelPlaybooks';

// ─── Playbook picker ─────────────────────────────────────────────────────────
//
// What "Run Sentinel playbook" asks for, instead of a free-text box that
// accepted any string including one that doesn't exist.
//
// Grouped by trigger kind, because that is what decides whether a playbook can
// be invoked at all, and the chosen one's details sit underneath — source,
// resource group and location — since a workspace can hold two playbooks of
// the same name in different resource groups, and this one does.
//
// Shared by all five builder versions so the field behaves the same in each.

const KIND_LABEL: Record<PlaybookTrigger, string> = {
  Incident: 'Incident-triggered',
  Alert: 'Alert-triggered',
  Entity: 'Entity-triggered',
  Other: 'Other',
};

const KINDS: PlaybookTrigger[] = ['Incident', 'Alert'];

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** The builder's own select classes, so the field matches its surroundings. */
  selectClass: string;
  /** Compact mode for the narrow columns in version C and the block rows. */
  dense?: boolean;
}

export default function PlaybookPicker({ value, onChange, selectClass, dense }: Props) {
  const chosen = value ? PLAYBOOK_BY_ID[value] : undefined;

  return (
    <div className="w-full">
      <select value={value} onChange={e => onChange(e.target.value)} className={`${selectClass} w-full`}>
        <option value="">Choose a playbook…</option>
        {KINDS.map(k => {
          const items = RUNNABLE_PLAYBOOKS.filter(p => p.triggerKind === k);
          if (items.length === 0) return null;
          return (
            <optgroup key={k} label={KIND_LABEL[k]}>
              {items.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.resourceGroup !== 'sentinel-dev-euw' ? ` — ${p.resourceGroup}` : ''}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      {chosen ? (
        <div className={dense ? 'mt-1' : 'mt-1.5'}>
          <p className="text-[11px] text-[#092E3F]">{chosen.does}</p>
          {/* No badge here — the action row carries it, and it now resolves
              from this very choice, so showing it twice said it twice. */}
          <p className="text-[11px] text-[#87999f]">{playbookDetail(chosen)}</p>
        </div>
      ) : (
        !dense && <p className="text-[11px] text-[#87999f] mt-1.5">{EXCLUDED_REASON}</p>
      )}
    </div>
  );
}
