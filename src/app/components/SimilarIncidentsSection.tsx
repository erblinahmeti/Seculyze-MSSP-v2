import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SEVERITY_BADGE, type SeverityLevel } from './severity';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, HelpCircle, Info, Layers, Maximize2, Sparkles, X } from 'lucide-react';

// ─── Similar Incidents ───────────────────────────────────────────────────────
//
// The Similar Incidents section from the Incidents (A) panel (IncidentDetail.tsx),
// carried over as-is so both panels show the same final design: how past
// incidents were resolved, then each one with its entity overlap, threat-intel
// score, overall match and classification — expandable to the facts in common —
// plus a sortable full-size view. Only the inputs differ; the header follows the
// AI Triage B panel's section style.

export type Classification = 'TruePositive' | 'FalsePositive' | 'BenignPositive' | 'Undetermined';

interface SimilarIncident {
  id: string;
  ref: string;
  ageLabel: string;
  severity: 'Low' | 'Medium' | 'High';
  classification: Classification;
  tiScore: number | null;
  analyst: string;
  drop: number;
  extras: number;
}

const SIMILAR_ANALYSTS = ['Sarah Chen', 'David Martinez', 'Jessica Park', 'Mike Johnson', 'Emily Rodriguez', 'Robert Williams'];
const SIMILAR_AGES = ['2d ago', '5d ago', '1w ago', '2w ago', '3w ago', '1mo ago', '6w ago', '2mo ago'];
const SIMILAR_SEV: ('Low' | 'Medium' | 'High')[] = ['Medium', 'Medium', 'Low', 'Medium', 'High', 'Medium', 'Low', 'Medium'];
const SIMILAR_DROP = [0, 0, 0, 0, 0, 1, 1, 2];
const SIMILAR_TI: (number | null)[] = [82, 74, null, 88, 71, null, 91, 46];
const SIMILAR_EXTRA = [0, 1, 0, 2, 1, 0, 3, 2];

function MatchRing({ pct }: { pct: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center w-[40px] h-[40px] shrink-0">
      <svg width="40" height="40" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="#e5f2f4" strokeWidth="1.6" />
        <circle cx="12" cy="12" r={r} fill="none" stroke="#2A96A8" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums text-[#092E3F]">{pct}</span>
    </span>
  );
}

function InfoTip({ children, wide, align = 'center' }: { children: React.ReactNode; wide?: boolean; align?: 'center' | 'left' }) {
  const pos = align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className="relative group/tip inline-flex align-middle">
      <Info className="w-3 h-3 text-[#092E3F]/35 hover:text-[#2A96A8] cursor-help transition-colors" />
      <span
        className={`absolute ${pos} top-full mt-2 ${wide ? 'w-80' : 'w-64'} p-3 bg-[#092E3F] text-white text-[11px] normal-case tracking-normal font-normal leading-relaxed rounded-[8px] shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-20 pointer-events-none`}
      >
        {children}
      </span>
    </span>
  );
}

type SimilarSortKey = 'ref' | 'age' | 'severity' | 'entities' | 'intel' | 'match' | 'closed';
const SEV_ORDER: Record<'Low' | 'Medium' | 'High', number> = { Low: 0, Medium: 1, High: 2 };
const ageRank = (label: string) => {
  const i = SIMILAR_AGES.indexOf(label);
  return i === -1 ? 99 : i;
};
export const clsLabel = (c: Classification) => c.replace(/([A-Z])/g, ' $1').trim();

function classificationLean(type: string): Classification[] {
  const t = type.toLowerCase();
  const F: Classification = 'FalsePositive',
    T: Classification = 'TruePositive',
    B: Classification = 'BenignPositive';
  if (/(brute|password|spray|failed login|legacy auth|sign-?in|multiple failed|cryptomin)/.test(t)) return [F, F, F, F, F, B, T, F];
  if (/(malware|ransom|exfil|powershell|lolbin|lateral|c2|zero-?day|encrypt|sql injection|exploit)/.test(t)) return [T, T, T, T, T, F, T, B];
  if (/(phish|oauth|consent|inbox rule|credential|guest|token|privilege|api)/.test(t)) return [T, T, F, T, B, F, T, T];
  return [T, F, T, B, F, T, F, T];
}

