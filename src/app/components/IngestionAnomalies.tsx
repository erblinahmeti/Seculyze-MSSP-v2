import { useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  TriangleAlert, Search, ChevronDown, ChevronRight, X, Info, Check, Send,
  MonitorCheck, Shield, Terminal, Cloud, KeyRound, Activity, Mail, FileText,
  TrendingUp, TrendingDown, EyeOff, Wrench, ShieldAlert, CalendarCheck, HelpCircle,
} from 'lucide-react';
import { TABLE_SHELL, GRID_HEAD, GRID_ROW, GRID_BODY, GRID_SCROLL } from './tableStyles';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only. Mirrors what Seculyze Cost watches for: ingestion that runs
// well above its usual pattern (a bill problem, or an attack), and ingestion
// that stops (a detection blind spot). Both are anomalies; only one costs money,
// which is why cost impact alone never decides how urgent a row is.
//
// Detection follows the Sentinel convention: a 7-day rolling baseline per table
// with a ±50% tolerance. The band on the chart IS that threshold, so the graph
// shows why a row fired rather than merely illustrating it.

type Kind = 'spike' | 'drop' | 'silent';
type Cause = 'unreviewed' | 'misconfiguration' | 'security' | 'expected';
type SourceIcon = 'monitor-check' | 'shield' | 'terminal' | 'cloud' | 'key-round' | 'activity' | 'mail' | 'file-text';

const PRICE = 2.76;            // $/GB, same rate the other cost pages use
const TOLERANCE = 0.5;         // ±50% of the 7-day baseline
const DAYS = 14;               // window the charts cover

interface Note { id: string; who: string; at: string; text: string }

interface Anomaly {
  id: string;
  source: string;
  icon: SourceIcon;
  kind: Kind;
  detectedAt: string;
  window: string;
  baseline: number[];   // expected GB/day
  actual: number[];     // observed GB/day
  cause: Cause;         // 'unreviewed' means still open
  finding: string;      // what the detector actually saw
  timeline: { at: string; text: string }[];
  notes: Note[];
}

// Steady series with a light weekly ripple, so "normal" does not look synthetic.
function base(v: number, days: number, seed: number): number[] {
  const ripple = [1, 1.03, 0.99, 1.04, 1.01, 0.78, 0.74];
  return Array.from({ length: days }, (_, i) =>
    Math.round(v * ripple[(i + seed) % 7] * (1 + (((i * 5 + seed * 11) % 7) - 3) / 100))
  );
}

// Copy the baseline, then bend the tail into whatever the anomaly is.
function bend(b: number[], from: number, fn: (v: number, i: number) => number): number[] {
  return b.map((v, i) => (i < from ? v : Math.max(0, Math.round(fn(v, i - from)))));
}

const B_CSL = base(135, DAYS, 3);
const B_SIGN = base(38, DAYS, 4);
const B_PERF = base(33, DAYS, 6);
const B_AZD = base(65, DAYS, 5);
const B_SEC = base(225, DAYS, 0);
const B_SYS = base(84, DAYS, 1);
const B_OFF = base(50, DAYS, 2);

