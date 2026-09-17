import { useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Wallet, Search, Calendar, ChevronDown, ChevronRight, X, Info, Check,
  MonitorCheck, Shield, Terminal, Cloud, KeyRound, Activity, Mail, FileText,
  TrendingUp, AlertTriangle, Ban, MessageSquare, History, ScrollText, Send, Pencil, Plus,
} from 'lucide-react';
import { TABLE_SHELL, GRID_HEAD, GRID_ROW, GRID_BODY, GRID_SCROLL } from './tableStyles';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only. A budget is set per log source; everything else on the page is
// derived from the daily cost series so far, so the projection and the status
// can never disagree with the graph.

type Status = 'exceeded' | 'projected' | 'within' | 'unset';
type SourceIcon = 'monitor-check' | 'shield' | 'terminal' | 'cloud' | 'key-round' | 'activity' | 'mail' | 'file-text';

interface SystemEvent { at: string; text: string }
interface ChangeEvent { at: string; who: string; text: string }
interface Comment { id: string; who: string; at: string; text: string }

interface BudgetSource {
  id: string;
  name: string;
  icon: SourceIcon;
  // null = no budget set yet. Everything about status hangs off this.
  budget: number | null;
  // Cost per day for the period so far. Length is the day of the period.
  daily: number[];
  system: SystemEvent[];
  changes: ChangeEvent[];
  comments: Comment[];
}

// August, and we are 22 days into it.
const PERIOD_DAYS = 31;
const DAY = 22;
const PERIOD_LABEL = '1–22 August';

// A base daily rate shaped by a fixed weekly ripple — weekends run lighter — so
// the curve looks like real ingestion without hand-writing 22 numbers a source.
function dailySeries(base: number, days: number, seed: number): number[] {
  const ripple = [1, 1.04, 0.98, 1.06, 1.02, 0.72, 0.68];
  return Array.from({ length: days }, (_, i) => {
    const wobble = 1 + (((i * 7 + seed * 13) % 9) - 4) / 100;
    return Math.round(base * ripple[(i + seed) % 7] * wobble);
  });
}