function buildSimilarIncidents(type: string, seedStr: string) {
  const seed = seedStr.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const items: SimilarIncident[] = classificationLean(type)
    .map((cls, i) => ({
      id: `sim-${seedStr}-${i}`,
      ref: String(1000 + ((seed * 7 + i * 137) % 8999)),
      ageLabel: SIMILAR_AGES[(seed + i * 2) % SIMILAR_AGES.length],
      severity: SIMILAR_SEV[i],
      classification: cls,
      tiScore: SIMILAR_TI[i],
      analyst: SIMILAR_ANALYSTS[(seed + i) % SIMILAR_ANALYSTS.length],
      drop: SIMILAR_DROP[i],
      extras: SIMILAR_EXTRA[i],
    }))
    .sort((a, b) => a.drop - b.drop);
  const counts = items.reduce(
    (acc, it) => {
      acc[it.classification] = (acc[it.classification] || 0) + 1;
      return acc;
    },
    {} as Record<Classification, number>,
  );
  const total = items.length;
  const [majorityClass, majorityCount] = (Object.entries(counts) as [Classification, number][]).sort((a, b) => b[1] - a[1])[0];
  return { items, counts, total, majorityClass, majorityCount };
}

interface MatchFact {
  kind: string;
  value: string;
  mono: boolean;
}

const EXTRA_USERS = ['m.keller@acmecorp.com', 'svc_backup@acmecorp.com', 'a.novak@acmecorp.com', 'j.tan@acmecorp.com'];
const EXTRA_HOSTS = ['SRV-FILE02', 'LAPTOP-K21H8', 'DESKTOP-Q9WTZ3', 'SRV-DC01'];
const EXTRA_PROCS = ['rundll32.exe', 'wmic.exe', 'certutil.exe', 'mshta.exe'];

function buildExtraFacts(ref: string, count: number, domain: string): MatchFact[] {
  if (count <= 0) return [];
  const seed = ref.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  const pool: MatchFact[] = [
    { kind: 'User', value: EXTRA_USERS[seed % EXTRA_USERS.length].replace('acmecorp.com', domain), mono: false },
    { kind: 'Host', value: EXTRA_HOSTS[seed % EXTRA_HOSTS.length], mono: false },
    { kind: 'IP', value: `10.${seed % 200}.${(seed * 3) % 250}.${(seed * 7) % 250}`, mono: true },
    { kind: 'Process', value: EXTRA_PROCS[seed % EXTRA_PROCS.length], mono: false },
  ];
  const start = seed % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
}

function similarityScore(shared: number, total: number, tiScore: number | null, incidentTi: number | null) {
  const entityPct = total === 0 ? 0 : Math.round((shared / total) * 100);
  const intelPct = tiScore != null && incidentTi != null ? Math.max(0, 100 - Math.abs(tiScore - incidentTi)) : null;
  const overall = intelPct == null ? entityPct : Math.round((entityPct + intelPct) / 2);
  return { overall, entityPct, intelPct };
}

type Entity = { name: string; type: string; score?: number | null; asn?: string };