const ANOMALIES: Anomaly[] = [
  {
    id: 'a1', source: 'CommonSecurityLog', icon: 'shield', kind: 'spike',
    detectedAt: '20 Aug 04:10', window: 'Running for 3 days',
    baseline: B_CSL, actual: bend(B_CSL, 11, v => v * 3.6),
    cause: 'unreviewed',
    finding: 'Ingestion is running 3.6× the 7-day baseline. The extra volume is almost entirely DeviceAction "allow" traffic to the two internal DNS resolvers.',
    timeline: [
      { at: '20 Aug 04:10', text: 'Ingestion crossed the +50% threshold against a 135 GB/day baseline' },
      { at: '20 Aug 04:10', text: 'Flagged for review — projected to add $3,900 to this billing period' },
      { at: '21 Aug 03:00', text: 'Still above threshold after 24 hours' },
    ],
    notes: [],
  },
  {
    id: 'a2', source: 'SigninLogs', icon: 'key-round', kind: 'silent',
    detectedAt: '22 Aug 05:30', window: 'Silent for 9 hours',
    baseline: B_SIGN, actual: bend(B_SIGN, 13, () => 0),
    cause: 'unreviewed',
    finding: 'No records have arrived for 9 hours against a 38 GB/day baseline. Sign-in based detections have had nothing to run against for that window.',
    timeline: [
      { at: '22 Aug 05:30', text: 'Ingestion dropped to 0 GB' },
      { at: '22 Aug 07:30', text: 'Still silent after 2 hours — escalated from low to high' },
      { at: '22 Aug 14:00', text: '4 analytics rules on this table have not evaluated since 05:30' },
    ],
    notes: [],
  },
  {
    id: 'a3', source: 'Perf', icon: 'activity', kind: 'spike',
    detectedAt: '19 Aug 11:25', window: 'Running for 4 days',
    baseline: B_PERF, actual: bend(B_PERF, 10, v => v * 2.1),
    cause: 'unreviewed',
    finding: 'Volume doubled after the sample interval on two counters dropped below 60 seconds. No detection reads these counters.',
    timeline: [
      { at: '19 Aug 11:25', text: 'Ingestion crossed the +50% threshold against a 33 GB/day baseline' },
      { at: '19 Aug 11:25', text: 'Matched to a paused transformation filter on this table' },
    ],
    notes: [
      { id: 'n1', who: 'Emily Rodriguez', at: '21 Aug 09:15', text: 'This is the LogicalDisk filter being paused. Re-enabling it should take this back under the baseline.' },
    ],
  },
  {
    id: 'a4', source: 'AzureDiagnostics', icon: 'cloud', kind: 'drop',
    detectedAt: '21 Aug 02:40', window: 'Running for 1 day',
    baseline: B_AZD, actual: bend(B_AZD, 12, v => v * 0.34),
    cause: 'unreviewed',
    finding: 'Down 66% against baseline without reaching zero. 6 of 18 subscribed resources have stopped emitting diagnostic settings.',
    timeline: [
      { at: '21 Aug 02:40', text: 'Ingestion fell below the −50% threshold against a 65 GB/day baseline' },
      { at: '21 Aug 02:40', text: '6 resources contributing 0 GB, previously averaging 22 GB/day combined' },
    ],
    notes: [],
  },
  {
    id: 'a5', source: 'OfficeActivity', icon: 'mail', kind: 'spike',
    detectedAt: '11 Aug 22:14', window: '11–12 Aug',
    baseline: B_OFF, actual: bend(B_OFF, 6, (v, i) => (i < 2 ? v * 4.4 : v)),
    cause: 'security',
    finding: 'A 4.4× spike over 14 hours, driven by FileDownloaded operations from a single account against 3 SharePoint sites.',
    timeline: [
      { at: '11 Aug 22:14', text: 'Ingestion crossed the +50% threshold against a 50 GB/day baseline' },
      { at: '12 Aug 08:02', text: 'Volume traced to one account — raised to the SOC' },
      { at: '12 Aug 09:30', text: 'Linked to incident #11402 — account compromise confirmed' },
      { at: '13 Aug 16:20', text: 'Resolved as a security event. Ingestion returned to baseline after containment' },
    ],
    notes: [
      { id: 'n2', who: 'Sarah Chen', at: '12 Aug 09:31', text: 'Not a billing problem — the volume was the signal. Keeping the cost, the detection worked exactly as it should.' },
    ],
  },
  {
    id: 'a6', source: 'SecurityEvent', icon: 'monitor-check', kind: 'spike',
    detectedAt: '6 Aug 03:00', window: '6–9 Aug',
    baseline: B_SEC, actual: bend(B_SEC, 4, (v, i) => (i < 4 ? v * 1.7 : v * 1.55)),
    cause: 'expected',
    finding: 'A sustained 70% rise beginning the day 228 new workstation agents were onboarded.',
    timeline: [
      { at: '6 Aug 03:00', text: 'Ingestion crossed the +50% threshold against a 225 GB/day baseline' },
      { at: '7 Aug 10:40', text: 'Matched to a planned agent rollout — 412 to 640 endpoints' },
      { at: '9 Aug 09:15', text: 'Resolved as expected. Baseline rebased to 340 GB/day' },
    ],
    notes: [],
  },
  {
    id: 'a7', source: 'Syslog', icon: 'terminal', kind: 'silent',
    detectedAt: '14 Aug 01:12', window: '14 Aug, 6 hours',
    baseline: B_SYS, actual: bend(B_SYS, 8, (v, i) => (i < 1 ? 0 : v)),
    cause: 'misconfiguration',
    finding: 'All 128 Linux hosts stopped forwarding for 6 hours following an agent package upgrade.',
    timeline: [
      { at: '14 Aug 01:12', text: 'Ingestion dropped to 0 GB' },
      { at: '14 Aug 07:05', text: 'Traced to an AMA upgrade that reset the syslog facility configuration' },
      { at: '14 Aug 07:40', text: 'Resolved as a misconfiguration. Forwarding restored, 6 hours of logs not recoverable' },
    ],
    notes: [],
  },
];