const SOURCES: BudgetSource[] = [
  {
    id: 'sec', name: 'SecurityEvent', icon: 'monitor-check', budget: 16000,
    daily: dailySeries(601, DAY, 0),
    system: [
      { at: '4 Aug 03:00', text: 'Budget tracking started for the August period' },
      { at: '13 Aug 09:12', text: '80% of budget reached with 18 days remaining' },
      { at: '16 Aug 03:00', text: 'Projected to exceed budget before the period ends' },
      { at: '18 Aug 06:15', text: 'Daily ingestion 34% above the 7-day average' },
    ],
    changes: [
      { at: '2 Aug 10:22', who: 'Sarah Chen', text: 'Set budget to $16,000 (was $14,000)' },
      { at: '9 Aug 14:05', who: 'David Martinez', text: 'Raised alert threshold to 90%' },
    ],
    comments: [
      { id: 'c1', who: 'Sarah Chen', at: '16 Aug 11:40', text: 'The 4688 volume from workstations is what is pushing this. There is an open recommendation in Data Collection that would cut ~$4.1k/mo — worth applying before we raise the budget again.' },
      { id: 'c2', who: 'Mike Johnson', at: '17 Aug 08:02', text: 'Agreed. Holding the budget where it is until we see the effect.' },
    ],
  },
  {
    id: 'csl', name: 'CommonSecurityLog', icon: 'shield', budget: 7000,
    daily: dailySeries(361, DAY, 3),
    system: [
      { at: '4 Aug 03:00', text: 'Budget tracking started for the August period' },
      { at: '15 Aug 22:31', text: '80% of budget reached with 16 days remaining' },
      { at: '20 Aug 11:47', text: 'Budget exceeded — spend has passed $7,000' },
    ],
    changes: [
      { at: '1 Aug 09:14', who: 'Jessica Park', text: 'Set budget to $7,000' },
    ],
    comments: [
      { id: 'c3', who: 'Jessica Park', at: '20 Aug 12:10', text: 'The firewall started logging allowed DNS traffic again after the PA-5220 upgrade. Raising this to $9,000 for August and filtering it properly next period.' },
    ],
  },
  {
    id: 'sys', name: 'Syslog', icon: 'terminal', budget: 9000,
    daily: dailySeries(224, DAY, 1),
    system: [{ at: '4 Aug 03:00', text: 'Budget tracking started for the August period' }],
    changes: [{ at: '1 Aug 09:16', who: 'Jessica Park', text: 'Set budget to $9,000' }],
    comments: [],
  },
  {
    id: 'azd', name: 'AzureDiagnostics', icon: 'cloud', budget: 4600,
    daily: dailySeries(175, DAY, 5),
    system: [
      { at: '4 Aug 03:00', text: 'Budget tracking started for the August period' },
      { at: '19 Aug 03:00', text: 'Projected to exceed budget before the period ends' },
    ],
    changes: [
      { at: '1 Aug 09:18', who: 'Jessica Park', text: 'Set budget to $6,200' },
      { at: '12 Aug 16:40', who: 'Robert Williams', text: 'Lowered budget to $4,600 (was $6,200)' },
    ],
    comments: [
      { id: 'c4', who: 'Robert Williams', at: '19 Aug 09:30', text: 'This is Key Vault SecretGet noise. It will come back under budget once the filter lands.' },
    ],
  },
  {
    id: 'office', name: 'OfficeActivity', icon: 'mail', budget: 6000,
    daily: dailySeries(135, DAY, 2),
    system: [{ at: '4 Aug 03:00', text: 'Budget tracking started for the August period' }],
    changes: [
      { at: '1 Aug 09:20', who: 'Jessica Park', text: 'Set budget to $6,000' },
      { at: '6 Feb 11:02', who: 'Sarah Chen', text: 'Applied SharePoint FileAccessed filter — expected to reduce monthly spend' },
    ],
    comments: [],
  },
  {
    id: 'sign', name: 'SigninLogs', icon: 'key-round', budget: 2700,
    daily: dailySeries(103, DAY, 4),
    system: [
      { at: '4 Aug 03:00', text: 'Budget tracking started for the August period' },
      { at: '21 Aug 03:00', text: 'Projected to exceed budget before the period ends' },
    ],
    changes: [{ at: '1 Aug 09:22', who: 'Jessica Park', text: 'Set budget to $2,700' }],
    comments: [],
  },
  {
    id: 'perf', name: 'Perf', icon: 'activity', budget: 1700,
    daily: dailySeries(89, DAY, 6),
    system: [
      { at: '4 Aug 03:00', text: 'Budget tracking started for the August period' },
      { at: '17 Aug 05:20', text: '80% of budget reached with 14 days remaining' },
      { at: '21 Aug 04:55', text: 'Budget exceeded — spend has passed $1,700' },
    ],
    changes: [
      { at: '1 Aug 09:24', who: 'Jessica Park', text: 'Set budget to $1,700' },
      { at: '19 Mar 10:11', who: 'Emily Rodriguez', text: 'Paused the LogicalDisk counter filter' },
    ],
    comments: [
      { id: 'c5', who: 'Emily Rodriguez', at: '21 Aug 09:15', text: 'The disk-counter filter is paused, which is why this went over. Re-enabling it in Data Collection should bring it back inside.' },
    ],
  },
  {
    // No budget yet — the state the page has to handle before anyone sets one.
    id: 'azact', name: 'AzureActivity', icon: 'file-text', budget: null,
    daily: dailySeries(21, DAY, 2),
    system: [{ at: '4 Aug 03:00', text: 'Cost tracking started — no budget set for this source' }],
    changes: [],
    comments: [],
  },
];

const SOURCE_ICON: Record<SourceIcon, typeof Wallet> = {
  'monitor-check': MonitorCheck,
  shield: Shield,
  terminal: Terminal,
  cloud: Cloud,
  'key-round': KeyRound,
  activity: Activity,
  mail: Mail,
  'file-text': FileText,
};