// The comparable facts two incidents can have in common. The ASN comes from the
// entity's own network data where the panel has it.
function buildMatchFacts(entities: Entity[]): MatchFact[] {
  const ip = entities.find(e => e.type === 'IP');
  const acct = entities.find(e => e.type === 'Account' || e.type === 'Mailbox');
  const host = entities.find(e => e.type === 'Host');
  const hash = entities.find(e => e.type === 'File Hash' || e.type === 'FileHash');
  const proc = entities.find(e => e.type === 'Process');
  const subnet = ip ? (ip.name.includes(':') ? ip.name.split(':').slice(0, 4).join(':') + '::/64' : ip.name.split('.').slice(0, 3).join('.') + '.0/24') : null;
  const facts: MatchFact[] = [];
  if (acct) facts.push({ kind: 'User', value: acct.name, mono: false });
  if (ip) {
    facts.push({ kind: 'IP', value: ip.name, mono: true });
    if (ip.asn) facts.push({ kind: 'ASN', value: ip.asn.split(' - ').pop()!.replace(/, [A-Z]{2}$/, ''), mono: false });
    facts.push({ kind: 'Subnet', value: subnet!, mono: true });
  }
  if (host) facts.push({ kind: 'Host', value: host.name, mono: false });
  if (hash) facts.push({ kind: 'File hash', value: hash.name, mono: true });
  if (proc) facts.push({ kind: 'Process', value: proc.name, mono: false });
  return facts;
}

const CLASS_BAR: Record<Classification, string> = {
  TruePositive: 'bg-[#b73520]',
  BenignPositive: 'bg-[#399193]',
  FalsePositive: 'bg-[#66c1bf]',
  Undetermined: 'bg-[#d0d5dc]',
};

/**
 * Threat intel as a level, not a number, drawn exactly like the Severity
 * badges in the incidents table (the same teal scale, shape and size).
 * Thresholds follow the entity reputation bands: High >= 80, Medium >= 50.
 */