const SOURCE_ICON: Record<SourceIcon, typeof TriangleAlert> = {
  'monitor-check': MonitorCheck, shield: Shield, terminal: Terminal, cloud: Cloud,
  'key-round': KeyRound, activity: Activity, mail: Mail, 'file-text': FileText,
};

// A spike costs money; silence costs coverage. They are different problems, so
// they get different words and different colours rather than one "severity".
const KIND_META: Record<Kind, { label: string; icon: typeof TriangleAlert; chip: string; line: string; band: string }> = {
  spike:  { label: 'Ingestion spike',  icon: TrendingUp,   chip: 'bg-[#f7efdf] text-[#c07d1e]', line: '#c07d1e', band: '#f7efdf' },
  drop:   { label: 'Ingestion drop',   icon: TrendingDown, chip: 'bg-[#f1f4f5] text-[#5c707a]', line: '#5c707a', band: '#eef1f3' },
  silent: { label: 'Source silent',    icon: EyeOff,       chip: 'bg-[#fdf1ef] text-[#b73520]', line: '#b73520', band: '#fae1dd' },
};

const CAUSE_META: Record<Cause, { label: string; icon: typeof TriangleAlert; chip: string }> = {
  unreviewed:       { label: 'Needs review',    icon: HelpCircle,    chip: 'bg-[#e5f2f4] text-[#1e7d8f]' },
  misconfiguration: { label: 'Misconfiguration', icon: Wrench,       chip: 'bg-[#f1f4f5] text-[#5c707a]' },
  security:         { label: 'Security event',   icon: ShieldAlert,  chip: 'bg-[#fdf1ef] text-[#b73520]' },
  expected:         { label: 'Expected change',  icon: CalendarCheck, chip: 'bg-[#e3f0e8] text-[#2f7d52]' },
};

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const gb = (n: number) => `${Math.round(n).toLocaleString('en-US')} GB`;