// Status is a state, so it ships with an icon and a label, never colour alone.
const STATUS_META: Record<Status, {
  label: string; short: string; chip: string; line: string; fill: string; icon: typeof Wallet;
}> = {
  exceeded:  { label: 'Budget Exceeded',        short: 'Exceeded', chip: 'bg-[#fdf1ef] text-[#b73520]', line: '#b73520', fill: '#fae1dd', icon: Ban },
  projected: { label: 'Projected Budget Breach', short: 'Projected', chip: 'bg-[#f7efdf] text-[#c07d1e]', line: '#c07d1e', fill: '#fbeed3', icon: TrendingUp },
  within:    { label: 'Within Budget',          short: 'Within',   chip: 'bg-[#e3f0e8] text-[#2f7d52]', line: '#2f7d52', fill: '#dcecdf', icon: Check },
  unset:     { label: 'No budget set',          short: 'No budget', chip: 'bg-[#f1f4f5] text-[#6b828c]', line: '#9aa2b1', fill: '#eef1f3', icon: AlertTriangle },
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// Everything the page shows about a source, derived from its series and budget
// so the numbers, the status and the graph can never contradict each other.
function derive(s: BudgetSource) {
  const cum: number[] = [];
  s.daily.reduce((a, v) => { const t = a + v; cum.push(t); return t; }, 0);
  const current = cum[cum.length - 1] ?? 0;
  const avgDaily = s.daily.length ? current / s.daily.length : 0;
  const projected = avgDaily * PERIOD_DAYS;
  const budget = s.budget;
  const remaining = budget == null ? null : budget - current;
  const pctUsed = budget == null || budget === 0 ? null : (current / budget) * 100;
  const status: Status =
    budget == null ? 'unset'
      : current >= budget ? 'exceeded'
        : projected > budget ? 'projected'
          : 'within';
  // The day the budget runs out at the current average rate.
  const breachDay = budget != null && avgDaily > 0 ? Math.ceil(budget / avgDaily) : null;
  return { daily: s.daily, cum, current, avgDaily, projected, remaining, pctUsed, status, breachDay };
}

const PROJECTION_TIP = 'Projected Cost is based on the average daily costs over the billing period.';

function InfoTip({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'left' | 'right' }) {
  const pos = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className="relative group/tip inline-flex align-middle">
      <Info className="w-3 h-3 text-[#092E3F]/35 hover:text-[#2A96A8] cursor-help transition-colors" />
      <span className={`absolute ${pos} top-full mt-2 w-64 p-3 bg-[#092E3F] text-white text-[11px] normal-case tracking-normal font-normal leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-20 pointer-events-none`}>
        {children}
      </span>
    </span>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
// Cumulative spend against a flat budget, with the remaining days projected at
// the average daily rate. A line, because the question is "when does this cross
// the limit", which a single ratio cannot answer.

function BudgetSpark({ d, budget, status }: { d: ReturnType<typeof derive>; budget: number | null; status: Status }) {
  const w = 96, h = 34, pad = 2;
  const yMax = Math.max(d.projected, budget ?? 0) * 1.1 || 1;
  const x = (day: number) => ((day - 1) / (PERIOD_DAYS - 1)) * w;
  const y = (v: number) => h - pad - (v / yMax) * (h - pad * 2);
  const pts = d.cum.map((v, i) => `${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`);
  const line = 'M' + pts.join(' L ');
  const meta = STATUS_META[status];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      {budget != null && (
        <line x1="0" y1={y(budget)} x2={w} y2={y(budget)} stroke="#092E3F" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />
      )}
      <path d={`${line} L ${x(DAY).toFixed(1)} ${h - pad} L 0 ${h - pad} Z`} fill={meta.fill} />
      <path d={line} fill="none" stroke={meta.line} strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d={`M${x(DAY).toFixed(1)} ${y(d.current).toFixed(1)} L ${x(PERIOD_DAYS).toFixed(1)} ${y(d.projected).toFixed(1)}`}
        fill="none" stroke={meta.line} strokeWidth="1.5" strokeDasharray="2.5 2.5" strokeOpacity="0.75"
      />
    </svg>
  );
}

function BudgetChart({ d, budget, status }: { d: ReturnType<typeof derive>; budget: number | null; status: Status }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 620, h = 210;
  const m = { top: 16, right: 58, bottom: 26, left: 52 };
  const iw = w - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const yMax = Math.max(d.projected, budget ?? 0) * 1.12 || 1;
  const x = (day: number) => m.left + ((day - 1) / (PERIOD_DAYS - 1)) * iw;
  const y = (v: number) => m.top + ih - (v / yMax) * ih;
  const meta = STATUS_META[status];

  const pts = d.cum.map((v, i) => `${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`);
  const line = 'M' + pts.join(' L ');
  const ticks = [0, yMax / 2, yMax];
  const dayTicks = [1, 8, 15, 22, PERIOD_DAYS];
  const breach = d.breachDay != null && d.breachDay <= PERIOD_DAYS ? d.breachDay : null;
  const breachVal = breach != null ? Math.min(budget ?? 0, d.avgDaily * breach) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const day = Math.round(((px - m.left) / iw) * (PERIOD_DAYS - 1)) + 1;
          setHover(day >= 1 && day <= PERIOD_DAYS ? day : null);
        }}
      >
        {/* grid + y axis */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={m.left} y1={y(t)} x2={m.left + iw} y2={y(t)} stroke="#e4e7ec" strokeWidth="1" />
            <text x={m.left - 8} y={y(t) + 3.5} textAnchor="end" className="fill-[#87999f]" style={{ fontSize: 9 }}>
              {money(t)}
            </text>
          </g>
        ))}
        {dayTicks.map(t => (
          <text key={t} x={x(t)} y={m.top + ih + 16} textAnchor="middle" className="fill-[#87999f]" style={{ fontSize: 9 }}>
            {t === PERIOD_DAYS ? `${t} Aug` : t}
          </text>
        ))}

        {/* budget rule, labelled at the end so it needs no legend entry */}
        {budget != null && (
          <>
            <line x1={m.left} y1={y(budget)} x2={m.left + iw} y2={y(budget)} stroke="#092E3F" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="4 3" />
            <text x={m.left + iw + 6} y={y(budget) + 3.5} className="fill-[#092E3F]" style={{ fontSize: 9, fontWeight: 500 }}>
              Budget
            </text>
          </>
        )}

        {/* spend so far */}
        <path d={`${line} L ${x(DAY).toFixed(1)} ${y(0)} L ${x(1).toFixed(1)} ${y(0)} Z`} fill={meta.fill} fillOpacity="0.75" />
        <path d={line} fill="none" stroke={meta.line} strokeWidth="2" strokeLinejoin="round" />

        {/* the rest of the period at the current average rate */}
        <path
          d={`M${x(DAY).toFixed(1)} ${y(d.current).toFixed(1)} L ${x(PERIOD_DAYS).toFixed(1)} ${y(d.projected).toFixed(1)}`}
          fill="none" stroke={meta.line} strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.7"
        />
        <text x={x(PERIOD_DAYS) + 6} y={y(d.projected) + 3.5} className="fill-[#092E3F]" style={{ fontSize: 9, fontWeight: 600 }}>
          {money(d.projected)}
        </text>

        {/* where the average rate runs the budget out */}
        {breach != null && breachVal != null && (
          <g>
            <line x1={x(breach)} y1={m.top} x2={x(breach)} y2={m.top + ih} stroke={meta.line} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(breach)} cy={y(breachVal)} r="4.5" fill={meta.line} stroke="#fff" strokeWidth="2" />
          </g>
        )}

        {/* today */}
        <circle cx={x(DAY)} cy={y(d.current)} r="4.5" fill={meta.line} stroke="#fff" strokeWidth="2" />

        {/* hover crosshair */}
        {hover != null && hover <= DAY && (
          <>
            <line x1={x(hover)} y1={m.top} x2={x(hover)} y2={m.top + ih} stroke="#092E3F" strokeOpacity="0.25" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(d.cum[hover - 1])} r="4" fill="#fff" stroke={meta.line} strokeWidth="2" />
          </>
        )}
      </svg>

      {hover != null && hover <= DAY && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none bg-[#092E3F] text-white text-[11px] leading-relaxed rounded-lg shadow-lg px-2.5 py-2 whitespace-nowrap z-10"
          style={{ left: `${(x(hover) / w) * 100}%`, top: `${(y(d.cum[hover - 1]) / h) * 100}%` }}
        >
          <span className="font-medium">{hover} Aug</span>
          <span className="block text-white/70">
            {money(d.cum[hover - 1])} spent · {money(d.daily[hover - 1])} that day
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 mt-1 pl-[52px]">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
          <span className="w-4 h-[2px] rounded-full" style={{ background: meta.line }} />
          Spend to date
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: meta.line, opacity: 0.7 }} />
          Projected to {PERIOD_DAYS} Aug
        </span>
        {budget != null && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
            <span className="w-4 border-t border-dashed border-[#092E3F]/45" />
            Budget {money(budget)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IngestionBudget() {
  const [sources, setSources] = useState<BudgetSource[]>(SOURCES);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<'system' | 'changes' | 'comments'>('system');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [commentText, setCommentText] = useState('');

  const rows = useMemo(
    () => sources.map(s => ({ s, d: derive(s) })),
    [sources]
  );

  const needle = q.trim().toLowerCase();
  const visible = rows.filter(({ s, d }) =>
    (!needle || s.name.toLowerCase().includes(needle)) &&
    (filter === 'all' || d.status === filter)
  );

  const totals = useMemo(() => {
    const budget = rows.reduce((a, { s }) => a + (s.budget ?? 0), 0);
    const current = rows.reduce((a, { d }) => a + d.current, 0);
    const projected = rows.reduce((a, { d }) => a + d.projected, 0);
    const counts = rows.reduce((acc, { d }) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<Status, number>);
    return { budget, current, projected, remaining: budget - current, counts };
  }, [rows]);

  const setBudget = (id: string, value: number | null) => {
    const s = sources.find(x => x.id === id);
    if (!s) return;
    const was = s.budget;
    if (was === value) return;
    const stamp = `${DAY} Aug 14:32`;
    const text = was == null
      ? `Set budget to ${money(value ?? 0)}`
      : value == null
        ? `Removed the budget (was ${money(was)})`
        : `${value > was ? 'Raised' : 'Lowered'} budget to ${money(value)} (was ${money(was)})`;
    setSources(prev => prev.map(x => x.id !== id ? x : {
      ...x,
      budget: value,
      changes: [{ at: stamp, who: 'John Doe', text }, ...x.changes],
    }));
    toast.success(`${s.name} — ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
  };

  const commitEdit = (id: string) => {
    const n = draft.trim() === '' ? null : Number(draft);
    if (n != null && (!Number.isFinite(n) || n < 0)) {
      toast.error('Enter a budget of 0 or more');
      return;
    }
    setBudget(id, n);
    setEditing(null);
    setDraft('');
  };

  const addComment = (id: string) => {
    const text = commentText.trim();
    if (!text) return;
    setSources(prev => prev.map(x => x.id !== id ? x : {
      ...x,
      comments: [...x.comments, { id: `c-${x.comments.length + 1}-${x.id}`, who: 'John Doe', at: `${DAY} Aug 14:32`, text }],
    }));
    setCommentText('');
    toast.success('Comment added');
  };

  const detail = rows.find(({ s }) => s.id === detailId) ?? null;

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[#092E3F] text-xl font-semibold">Ingestion Budget</h1>
                <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">Cost</span>
              </div>
              <p className="text-sm text-[#092E3F]/60">
                Set a budget per log source and see which are on track to stay inside it.
              </p>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="Total budget" value={money(totals.budget)} sub={`${rows.filter(r => r.s.budget != null).length} of ${rows.length} sources budgeted`} />
          <StatCard
            label="Current spend"
            value={money(totals.current)}
            sub={`${Math.round((totals.current / totals.budget) * 100)}% of budget · ${PERIOD_LABEL}`}
          />
          <StatCard
            label="Remaining"
            value={money(totals.remaining)}
            sub={`${PERIOD_DAYS - DAY} days left in the period`}
            accent={totals.remaining >= 0 ? 'good' : 'bad'}
          />
          <StatCard
            label="Projected cost"
            value={money(totals.projected)}
            sub={totals.projected > totals.budget
              ? `${money(totals.projected - totals.budget)} over budget`
              : `${money(totals.budget - totals.projected)} under budget`}
            accent={totals.projected > totals.budget ? 'bad' : 'good'}
            tip={PROJECTION_TIP}
          />
          <div className="bg-[#092E3F] rounded-[6px] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#2A96A8]">Needs attention</p>
            <p className="text-2xl font-semibold text-white tabular-nums mt-1">
              {(totals.counts.exceeded ?? 0) + (totals.counts.projected ?? 0)} of {rows.length}
            </p>
            <p className="text-xs text-white/55 mt-0.5">
              {totals.counts.exceeded ?? 0} exceeded · {totals.counts.projected ?? 0} projected to breach
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-[#092E3F]">Log Sources</h2>
          {visible.length !== rows.length && (
            <span className="text-xs text-[#6b828c]">{visible.length} matching</span>
          )}
          <div className="flex-1" />
          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px]">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All {rows.length}</FilterBtn>
            {(['exceeded', 'projected', 'within', 'unset'] as Status[]).map(st => (
              <FilterBtn key={st} active={filter === st} onClick={() => setFilter(st)}>
                {STATUS_META[st].short} {totals.counts[st] ?? 0}
              </FilterBtn>
            ))}
          </div>
          <div className="relative w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search log sources"
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-[#f6f6f6] transition-colors">
            <Calendar className="w-3.5 h-3.5 text-[#6b828c]" />
            August 2026
            <ChevronDown className="w-3.5 h-3.5 text-[#6b828c]" />
          </button>
        </div>

        {/* Table */}
        <div className={TABLE_SHELL}>
          <div className={GRID_SCROLL}>
            <div className={`grid grid-cols-[minmax(200px,1.4fr)_minmax(110px,0.55fr)_minmax(110px,0.6fr)_minmax(110px,0.55fr)_minmax(130px,0.65fr)_minmax(104px,0.6fr)_minmax(170px,0.85fr)_46px] gap-3 ${GRID_HEAD}`}>
              <div>Log source</div>
              <div>Budget</div>
              <div>Current spend</div>
              <div>Remaining</div>
              <div className="flex items-center gap-1">Projected cost <InfoTip>{PROJECTION_TIP}</InfoTip></div>
              <div>Spending</div>
              <div>Status</div>
              <div />
            </div>

            {visible.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#6b828c]">No log sources match this filter.</p>
            )}

            <div className={GRID_BODY}>
              {visible.map(({ s, d }) => {
                const Icon = SOURCE_ICON[s.icon];
                const meta = STATUS_META[d.status];
                const StatusIcon = meta.icon;
                return (
                  <div
                    key={s.id}
                    onClick={() => { setDetailId(s.id); setTab('system'); }}
                    className={`grid grid-cols-[minmax(200px,1.4fr)_minmax(110px,0.55fr)_minmax(110px,0.6fr)_minmax(110px,0.55fr)_minmax(130px,0.65fr)_minmax(104px,0.6fr)_minmax(170px,0.85fr)_46px] gap-3 items-center cursor-pointer ${GRID_ROW}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                      <p className="font-mono text-xs font-medium text-[#092E3F] truncate">{s.name}</p>
                    </div>

                    {/* Budget is the one editable cell, so it stops the row click. */}
                    <div onClick={e => e.stopPropagation()}>
                      {editing === s.id ? (
                        <input
                          autoFocus
                          value={draft}
                          onFocus={e => e.target.select()}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={() => commitEdit(s.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(s.id);
                            if (e.key === 'Escape') { setEditing(null); setDraft(''); }
                          }}
                          placeholder="No budget"
                          className="w-full px-2 py-1 border border-[#2A96A8] rounded-[4px] text-xs text-[#092E3F] tabular-nums focus:outline-none"
                        />
                      ) : s.budget == null ? (
                        <button
                          onClick={() => { setEditing(s.id); setDraft(''); }}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 rounded-[4px] text-xs font-medium text-[#1e7d8f] hover:border-[#2A96A8] hover:bg-[#e5f2f4] transition-colors"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          Set budget
                        </button>
                      ) : (
                        <button
                          onClick={() => { setEditing(s.id); setDraft(String(s.budget)); }}
                          title="Edit budget"
                          className="group/edit w-full flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-[4px] text-xs font-medium text-[#092E3F] tabular-nums hover:bg-[#f1f4f5] transition-colors"
                        >
                          {money(s.budget)}
                          <Pencil className="w-3 h-3 shrink-0 text-[#092E3F]/25 group-hover/edit:text-[#2A96A8] transition-colors" />
                        </button>
                      )}
                    </div>

                    <div className="text-xs text-[#092E3F] tabular-nums">
                      {money(d.current)}
                      {d.pctUsed != null && (
                        <span className="block text-[11px] text-[#6b828c]">{Math.round(d.pctUsed)}% used</span>
                      )}
                    </div>

                    <div className={`text-xs tabular-nums ${d.remaining == null ? 'text-[#87999f]' : d.remaining < 0 ? 'text-[#b73520] font-medium' : 'text-[#092E3F]/80'}`}>
                      {d.remaining == null ? '—' : d.remaining < 0 ? `${money(Math.abs(d.remaining))} over` : money(d.remaining)}
                    </div>

                    <div className="text-xs tabular-nums text-[#092E3F]/80">
                      {money(d.projected)}
                      {s.budget != null && d.projected > s.budget && (
                        <span className="block text-[11px] text-[#c07d1e]">{money(d.projected - s.budget)} over</span>
                      )}
                    </div>

                    <div title={`${money(d.current)} of ${s.budget != null ? money(s.budget) : 'no budget'} · projected ${money(d.projected)}`}>
                      <BudgetSpark d={d} budget={s.budget} status={d.status} />
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${meta.chip}`}>
                        <StatusIcon className="w-3 h-3 shrink-0" />
                        {meta.label}
                      </span>
                      {d.status === 'projected' && d.breachDay != null && (
                        <span className="block text-[11px] text-[#6b828c] mt-0.5">around {d.breachDay} Aug</span>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <ChevronRight className="w-4 h-4 text-[#87999f]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {detail && (() => {
        const { s, d } = detail;
        const Icon = SOURCE_ICON[s.icon];
        const meta = STATUS_META[d.status];
        const StatusIcon = meta.icon;
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDetailId(null)} />
            <div className="relative w-[720px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#2A96A8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-base font-semibold text-white truncate">{s.name}</p>
                  <p className="text-xs text-white/55 mt-0.5">{PERIOD_LABEL} · day {DAY} of {PERIOD_DAYS}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${meta.chip}`}>
                  <StatusIcon className="w-3 h-3" />
                  {meta.label}
                </span>
                <button
                  onClick={() => setDetailId(null)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[4px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-4 bg-[#fafbfb] border-b border-gray-200 shrink-0">
                <MiniStat label="Budget" value={s.budget == null ? '—' : money(s.budget)} pl />
                <MiniStat label="Current spend" value={money(d.current)} />
                <MiniStat label="Remaining" value={d.remaining == null ? '—' : d.remaining < 0 ? `${money(Math.abs(d.remaining))} over` : money(d.remaining)} bad={d.remaining != null && d.remaining < 0} />
                <MiniStat label="Projected cost" value={money(d.projected)} tip={PROJECTION_TIP} />
              </div>

              <div className="px-6 py-5 border-b border-gray-200 shrink-0">
                <BudgetChart d={d} budget={s.budget} status={d.status} />
              </div>

              <div className="flex gap-5 px-6 border-b border-gray-200 shrink-0">
                <DrawerTab active={tab === 'system'} onClick={() => setTab('system')} icon={ScrollText}>
                  System log {s.system.length}
                </DrawerTab>
                <DrawerTab active={tab === 'changes'} onClick={() => setTab('changes')} icon={History}>
                  Changelog {s.changes.length}
                </DrawerTab>
                <DrawerTab active={tab === 'comments'} onClick={() => setTab('comments')} icon={MessageSquare}>
                  Comments {s.comments.length}
                </DrawerTab>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {tab === 'system' && (
                  <ol className="space-y-0">
                    {s.system.slice().reverse().map((e, i) => (
                      <li key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                        <span className="relative flex flex-col items-center shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2A96A8] mt-1.5" />
                          {i < s.system.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <p className="text-xs text-[#092E3F]">{e.text}</p>
                          <p className="text-[11px] text-[#6b828c] mt-0.5">{e.at}</p>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {tab === 'changes' && (
                  s.changes.length === 0 ? (
                    <div className="border border-dashed border-gray-300 rounded-[4px] p-7 text-center text-sm text-[#6b828c]">
                      Nothing has been changed on this source yet.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-[4px] overflow-hidden divide-y divide-gray-100">
                      {s.changes.map((c, i) => (
                        <div key={i} className="flex items-start gap-3 px-3.5 py-3">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-[#e5f2f4] text-[#1e7d8f] text-[10px] font-medium flex items-center justify-center">
                            {c.who.split(' ').map(p => p[0]).join('').slice(0, 2)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#092E3F]">
                              <span className="font-medium">{c.who}</span> — {c.text}
                            </p>
                            <p className="text-[11px] text-[#6b828c] mt-0.5">{c.at}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {tab === 'comments' && (
                  <div>
                    {s.comments.length === 0 ? (
                      <div className="border border-dashed border-gray-300 rounded-[4px] p-7 text-center text-sm text-[#6b828c] mb-4">
                        No comments yet.
                      </div>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {s.comments.map(c => (
                          <div key={c.id} className="flex items-start gap-3">
                            <span className="w-7 h-7 shrink-0 rounded-full bg-[#e5f2f4] text-[#1e7d8f] text-[10px] font-medium flex items-center justify-center">
                              {c.who.split(' ').map(p => p[0]).join('').slice(0, 2)}
                            </span>
                            <div className="flex-1 min-w-0 bg-[#fafbfb] border border-gray-200 rounded-[4px] px-3.5 py-2.5">
                              <p className="text-xs">
                                <span className="font-medium text-[#092E3F]">{c.who}</span>
                                <span className="text-[#6b828c]"> · {c.at}</span>
                              </p>
                              <p className="text-xs text-[#092E3F]/80 mt-1 leading-relaxed">{c.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(s.id);
                        }}
                        rows={2}
                        placeholder="Add a comment…"
                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] resize-y focus:outline-none focus:border-[#2A96A8]"
                      />
                      <button
                        onClick={() => addComment(s.id)}
                        disabled={!commentText.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 px-6 py-3.5 flex items-center gap-2.5 shrink-0">
                <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                  <span className="text-xs text-[#6b828c]">Budget</span>
                  <span className="group/edit relative inline-flex items-center">
                    <span className="absolute left-2.5 text-xs text-[#092E3F]/45 pointer-events-none">$</span>
                    <input
                      value={editing === s.id ? draft : (s.budget == null ? '' : String(s.budget))}
                      onFocus={e => { setEditing(s.id); setDraft(s.budget == null ? '' : String(s.budget)); e.target.select(); }}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => editing === s.id && commitEdit(s.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(s.id); }}
                      placeholder="No budget set"
                      className="w-[150px] pl-5 pr-7 py-1.5 border border-gray-200 rounded-[4px] text-xs text-[#092E3F] tabular-nums placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
                    />
                    <Pencil className="absolute right-2.5 w-3 h-3 text-[#092E3F]/25 group-hover/edit:text-[#2A96A8] group-focus-within/edit:text-[#2A96A8] transition-colors pointer-events-none" />
                  </span>
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => setDetailId(null)}
                  className="px-3.5 py-2 border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatCard({ label, value, sub, accent, tip }: {
  label: string; value: string; sub: string; accent?: 'good' | 'bad'; tip?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-[6px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] flex items-center gap-1">
        {label}
        {tip && <InfoTip align="left">{tip}</InfoTip>}
      </p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${accent === 'good' ? 'text-[#2f7d52]' : accent === 'bad' ? 'text-[#b73520]' : 'text-[#092E3F]'}`}>
        {value}
      </p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, pl, bad, tip }: {
  label: string; value: string; pl?: boolean; bad?: boolean; tip?: string;
}) {
  return (
    <div className={`py-3 ${pl ? 'px-6' : ''}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] flex items-center gap-1">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${bad ? 'text-[#b73520]' : 'text-[#092E3F]'}`}>{value}</p>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]'
          : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      {children}
    </button>
  );
}

function DrawerTab({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: typeof Wallet; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-[#2A96A8] text-[#1e7d8f]' : 'border-transparent text-[#6b828c] hover:text-[#092E3F]/80'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}