const tiLevel = (score: number): { label: SeverityLevel } => ({ label: score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low' });

function TiLevel({ score, title }: { score: number | null; title?: string }) {
  if (score == null) return <span className="text-xs text-[#092E3F]/40">No intel</span>;
  const l = tiLevel(score);
  return (
    <span title={title ?? `Threat intel: ${l.label}`} className={`inline-flex px-3 py-1 rounded-[8px] text-xs ${SEVERITY_BADGE[l.label]}`}>
      {l.label}
    </span>
  );
}

export default function SimilarIncidentsSection({
  incidentRef,
  tenant,
  matchOn,
  entities,
  incidentTi,
  classification,
  severity,
  open,
  onToggle,
}: {
  /** This incident's number, e.g. "14310". */
  incidentRef: string;
  tenant: string;
  /** The alert type / title the history is matched on. */
  matchOn: string;
  entities: Entity[];
  /** This incident's overall threat-intel score, or null when it has none. */
  incidentTi: number | null;
  /** This incident's classification so far, or null when it has none yet. */
  classification: Classification | null;
  severity: string;
  open: boolean;
  onToggle: () => void;
}) {
  const similar = useMemo(() => buildSimilarIncidents(matchOn, incidentRef), [matchOn, incidentRef]);
  const similarPct = Math.round((similar.majorityCount / similar.total) * 100);
  const domain = entities.find(e => e.name.includes('@'))?.name.split('@')[1] ?? 'acmecorp.com';
  const facts = buildMatchFacts(entities);
  const [openShares, setOpenShares] = useState<Set<string>>(new Set());
  const [full, setFull] = useState(false);
  const [sortKey, setSortKey] = useState<SimilarSortKey>('match');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleShares = (id: string) =>
    setOpenShares(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allExpanded = similar.items.every(i => openShares.has(i.id));

  return (
    <div>
      {/* Header in the AI Triage B section style, with Incidents (A)'s info tip and Full size. */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#092E3F]" />
            <h3 className="text-base font-bold text-[#092E3F]">
              Similar Incidents
              <span className="ml-1 font-normal text-[#092E3F]/60 tabular-nums">({similar.total})</span>
            </h3>
          </button>
          {/* The same (?) as every other help tip in the panel: a button, so it's reachable by keyboard too. */}
          <span className="relative group flex">
            <button type="button" aria-label="About similar incidents" className="text-[#092E3F]/35 hover:text-[#092E3F] focus:text-[#092E3F] focus:outline-none">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <span
              role="tooltip"
              className="absolute left-0 top-full mt-1.5 w-80 p-2.5 bg-[#092E3F] text-white text-xs leading-snug rounded-[4px] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-20 pointer-events-none"
            >
            Past incidents from the same tenant (<span className="font-semibold">{tenant}</span>) with the same alert type, already closed with a classification in
            the last 90 days.
            <span className="block mt-1.5">
              Ranked by how many of this incident&rsquo;s <span className="font-semibold">{facts.length} entities</span> they also involve
              {incidentTi != null ? (
                <>
                  , and how close their threat intel is to this incident&rsquo;s (<span className="font-semibold">{tiLevel(incidentTi).label}</span>).
                </>
              ) : (
                <>. This incident has no threat intel, so intel is not used for comparison.</>
              )}
            </span>
            </span>
          </span>
        </div>
        <span className="flex items-center gap-3">
          <button
            onClick={() => setFull(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--stroke)] rounded-[8px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Full size
          </button>
          <button onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronUp className="w-4 h-4 text-[#092E3F]/60" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/60" />}
          </button>
        </span>
      </div>

      {open && (
        <div className="space-y-4">
          {/* How they were resolved, and the one action that implies. */}
          <div className="p-4 bg-gray-50 rounded-[8px]">
            <p className="text-[11px] font-medium text-[#092E3F]/50 uppercase tracking-wide mb-2">How they were resolved</p>
            <p className="text-sm text-[#092E3F]">
              <span className="font-medium">
                {similar.majorityCount} of {similar.total}
              </span>{' '}
              were classified <span className="font-medium">{clsLabel(similar.majorityClass)}</span>
              <span className="text-[#092E3F]/45"> ({similarPct}%)</span>
            </p>
            <div className="flex gap-[2px] h-1.5 rounded-full overflow-hidden bg-gray-50 mt-3">
              {(['TruePositive', 'FalsePositive', 'BenignPositive', 'Undetermined'] as Classification[]).map(c => {
                const n = similar.counts[c] || 0;
                if (n === 0) return null;
                return <div key={c} className={CLASS_BAR[c]} style={{ width: `${(n / similar.total) * 100}%` }} title={`${clsLabel(c)}: ${n}`} />;
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {(['TruePositive', 'FalsePositive', 'BenignPositive', 'Undetermined'] as Classification[]).map(c => {
                const n = similar.counts[c] || 0;
                if (n === 0) return null;
                return (
                  <span key={c} className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/60">
                    <span className={`w-1.5 h-1.5 rounded-full ${CLASS_BAR[c]}`} />
                    {clsLabel(c)} {n}
                  </span>
                );
              })}
            </div>
            {classification !== similar.majorityClass && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--stroke)] text-xs text-[#092E3F]/70">
                <Sparkles className="w-3.5 h-3.5 text-[#2A96A8] shrink-0" />
                <span className="truncate">Suggests {clsLabel(similar.majorityClass)}</span>
              </div>
            )}
          </div>

          {/* The incidents themselves. Column headers exist so the numbers in each row are self-explanatory. */}
          <div className="border border-[var(--stroke)] rounded-[8px]">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-[var(--stroke)] rounded-t-[8px]">
              <span className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Incident</span>
                <button
                  onClick={() => setOpenShares(allExpanded ? new Set() : new Set(similar.items.map(i => i.id)))}
                  className="text-[10px] font-medium text-[#2A96A8] hover:underline whitespace-nowrap"
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </span>
              <span className="w-[70px] flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                Entities
                <InfoTip>
                  The entities always come from <span className="font-semibold">this incident (#{incidentRef})</span>, never from the past one. The count is how many
                  of them also appear on the past incident in that row.
                  <span className="block mt-1.5">
                    Expand a row to see which are <span className="font-semibold">in common</span>, plus any entity the past incident involves that #{incidentRef}{' '}
                    does not.
                  </span>
                </InfoTip>
              </span>
              <span className="w-[104px] flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                Intel
                <InfoTip>
                  Each incident&rsquo;s overall threat-intel level: Low, Medium or High
                  {incidentTi != null && <> — this one is <span className="font-semibold">{tiLevel(incidentTi).label}</span></>}. Some incidents have no intel at all.
                </InfoTip>
              </span>
              <span className="w-[46px] shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">
                Match
                <InfoTip>
                  One overall similarity score out of 100. It averages the entity overlap with how close the two threat-intel scores are — the{' '}
                  <span className="font-semibold">Entities</span> and <span className="font-semibold">Intel</span> columns are the two halves of it.
                  <span className="block mt-1.5">When an incident has no intel, the score is the entity overlap alone.</span>
                </InfoTip>
              </span>
              <span className="w-[90px] text-[10px] font-medium text-[#092E3F]/45 uppercase tracking-wide">Closed as</span>
              <span className="w-4 shrink-0" />
            </div>
            <div className="divide-y divide-gray-100">
              {similar.items.map(it => {
                const shared = facts.slice(0, facts.length - it.drop);
                const extras = buildExtraFacts(it.ref, it.extras, domain);
                const expanded = openShares.has(it.id);
                const sim = similarityScore(shared.length, facts.length, it.tiScore, incidentTi);
                return (
                  <div key={it.id}>
                    <button onClick={() => toggleShares(it.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f8fdfe] transition-colors">
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[#092E3F]">#{it.ref}</span>
                        <span className="block text-xs text-[#092E3F]/45 truncate">
                          {it.severity} · {it.ageLabel}
                        </span>
                      </span>
                      <span className="w-[70px] shrink-0 text-xs text-[#092E3F]/70">
                        {shared.length} of {facts.length}
                      </span>
                      <span className="w-[104px] shrink-0 flex items-center gap-2">
                        <TiLevel score={it.tiScore} />
                      </span>
                      <span
                        className="w-[46px] shrink-0 flex items-center"
                        title={
                          sim.intelPct == null
                            ? `Similarity ${sim.overall}% — entities ${shared.length}/${facts.length} (${sim.entityPct}%), no threat intel to compare`
                            : `Similarity ${sim.overall}% — entities ${shared.length}/${facts.length} (${sim.entityPct}%), intel ${tiLevel(it.tiScore ?? 0).label} vs this incident's ${tiLevel(incidentTi ?? 0).label} (${sim.intelPct}%)`
                        }
                      >
                        <MatchRing pct={sim.overall} />
                      </span>
                      <span className="w-[90px] shrink-0 inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CLASS_BAR[it.classification]}`} />
                        <span className="truncate">{clsLabel(it.classification)}</span>
                      </span>
                      {expanded ? <ChevronUp className="w-4 h-4 text-[#092E3F]/35 shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#092E3F]/35 shrink-0" />}
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3 pt-1 bg-[#fbfcfc] space-y-2">
                        <div>
                          <p className="text-[10px] font-medium text-[#2f7d52] uppercase tracking-wide mb-1.5">In common ({shared.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {shared.map((f, fi) => (
                              <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#e5f2f4] text-[#092E3F] rounded-[8px] text-xs">
                                <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                                <span className={f.mono ? 'text-[11px]' : ''}>{f.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        {extras.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-medium text-[#092E3F]/40 uppercase tracking-wide mb-1.5">
                              Only on #{it.ref} ({extras.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {extras.map((f, fi) => (
                                <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#f1f4f5] text-[#092E3F]/75 rounded-[8px] text-xs">
                                  <span className="text-[#092E3F]/40 text-[10px]">{f.kind}</span>
                                  <span className={f.mono ? 'text-[11px]' : ''}>{f.value}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#092E3F]/45">#{it.ref} involves no entity beyond this incident&rsquo;s.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Full size — portalled to the page so the panel's own layer can't trap it. */}
      {full &&
        createPortal(
          (() => {
            const rows = similar.items.map(it => {
              const shared = facts.slice(0, facts.length - it.drop);
              const extras = buildExtraFacts(it.ref, it.extras, domain);
              const sim = similarityScore(shared.length, facts.length, it.tiScore, incidentTi);
              return { it, shared, extras, sim };
            });
            const dir = sortDir === 'asc' ? 1 : -1;
            const sorted = [...rows].sort((a, b) => {
              switch (sortKey) {
                case 'ref':
                  return (Number(a.it.ref) - Number(b.it.ref)) * dir;
                case 'age':
                  return (ageRank(a.it.ageLabel) - ageRank(b.it.ageLabel)) * dir;
                case 'severity':
                  return (SEV_ORDER[a.it.severity] - SEV_ORDER[b.it.severity]) * dir;
                case 'entities':
                  return (a.shared.length - b.shared.length) * dir;
                case 'intel': {
                  if (a.it.tiScore == null && b.it.tiScore == null) return 0;
                  if (a.it.tiScore == null) return 1;
                  if (b.it.tiScore == null) return -1;
                  return (a.it.tiScore - b.it.tiScore) * dir;
                }
                case 'closed':
                  return clsLabel(a.it.classification).localeCompare(clsLabel(b.it.classification)) * dir;
                default:
                  return (a.sim.overall - b.sim.overall) * dir;
              }
            });
            const sortBy = (k: SimilarSortKey) => {
              if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
              else {
                setSortKey(k);
                setSortDir(k === 'ref' || k === 'closed' ? 'asc' : 'desc');
              }
            };
            const Th = ({ k, children, className = '' }: { k: SimilarSortKey; children: React.ReactNode; className?: string }) => (
              <button
                onClick={() => sortBy(k)}
                className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide transition-colors ${
                  sortKey === k ? 'text-[#092E3F]' : 'text-[#092E3F]/45 hover:text-[#092E3F]/70'
                } ${className}`}
              >
                {children}
                {sortKey === k ? sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />}
              </button>
            );
            const COLS = 'grid-cols-[92px_84px_92px_120px_150px_78px_130px_1fr]';
            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
                <div className="absolute inset-0" onClick={() => setFull(false)} />
                <div className="relative w-full max-w-[1480px] h-full max-h-[92vh] bg-white rounded-[8px] shadow-2xl flex flex-col overflow-hidden">
                  <div className="bg-[#092E3F] px-6 py-4 shrink-0 flex items-center gap-3">
                    <Layers className="w-5 h-5 text-[#2A96A8] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-white">Similar Incidents</p>
                      <p className="text-xs text-white/55 mt-0.5">
                        {similar.total} past incidents at {tenant} · {matchOn}
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenShares(sorted.every(r => openShares.has(r.it.id)) ? new Set() : new Set(sorted.map(r => r.it.id)))}
                      className="px-3 py-1.5 border border-[var(--stroke)]/20 rounded-[8px] text-xs font-medium text-white/80 hover:bg-white/10 transition-colors"
                    >
                      {sorted.every(r => openShares.has(r.it.id)) ? 'Collapse all' : 'Expand all'}
                    </button>
                    <button onClick={() => setFull(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[8px] transition-colors shrink-0">
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>

                  <div className={`group grid ${COLS} gap-3 items-center px-6 py-2.5 bg-[#f6f6f6] border-b border-[var(--stroke)] shrink-0`}>
                    <Th k="ref">Incident</Th>
                    <Th k="age">Age</Th>
                    <Th k="severity">Severity</Th>
                    <Th k="entities">Entities</Th>
                    <Th k="intel">Threat intel</Th>
                    <Th k="match">Match</Th>
                    <Th k="closed">Closed as</Th>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[#092E3F]/45">Entities in common</span>
                  </div>

                  <div className={`grid ${COLS} gap-3 items-center px-6 py-3 bg-[#e5f2f4] border-b border-[#2A96A8]/25 shrink-0`}>
                    <span className="text-sm font-semibold text-[#092E3F]">#{incidentRef}</span>
                    <span className="text-xs text-[#092E3F]/60">now</span>
                    <span className="text-xs text-[#092E3F]/70">{severity}</span>
                    <span className="text-xs font-medium text-[#092E3F] tabular-nums">{facts.length} entities</span>
                    <span>
                      <TiLevel score={incidentTi} />
                    </span>
                    <span className="text-xs font-medium text-[#092E3F]">This one</span>
                    <span className="text-xs text-[#092E3F]/70">{classification ? clsLabel(classification) : 'Not classified yet'}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {facts.map((f, fi) => (
                        <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-white text-[#092E3F] rounded-[8px] text-xs">
                          <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                          <span className={f.mono ? 'text-[11px]' : ''}>{f.value}</span>
                        </span>
                      ))}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {sorted.map(({ it, shared, extras, sim }) => {
                      const expanded = openShares.has(it.id);
                      return (
                        <div key={it.id}>
                          <div onClick={() => toggleShares(it.id)} className={`grid ${COLS} gap-3 items-center px-6 py-3 cursor-pointer hover:bg-[#fafbfb] transition-colors`}>
                            <span className="text-sm font-medium text-[#092E3F]">#{it.ref}</span>
                            <span className="text-xs text-[#092E3F]/60">{it.ageLabel}</span>
                            <span className="text-xs text-[#092E3F]/70">{it.severity}</span>
                            <span className="text-xs text-[#092E3F] tabular-nums">
                              {shared.length} of {facts.length}
                              {extras.length > 0 && <span className="block text-[11px] text-[#6b828c]">+{extras.length} of its own</span>}
                            </span>
                            <span className="flex items-center gap-2">
                              <TiLevel score={it.tiScore} />
                            </span>
                            <span>
                              <MatchRing pct={sim.overall} />
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#092E3F]/70">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CLASS_BAR[it.classification]}`} />
                              <span className="truncate">{clsLabel(it.classification)}</span>
                            </span>
                            <span className="flex flex-wrap gap-1.5 items-center">
                              {shared.map((f, fi) => (
                                <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#e5f2f4] text-[#092E3F] rounded-[8px] text-xs">
                                  <span className="text-[#092E3F]/45 text-[10px]">{f.kind}</span>
                                  <span className={f.mono ? 'text-[11px]' : ''}>{f.value}</span>
                                </span>
                              ))}
                              {extras.length > 0 && !expanded && <span className="text-[11px] text-[#6b828c]">+{extras.length} only on #{it.ref}</span>}
                            </span>
                          </div>

                          {expanded && extras.length > 0 && (
                            <div className={`grid ${COLS} gap-3 px-6 pb-3 bg-[#fbfcfc]`}>
                              <div className="col-start-8">
                                <p className="text-[10px] font-medium text-[#092E3F]/40 uppercase tracking-wide mb-1.5">
                                  Only on #{it.ref} ({extras.length})
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {extras.map((f, fi) => (
                                    <span key={fi} className="inline-flex items-baseline gap-1 px-2 py-0.5 bg-[#f1f4f5] text-[#092E3F]/75 rounded-[8px] text-xs">
                                      <span className="text-[#092E3F]/40 text-[10px]">{f.kind}</span>
                                      <span className={f.mono ? 'text-[11px]' : ''}>{f.value}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-[var(--stroke)] px-6 py-3 flex items-center gap-3 shrink-0 bg-[#fafbfb]">
                    <p className="text-xs text-[#6b828c]">
                      Sorted by <span className="font-medium text-[#092E3F]">{sortKey === 'ref' ? 'incident' : sortKey === 'closed' ? 'classification' : sortKey}</span>{' '}
                      {sortDir === 'asc' ? 'ascending' : 'descending'} · click any column to change it
                    </p>
                    <div className="flex-1" />
                    <button
                      onClick={() => setFull(false)}
                      className="px-3.5 py-2 border border-[var(--stroke)] rounded-[8px] text-xs font-medium text-[#092E3F]/70 hover:bg-white transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );
}