// What the anomaly has actually done so far, in GB and in dollars. Silence has
// no dollar figure on purpose — the damage is missing data, and pricing it as a
// saving would be exactly the wrong signal.
function impact(a: Anomaly) {
  const from = a.actual.findIndex((v, i) => Math.abs(v - a.baseline[i]) > a.baseline[i] * TOLERANCE);
  const start = from === -1 ? a.actual.length : from;
  let deltaGb = 0;
  let missedGb = 0;
  for (let i = start; i < a.actual.length; i++) {
    const d = a.actual[i] - a.baseline[i];
    if (d > 0) deltaGb += d; else missedGb += -d;
  }
  const expected = a.baseline.slice(start).reduce((x, y) => x + y, 0) || 1;
  const observed = a.actual.slice(start).reduce((x, y) => x + y, 0);
  const ratio = observed / expected;
  return {
    start,
    deltaGb,
    missedGb,
    extraCost: deltaGb * PRICE,
    ratioLabel: a.kind === 'silent' ? '0% of expected' : `${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}% vs baseline`,
    days: a.actual.length - start,
  };
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex align-middle">
      <Info className="w-3 h-3 text-[#092E3F]/35 hover:text-[#2A96A8] cursor-help transition-colors" />
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-[#092E3F] text-white text-[11px] normal-case tracking-normal font-normal leading-relaxed rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-20 pointer-events-none">
        {children}
      </span>
    </span>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function AnomalySpark({ a }: { a: Anomaly }) {
  const w = 104, h = 34, pad = 2;
  const meta = KIND_META[a.kind];
  const yMax = Math.max(...a.actual, ...a.baseline.map(v => v * (1 + TOLERANCE))) * 1.1 || 1;
  const x = (i: number) => (i / (DAYS - 1)) * w;
  const y = (v: number) => h - pad - (v / yMax) * (h - pad * 2);
  const upper = a.baseline.map((v, i) => `${x(i).toFixed(1)} ${y(v * (1 + TOLERANCE)).toFixed(1)}`);
  const lower = a.baseline.map((v, i) => `${x(i).toFixed(1)} ${y(v * (1 - TOLERANCE)).toFixed(1)}`).reverse();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <path d={`M${upper.join(' L ')} L ${lower.join(' L ')} Z`} fill="#eef1f3" />
      <path d={'M' + a.actual.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ')}
        fill="none" stroke={meta.line} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function AnomalyChart({ a }: { a: Anomaly }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640, h = 220;
  const m = { top: 16, right: 20, bottom: 26, left: 54 };
  const iw = w - m.left - m.right;
  const ih = h - m.top - m.bottom;
  const meta = KIND_META[a.kind];
  const imp = impact(a);
  const yMax = Math.max(...a.actual, ...a.baseline.map(v => v * (1 + TOLERANCE))) * 1.12 || 1;
  const x = (i: number) => m.left + (i / (DAYS - 1)) * iw;
  const y = (v: number) => m.top + ih - (v / yMax) * ih;

  const upper = a.baseline.map((v, i) => `${x(i).toFixed(1)} ${y(v * (1 + TOLERANCE)).toFixed(1)}`);
  const lower = a.baseline.map((v, i) => `${x(i).toFixed(1)} ${y(v * (1 - TOLERANCE)).toFixed(1)}`).reverse();
  const ticks = [0, yMax / 2, yMax];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          const i = Math.round(((px - m.left) / iw) * (DAYS - 1));
          setHover(i >= 0 && i < DAYS ? i : null);
        }}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={m.left} y1={y(t)} x2={m.left + iw} y2={y(t)} stroke="#e4e7ec" strokeWidth="1" />
            <text x={m.left - 8} y={y(t) + 3.5} textAnchor="end" className="fill-[#87999f]" style={{ fontSize: 9 }}>
              {Math.round(t)} GB
            </text>
          </g>
        ))}
        {[0, 4, 8, 13].map(t => (
          <text key={t} x={x(t)} y={m.top + ih + 16} textAnchor="middle" className="fill-[#87999f]" style={{ fontSize: 9 }}>
            {t === 13 ? 'today' : `${9 + t} Aug`}
          </text>
        ))}

        {/* the detection threshold itself, drawn */}
        <path d={`M${upper.join(' L ')} L ${lower.join(' L ')} Z`} fill="#eef1f3" />
        <path d={'M' + a.baseline.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ')}
          fill="none" stroke="#9aa2b1" strokeWidth="1" strokeDasharray="3 3" />

        {/* when it broke out */}
        {imp.start < DAYS && (
          <line x1={x(imp.start)} y1={m.top} x2={x(imp.start)} y2={m.top + ih}
            stroke={meta.line} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3" />
        )}

        <path d={'M' + a.actual.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ')}
          fill="none" stroke={meta.line} strokeWidth="2" strokeLinejoin="round" />
        {a.actual.map((v, i) =>
          Math.abs(v - a.baseline[i]) > a.baseline[i] * TOLERANCE ? (
            <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={meta.line} stroke="#fff" strokeWidth="1.5" />
          ) : null
        )}

        {hover != null && (
          <line x1={x(hover)} y1={m.top} x2={x(hover)} y2={m.top + ih} stroke="#092E3F" strokeOpacity="0.2" strokeWidth="1" />
        )}
      </svg>

      {hover != null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none bg-[#092E3F] text-white text-[11px] leading-relaxed rounded-lg shadow-lg px-2.5 py-2 whitespace-nowrap z-10"
          style={{ left: `${(x(hover) / w) * 100}%`, top: `${(y(a.actual[hover]) / h) * 100}%` }}
        >
          <span className="font-medium">{9 + hover} Aug</span>
          <span className="block text-white/70">
            {gb(a.actual[hover])} · expected {gb(a.baseline[hover])}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 mt-1 pl-[54px] flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
          <span className="w-4 h-[2px] rounded-full" style={{ background: meta.line }} />
          Observed
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
          <span className="w-4 border-t border-dashed border-[#9aa2b1]" />
          7-day baseline
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#092E3F]/70">
          <span className="w-4 h-2.5 rounded-[2px] bg-[#eef1f3] border border-gray-200" />
          Within ±50% — no alert
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IngestionAnomalies() {
  const [items, setItems] = useState<Anomaly[]>(ANOMALIES);
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const [openOnly, setOpenOnly] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const rows = useMemo(() => items.map(a => ({ a, i: impact(a) })), [items]);
  const needle = q.trim().toLowerCase();
  const visible = rows.filter(({ a }) =>
    (!needle || a.source.toLowerCase().includes(needle)) &&
    (kindFilter === 'all' || a.kind === kindFilter) &&
    (!openOnly || a.cause === 'unreviewed')
  );

  const totals = useMemo(() => {
    const open = rows.filter(({ a }) => a.cause === 'unreviewed');
    return {
      open: open.length,
      total: rows.length,
      extraCost: open.reduce((s, { i }) => s + i.extraCost, 0),
      silent: open.filter(({ a }) => a.kind === 'silent').length,
      missedGb: open.reduce((s, { i }) => s + i.missedGb, 0),
      kinds: rows.reduce((acc, { a }) => { acc[a.kind] = (acc[a.kind] || 0) + 1; return acc; }, {} as Record<Kind, number>),
    };
  }, [rows]);

  const resolve = (id: string, cause: Exclude<Cause, 'unreviewed'>) => {
    const a = items.find(x => x.id === id);
    if (!a) return;
    setItems(prev => prev.map(x => x.id !== id ? x : {
      ...x,
      cause,
      timeline: [...x.timeline, { at: '22 Aug 14:32', text: `Resolved as ${CAUSE_META[cause].label.toLowerCase()} by John Doe` }],
    }));
    toast.success(`${a.source} — resolved as ${CAUSE_META[cause].label.toLowerCase()}`);
  };

  const reopen = (id: string) => {
    setItems(prev => prev.map(x => x.id !== id ? x : {
      ...x,
      cause: 'unreviewed',
      timeline: [...x.timeline, { at: '22 Aug 14:32', text: 'Reopened by John Doe' }],
    }));
    toast.success('Anomaly reopened');
  };

  const addNote = (id: string) => {
    const text = noteText.trim();
    if (!text) return;
    setItems(prev => prev.map(x => x.id !== id ? x : {
      ...x,
      notes: [...x.notes, { id: `n-${x.notes.length + 1}-${x.id}`, who: 'John Doe', at: '22 Aug 14:32', text }],
    }));
    setNoteText('');
    toast.success('Note added');
  };

  const detail = rows.find(({ a }) => a.id === detailId) ?? null;

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <TriangleAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[#092E3F] text-xl font-semibold">Ingestion Anomalies</h1>
                <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">Cost</span>
                <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-medium bg-[#f1f4f5] text-[#5c707a]">Version A</span>
              </div>
              <p className="text-sm text-[#092E3F]/60">
                Ingestion running above its usual pattern costs money. Ingestion that stops costs coverage. Both show up here.
              </p>
            </div>
          </div>
        </div>

        {/* Totals. Cost and coverage are deliberately separate figures — a silent
            source has no dollar value, and averaging it into one number would
            hide the more urgent of the two. */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Open anomalies" value={String(totals.open)} sub={`${totals.total - totals.open} reviewed and closed`} />
          <StatCard
            label="Extra cost so far"
            value={money(totals.extraCost)}
            sub="from open spikes, at $2.76/GB"
            accent={totals.extraCost > 0 ? 'bad' : undefined}
          />
          <StatCard
            label="Data not collected"
            value={gb(totals.missedGb)}
            sub="from open silences and drops"
            accent={totals.missedGb > 0 ? 'bad' : undefined}
          />
          <div className="bg-[#092E3F] rounded-[6px] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#2A96A8]">Sources silent</p>
            <p className="text-2xl font-semibold text-white tabular-nums mt-1">{totals.silent}</p>
            <p className="text-xs text-white/55 mt-0.5">
              {totals.silent === 0 ? 'every source is reporting' : 'detections on these tables are not running'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-[#092E3F]">Anomalies</h2>
          <span className="text-xs text-[#6b828c] inline-flex items-center gap-1">
            detected against a 7-day baseline
            <InfoTip>
              Each table has a rolling 7-day baseline. Anything more than <span className="font-semibold">50% above</span> it
              is flagged as a spike, more than <span className="font-semibold">50% below</span> as a drop, and no data at all
              as a silent source.
              <span className="block mt-1.5">The shaded band on each chart is that threshold, so a row&rsquo;s graph shows exactly why it fired.</span>
            </InfoTip>
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setOpenOnly(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium border transition-colors ${
              openOnly ? 'bg-[#e5f2f4] border-[#2A96A8]/40 text-[#1e7d8f]' : 'bg-white border-gray-200 text-[#092E3F]/70 hover:bg-[#f6f6f6]'
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${openOnly ? '' : 'opacity-30'}`} />
            Open only
          </button>
          <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[4px]">
            <FilterBtn active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>All {rows.length}</FilterBtn>
            {(['spike', 'drop', 'silent'] as Kind[]).map(k => (
              <FilterBtn key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                {KIND_META[k].label.replace('Ingestion ', '').replace('Source ', '')} {totals.kinds[k] ?? 0}
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
        </div>

        <div className={TABLE_SHELL}>
          <div className={GRID_SCROLL}>
            <div className={`grid grid-cols-[minmax(200px,1.4fr)_minmax(150px,0.9fr)_minmax(150px,1.1fr)_minmax(130px,0.75fr)_minmax(128px,0.7fr)_minmax(150px,0.8fr)_46px] gap-3 ${GRID_HEAD}`}>
              <div>Log source</div><div>What happened</div><div>Detected</div>
              <div>Impact</div><div>Pattern</div><div>Cause</div><div />
            </div>

            {visible.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#6b828c]">
                {openOnly ? 'No open anomalies. Every source is inside its baseline.' : 'No anomalies match this filter.'}
              </p>
            )}

            <div className={GRID_BODY}>
              {visible.map(({ a, i }) => {
                const Icon = SOURCE_ICON[a.icon];
                const km = KIND_META[a.kind];
                const KindIcon = km.icon;
                const cm = CAUSE_META[a.cause];
                const CauseIcon = cm.icon;
                return (
                  <div
                    key={a.id}
                    onClick={() => setDetailId(a.id)}
                    className={`grid grid-cols-[minmax(200px,1.4fr)_minmax(150px,0.9fr)_minmax(150px,1.1fr)_minmax(130px,0.75fr)_minmax(128px,0.7fr)_minmax(150px,0.8fr)_46px] gap-3 items-center cursor-pointer ${GRID_ROW}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                      <p className="font-mono text-xs font-medium text-[#092E3F] truncate">{a.source}</p>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${km.chip}`}>
                        <KindIcon className="w-3 h-3 shrink-0" />
                        {km.label}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-[#092E3F]">{a.detectedAt}</p>
                      <p className="text-[11px] text-[#6b828c]">{a.window}</p>
                    </div>

                    {/* Cost for spikes, missing data for silences — never a dollar
                        figure on a blind spot. */}
                    <div className="text-xs tabular-nums">
                      {a.kind === 'spike' ? (
                        <>
                          <span className="text-[#c07d1e] font-medium">{money(i.extraCost)}</span>
                          <span className="block text-[11px] text-[#6b828c]">{gb(i.deltaGb)} extra</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[#b73520] font-medium">{gb(i.missedGb)}</span>
                          <span className="block text-[11px] text-[#6b828c]">not collected</span>
                        </>
                      )}
                    </div>

                    <div title={`${i.ratioLabel} over ${i.days} day${i.days !== 1 ? 's' : ''}`}>
                      <AnomalySpark a={a} />
                      <p className="text-[11px] text-[#6b828c] tabular-nums">{i.ratioLabel}</p>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${cm.chip}`}>
                        <CauseIcon className="w-3 h-3 shrink-0" />
                        {cm.label}
                      </span>
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
        const { a, i } = detail;
        const Icon = SOURCE_ICON[a.icon];
        const km = KIND_META[a.kind];
        const KindIcon = km.icon;
        const cm = CAUSE_META[a.cause];
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDetailId(null)} />
            <div className="relative w-[740px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#2A96A8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-base font-semibold text-white truncate">{a.source}</p>
                  <p className="text-xs text-white/55 mt-0.5">Detected {a.detectedAt} · {a.window}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${km.chip}`}>
                  <KindIcon className="w-3 h-3" />
                  {km.label}
                </span>
                <button
                  onClick={() => setDetailId(null)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[4px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-5 border-b border-gray-200">
                  <AnomalyChart a={a} />
                </div>

                <div className="px-6 py-5 border-b border-gray-200">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2">What the detector saw</p>
                  <p className="text-xs text-[#092E3F]/80 leading-relaxed">{a.finding}</p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <MiniStat label="Against baseline" value={i.ratioLabel} />
                    {a.kind === 'spike' ? (
                      <>
                        <MiniStat label="Extra volume" value={gb(i.deltaGb)} />
                        <MiniStat label="Extra cost" value={money(i.extraCost)} bad />
                      </>
                    ) : (
                      <>
                        <MiniStat label="Data not collected" value={gb(i.missedGb)} bad />
                        <MiniStat label="Cost effect" value="None — coverage loss" />
                      </>
                    )}
                  </div>
                </div>

                {/* The decision this page exists for: is it broken, is it an
                    attack, or did we do it on purpose? */}
                <div className="px-6 py-5 border-b border-gray-200">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-2.5">
                    {a.cause === 'unreviewed' ? 'What caused this?' : 'Cause'}
                  </p>
                  {a.cause === 'unreviewed' ? (
                    <div className="flex gap-2.5 flex-wrap">
                      {(['misconfiguration', 'security', 'expected'] as const).map(c => {
                        const meta = CAUSE_META[c];
                        const CIcon = meta.icon;
                        return (
                          <button
                            key={c}
                            onClick={() => resolve(a.id, c)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F] hover:border-[#2A96A8] hover:bg-[#e5f2f4] transition-colors"
                          >
                            <CIcon className="w-3.5 h-3.5" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[11px] font-medium ${cm.chip}`}>
                        <cm.icon className="w-3 h-3" />
                        {cm.label}
                      </span>
                      <div className="flex-1" />
                      <button
                        onClick={() => reopen(a.id)}
                        className="px-3 py-1.5 border border-gray-200 rounded-[4px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                      >
                        Reopen
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-6 py-5 border-b border-gray-200">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-3">Timeline</p>
                  <ol>
                    {a.timeline.slice().reverse().map((e, idx) => (
                      <li key={idx} className="flex gap-3 pb-4 last:pb-0">
                        <span className="relative flex flex-col items-center shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2A96A8] mt-1.5" />
                          {idx < a.timeline.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <p className="text-xs text-[#092E3F]">{e.text}</p>
                          <p className="text-[11px] text-[#6b828c] mt-0.5">{e.at}</p>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="px-6 py-5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c] mb-3">Notes {a.notes.length}</p>
                  {a.notes.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {a.notes.map(n => (
                        <div key={n.id} className="flex items-start gap-3">
                          <span className="w-7 h-7 shrink-0 rounded-full bg-[#e5f2f4] text-[#1e7d8f] text-[10px] font-medium flex items-center justify-center">
                            {n.who.split(' ').map(p => p[0]).join('').slice(0, 2)}
                          </span>
                          <div className="flex-1 min-w-0 bg-[#fafbfb] border border-gray-200 rounded-[4px] px-3.5 py-2.5">
                            <p className="text-xs">
                              <span className="font-medium text-[#092E3F]">{n.who}</span>
                              <span className="text-[#6b828c]"> · {n.at}</span>
                            </p>
                            <p className="text-xs text-[#092E3F]/80 mt-1 leading-relaxed">{n.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      rows={2}
                      placeholder="Add a note…"
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] resize-y focus:outline-none focus:border-[#2A96A8]"
                    />
                    <button
                      onClick={() => addNote(a.id)}
                      disabled={!noteText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2A96A8] text-white rounded-[4px] text-xs font-medium hover:bg-[#1e7d8f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Note
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-3.5 flex items-center justify-end shrink-0">
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

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: 'bad' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[6px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${accent === 'bad' ? 'text-[#b73520]' : 'text-[#092E3F]'}`}>{value}</p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-[4px] px-3.5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${bad ? 'text-[#b73520]' : 'text-[#092E3F]'}`}>{value}</p>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-[4px] text-xs font-medium capitalize transition-colors ${
        active ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]' : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      {children}
    </button>
  );
}
