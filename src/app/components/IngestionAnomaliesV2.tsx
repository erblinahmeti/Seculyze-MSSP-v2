import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  TriangleAlert, Search, X, Info, Play, OctagonX, ShieldQuestion, Check,
  MonitorCheck, Shield, Terminal, Cloud, KeyRound, Activity, Mail, FileText,
} from 'lucide-react';
import { TABLE_SHELL_OPEN, GRID_HEAD, GRID_ROW, GRID_BODY, GRID_SCROLL } from './tableStyles';
import Pagination from './Pagination';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only. An alternative take on Ingestion Anomalies: instead of a list
// of past anomalies to triage, this is a live hourly view with a circuit
// breaker. Every source is measured against its expected hourly ingestion; 450%
// is a warning and 650% is where Seculyze may cut ingestion off — if, and only
// if, the source has been opted in.

type SourceIcon = 'monitor-check' | 'shield' | 'terminal' | 'cloud' | 'key-round' | 'activity' | 'mail' | 'file-text';

const WARN = 4.5;   // 450% of expected hourly ingestion
const STOP = 6.5;   // 650% — the automatic-stop threshold
const HOURS = 24;

interface HourSource {
  id: string;
  name: string;
  icon: SourceIcon;
  // Expected MB for each hour, not one flat number — ingestion has a daily
  // shape, so the 450%/650% lines have to follow it rather than sit flat.
  baseline: number[];
  hours: number[];        // observed MB per hour, [23] is the last full hour
  autoStop: boolean;
  stoppedAt: string | null;
}

// A day of hourly volume with a working-hours bulge, so "normal" has a shape.
function day(baseMb: number, seed: number, bend?: (v: number, h: number) => number): number[] {
  const shape = [.62, .55, .5, .48, .5, .6, .78, .95, 1.12, 1.2, 1.18, 1.15,
    1.1, 1.14, 1.18, 1.16, 1.08, .98, .9, .84, .8, .74, .7, .66];
  return Array.from({ length: HOURS }, (_, h) => {
    const wobble = 1 + (((h * 7 + seed * 13) % 9) - 4) / 100;
    const v = baseMb * shape[h] * wobble;
    return Math.max(0, Math.round(bend ? bend(v, h) : v));
  });
}

const SOURCES: HourSource[] = [
  {
    id: 'sec', name: 'SecurityEvent', icon: 'monitor-check', baseline: day(9600, 0),
    hours: day(9600, 0), autoStop: false, stoppedAt: null,
  },
  {
    // Climbing hard and past the warning line, but not yet at the stop line.
    id: 'csl', name: 'CommonSecurityLog', icon: 'shield', baseline: day(5760, 3),
    hours: day(5760, 3, (v, h) => (h >= 19 ? v * (1 + (h - 18) * 0.84) : v)),
    autoStop: true, stoppedAt: null,
  },
  {
    // Went past 650% with auto-stop armed, so ingestion is already cut.
    id: 'perf', name: 'Perf', icon: 'activity', baseline: day(1400, 6),
    hours: day(1400, 6, (v, h) => (h >= 18 && h < 22 ? v * (2 + (h - 17) * 1.4) : h >= 22 ? 0 : v)),
    autoStop: true, stoppedAt: '13:04',
  },
  {
    // Same breach, no opt-in — so nothing was stopped and it is still running.
    id: 'azact', name: 'AzureActivity', icon: 'file-text', baseline: day(340, 2),
    hours: day(340, 2, (v, h) => (h >= 20 ? v * (2.5 + (h - 19) * 1.2) : v)),
    autoStop: false, stoppedAt: null,
  },
  {
    id: 'azd', name: 'AzureDiagnostics', icon: 'cloud', baseline: day(2770, 5),
    hours: day(2770, 5, (v, h) => (h >= 21 ? v * 2.6 : v)),
    autoStop: false, stoppedAt: null,
  },
  {
    // Nothing at all for the last few hours.
    id: 'sign', name: 'SigninLogs', icon: 'key-round', baseline: day(1620, 4),
    hours: day(1620, 4, (v, h) => (h >= 21 ? 0 : v)),
    autoStop: false, stoppedAt: null,
  },
  {
    // Spiked in the night, already back to normal — nothing to do.
    id: 'off', name: 'OfficeActivity', icon: 'mail', baseline: day(2130, 2),
    hours: day(2130, 2, (v, h) => (h >= 6 && h < 10 ? v * 4.6 : v)),
    autoStop: true, stoppedAt: null,
  },
  {
    id: 'sys', name: 'Syslog', icon: 'terminal', baseline: day(3580, 1),
    hours: day(3580, 1), autoStop: false, stoppedAt: null,
  },
];

const SOURCE_ICON: Record<SourceIcon, typeof TriangleAlert> = {
  'monitor-check': MonitorCheck, shield: Shield, terminal: Terminal, cloud: Cloud,
  'key-round': KeyRound, activity: Activity, mail: Mail, 'file-text': FileText,
};

type Attention = 'stopped' | 'critical' | 'warning' | 'elevated' | 'nodata' | 'normal';

const ATTENTION_META: Record<Attention, { label: string; chip: string; line: string }> = {
  stopped:  { label: 'Ingestion stopped', chip: 'bg-[#b73520] text-white',        line: '#b73520' },
  critical: { label: 'Over 650%',         chip: 'bg-[#fdf1ef] text-[#b73520]',    line: '#b73520' },
  warning:  { label: 'Over 450%',         chip: 'bg-[#f7efdf] text-[#c07d1e]',    line: '#c07d1e' },
  elevated: { label: 'Elevated',          chip: 'bg-[#f1f4f5] text-[#5c707a]',    line: '#5c707a' },
  nodata:   { label: 'No data',           chip: 'bg-[#fdf1ef] text-[#b73520]',    line: '#b73520' },
  normal:   { label: 'Normal',            chip: 'bg-[#e3f0e8] text-[#2f7d52]',    line: '#2f7d52' },
};

const mb = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)} GB` : `${Math.round(n)} MB`;

function read(s: HourSource) {
  const lastHour = s.hours[HOURS - 1];
  const expectedNow = s.baseline[HOURS - 1];
  const ratio = expectedNow === 0 ? 0 : lastHour / expectedNow;
  const attention: Attention =
    s.stoppedAt != null ? 'stopped'
      : lastHour === 0 ? 'nodata'
        : ratio >= STOP ? 'critical'
          : ratio >= WARN ? 'warning'
            : ratio >= 1.5 ? 'elevated'
              : 'normal';
  // Peak of the last 24h matters even when the current hour looks calm.
  const peak = Math.max(...s.hours);
  const peakRatio = Math.max(...s.hours.map((v, i) => (s.baseline[i] ? v / s.baseline[i] : 0)));
  return { lastHour, expectedNow, ratio, attention, peak, peakRatio };
}

function InfoTip({ children, align = 'center' }: { children: React.ReactNode; align?: 'center' | 'right' }) {
  const pos = align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className="relative group/tip inline-flex align-middle">
      <Info className="w-3 h-3 text-[#092E3F]/35 hover:text-[#2A96A8] cursor-help transition-colors" />
      <span className={`absolute ${pos} top-full mt-2 w-72 p-3 bg-[#092E3F] text-white text-[11px] normal-case tracking-normal font-normal leading-relaxed rounded-[8px] shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-30 pointer-events-none`}>
        {children}
      </span>
    </span>
  );
}

// ─── The 24-hour chart ────────────────────────────────────────────────────────
// Ingestion against three flat references: expected, 450%, and 650%. The two
// thresholds are drawn because they are the decision — one warns, the other can
// cut the source off.

const SERIES = [
  { key: 'ingestion', label: 'Ingestion', colour: '#2A96A8' },
  { key: 'baseline',  label: 'Baseline',  colour: '#9aa2b1' },
  { key: 'warn',      label: `${WARN * 100}% Threshold`, colour: '#e0a72f' },
  { key: 'stop',      label: `${STOP * 100}% Threshold`, colour: '#f3a193' },
] as const;

function HourChart({ s, w, h }: { s: HourSource; w: number; h: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const m = { t: 12, r: 12, b: 36, l: 48 };
  const iw = w - m.l - m.r;
  const ih = h - m.t - m.b;
  const warn = s.baseline.map(v => v * WARN);
  const stop = s.baseline.map(v => v * STOP);
  const yMax = Math.max(...s.hours, ...stop) * 1.08 || 1;
  const x = (i: number) => m.l + ((i + 0.5) / HOURS) * iw;
  const y = (v: number) => m.t + ih - (v / yMax) * ih;
  const barW = Math.max(2, (iw / HOURS) * 0.55);
  const path = (arr: number[]) => 'M' + arr.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ');
  // Hours run to the last full hour; index 23 is the hour that just closed.
  const hourStart = (i: number) => `${String((i + 15) % 24).padStart(2, '0')}:00`;
  const hourEnd = (i: number) => `${String((i + 16) % 24).padStart(2, '0')}:00`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        className="block overflow-visible"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * w;
          const i = Math.floor(((px - m.l) / iw) * HOURS);
          setHover(i >= 0 && i < HOURS ? i : null);
        }}
      >
        {/* frame */}
        <line x1={m.l} y1={m.t} x2={m.l} y2={m.t + ih} stroke="#e4e7ec" strokeWidth="1" />
        <line x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} stroke="#e4e7ec" strokeWidth="1" />

        <text
          transform={`rotate(-90 ${m.l - 34} ${m.t + ih / 2})`}
          x={m.l - 34} y={m.t + ih / 2} textAnchor="middle"
          className="fill-[#87999f]" style={{ fontSize: 9 }}
        >
          Size (MB)
        </text>
        {[yMax, 0].map((t, i) => (
          <text key={i} x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="fill-[#87999f]" style={{ fontSize: 9 }}>
            {mb(t)}
          </text>
        ))}
        {Array.from({ length: HOURS }, (_, i) => i).filter(i => i % 2 === 0).map(i => (
          <text
            key={i}
            transform={`rotate(-45 ${x(i)} ${m.t + ih + 10})`}
            x={x(i)} y={m.t + ih + 10} textAnchor="end"
            className="fill-[#87999f]" style={{ fontSize: 8.5 }}
          >
            {hourStart(i)}
          </text>
        ))}

        {hover != null && (
          <rect x={x(hover) - (iw / HOURS) / 2} y={m.t} width={iw / HOURS} height={ih} fill="#092E3F" fillOpacity="0.04" />
        )}

        {/* observed volume, as bars */}
        {s.hours.map((v, i) => (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={y(v)}
            width={barW}
            height={Math.max(0, m.t + ih - y(v))}
            fill="#2A96A8"
            fillOpacity={hover == null || hover === i ? 0.9 : 0.55}
            rx="1"
          />
        ))}

        {/* what was expected, and the two lines that trigger something */}
        <path d={path(s.baseline)} fill="none" stroke="#9aa2b1" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
        <path d={path(warn)} fill="none" stroke="#e0a72f" strokeWidth="1.5" strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={path(stop)} fill="none" stroke="#f3a193" strokeWidth="1.5" strokeDasharray="5 4" strokeLinejoin="round" />
      </svg>

      {hover != null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none bg-[#092E3F] text-white rounded-[8px] shadow-lg px-3 py-2 whitespace-nowrap z-30"
          style={{ left: `${(x(hover) / w) * 100}%`, top: `${(m.t + ih * 0.35) / h * 100}%` }}
        >
          <p className="text-[11px] font-medium mb-1">{hourStart(hover)} – {hourEnd(hover)} (UTC)</p>
          {SERIES.map(ser => {
            const value = ser.key === 'ingestion' ? s.hours[hover]
              : ser.key === 'baseline' ? s.baseline[hover]
                : ser.key === 'warn' ? warn[hover] : stop[hover];
            return (
              <p key={ser.key} className="flex items-center gap-1.5 text-[11px] text-white/85 leading-relaxed">
                <span className="w-2.5 h-2.5 rounded-[8px] shrink-0" style={{ background: ser.colour }} />
                {ser.label}: <span className="tabular-nums">{mb(value)}</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IngestionAnomaliesV2() {
  const [sources, setSources] = useState<HourSource[]>(SOURCES);
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; kind: 'arm' | 'stop' } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = useMemo(() => sources.map(s => ({ s, r: read(s) })), [sources]);
  const needle = q.trim().toLowerCase();
  const matches = rows.filter(({ s }) => !needle || s.name.toLowerCase().includes(needle));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const visible = matches.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [needle]);

  const totals = useMemo(() => ({
    lastHour: rows.reduce((a, { r }) => a + r.lastHour, 0),
    needAttention: rows.filter(({ r }) => r.attention !== 'normal').length,
    armed: rows.filter(({ s }) => s.autoStop).length,
    stopped: rows.filter(({ s }) => s.stoppedAt != null).length,
  }), [rows]);

  const setAuto = (id: string, on: boolean) => {
    const s = sources.find(x => x.id === id);
    if (!s) return;
    setSources(prev => prev.map(x => x.id !== id ? x : { ...x, autoStop: on }));
    setConfirm(null);
    toast.success(on
      ? `${s.name} — automatic stop armed at ${STOP * 100}%`
      : `${s.name} — automatic stop turned off`);
  };

  const stopNow = (id: string) => {
    const s = sources.find(x => x.id === id);
    if (!s) return;
    setSources(prev => prev.map(x => x.id !== id ? x : { ...x, stoppedAt: '14:32', hours: [...x.hours.slice(0, -1), 0] }));
    setConfirm(null);
    toast.success(`${s.name} — ingestion stopped`);
  };

  const resume = (id: string) => {
    const s = sources.find(x => x.id === id);
    if (!s) return;
    setSources(prev => prev.map(x => x.id !== id ? x : {
      ...x, stoppedAt: null, hours: [...x.hours.slice(0, -1), Math.round(x.baseline[HOURS - 1] * 1.05)],
    }));
    toast.success(`${s.name} — ingestion resumed`);
  };

  const confirmSrc = confirm ? sources.find(s => s.id === confirm.id) ?? null : null;
  const detail = rows.find(({ s }) => s.id === detailId) ?? null;

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6">

        <div className="mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#092E3F] flex items-center justify-center shrink-0">
            <TriangleAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[#092E3F] text-xl font-semibold">Ingestion Anomalies</h1>
              <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#e5f2f4] text-[#1e7d8f]">Cost</span>
              <span className="px-1.5 py-0.5 rounded-[8px] text-[10px] font-medium bg-[#f1f4f5] text-[#5c707a]">Version B</span>
            </div>
            <p className="text-sm text-[#092E3F]/60">
              Live hourly ingestion against what each source is expected to send, with a stop at {STOP * 100}%.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Ingested last hour" value={mb(totals.lastHour)} sub={`across ${rows.length} log sources`} />
          <StatCard label="Need attention" value={String(totals.needAttention)} sub="above expected, silent, or stopped"
            accent={totals.needAttention > 0 ? 'bad' : undefined} />
          <StatCard label="Automatic stop armed" value={`${totals.armed} of ${rows.length}`} sub={`will cut off at ${STOP * 100}% of expected`} />
          <div className="bg-[#092E3F] rounded-[8px] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#2A96A8]">Currently stopped</p>
            <p className="text-2xl font-semibold text-white tabular-nums mt-1">{totals.stopped}</p>
            <p className="text-xs text-white/55 mt-0.5">
              {totals.stopped === 0 ? 'every source is ingesting' : 'no data is reaching Sentinel from these'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-[#092E3F]">Log Sources</h2>
          {matches.length !== rows.length && <span className="text-xs text-[#6b828c]">{matches.length} matching</span>}
          <div className="flex-1" />
          <div className="relative w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b828c]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search log sources"
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[var(--stroke)] rounded-[8px] text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
            />
          </div>
        </div>

        <div className={TABLE_SHELL_OPEN}>
          <div className={GRID_SCROLL}>
            <div className={`grid grid-cols-[minmax(180px,1fr)_minmax(112px,0.5fr)_minmax(364px,2.2fr)_minmax(168px,0.7fr)_minmax(144px,0.6fr)_minmax(150px,0.65fr)] gap-3 ${GRID_HEAD}`}>
              <div>Log source</div>
              <div>Last hour</div>
              <div className="flex items-center gap-1">
                Last 24 hours
                <InfoTip>
                  Ingestion per hour in MB, against three flat lines: the{' '}
                  <span className="font-semibold">expected</span> hourly volume for this source, and the{' '}
                  <span className="font-semibold">{WARN * 100}%</span> and{' '}
                  <span className="font-semibold">{STOP * 100}%</span> thresholds. Hover any point for the hour and volume.
                </InfoTip>
              </div>
              <div className="flex items-center gap-1">
                Allow automatic stop
                <InfoTip>
                  Allow Seculyze to forcibly stop ingestion on this log source if it breaches{' '}
                  <span className="font-semibold">{STOP * 100}%</span> of expected hourly ingestion.
                  <span className="block mt-1.5">
                    While stopped, nothing from this source reaches Sentinel and detections on it do not run.
                  </span>
                </InfoTip>
              </div>
              <div>Attention</div>
              <div>Action</div>
            </div>

            {matches.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#6b828c]">No log sources match this search.</p>
            )}

            <div className={GRID_BODY}>
              {visible.map(({ s, r }) => {
                const Icon = SOURCE_ICON[s.icon];
                const am = ATTENTION_META[r.attention];
                return (
                  <div key={s.id} className={`grid grid-cols-[minmax(180px,1fr)_minmax(112px,0.5fr)_minmax(364px,2.2fr)_minmax(168px,0.7fr)_minmax(144px,0.6fr)_minmax(150px,0.65fr)] gap-3 items-center ${GRID_ROW}`}>
                    <button onClick={() => setDetailId(s.id)} className="flex items-center gap-2.5 min-w-0 text-left">
                      <Icon className="w-4 h-4 text-[#1e7d8f] shrink-0" />
                      <p className="font-mono text-sm font-medium text-[#092E3F] truncate hover:underline">{s.name}</p>
                    </button>

                    <div className="text-sm tabular-nums">
                      <span className={r.attention === 'normal' || r.attention === 'elevated' ? 'text-[#092E3F]' : 'font-medium'}
                        style={{ color: r.attention === 'normal' || r.attention === 'elevated' ? undefined : am.line }}>
                        {mb(r.lastHour)}
                      </span>
                      <span className="block text-[11px] text-[#6b828c]">
                        {r.lastHour === 0 ? 'nothing received' : `${Math.round(r.ratio * 100)}% of expected`}
                      </span>
                    </div>

                    <div className="cursor-crosshair"><HourChart s={s} w={352} h={128} /></div>

                    {/* The opt-in. Arming it is a real consequence, so it confirms;
                        switching it off never needs to ask. */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => s.autoStop ? setAuto(s.id, false) : setConfirm({ id: s.id, kind: 'arm' })}
                        role="switch"
                        aria-checked={s.autoStop}
                        title={s.autoStop ? 'Turn off automatic stop' : 'Allow automatic stop'}
                        className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${s.autoStop ? 'bg-[#2A96A8]' : 'bg-[#c9d1d6]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(9,46,63,0.25)] transition-transform ${s.autoStop ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-[11px] ${s.autoStop ? 'text-[#092E3F]' : 'text-[#6b828c]'}`}>
                        {s.autoStop ? 'Armed' : 'Off'}
                      </span>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-[11px] font-medium ${am.chip}`}>
                        {am.label}
                      </span>
                      {s.stoppedAt && <span className="block text-[11px] text-[#6b828c] mt-0.5">since {s.stoppedAt}</span>}
                      {!s.stoppedAt && r.peakRatio >= WARN && r.attention === 'normal' && (
                        <span className="block text-[11px] text-[#6b828c] mt-0.5">peaked {Math.round(r.peakRatio * 100)}% today</span>
                      )}
                    </div>

                    <div className="flex justify-start">
                      {s.stoppedAt ? (
                        <button
                          onClick={() => resume(s.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2A96A8] text-white rounded-[8px] text-sm font-medium hover:bg-[#1e7d8f] transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </button>
                      ) : r.attention === 'critical' ? (
                        <button
                          onClick={() => setConfirm({ id: s.id, kind: 'stop' })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#b73520] text-[#b73520] rounded-[8px] text-sm font-medium hover:bg-[#fdf1ef] transition-colors"
                        >
                          <OctagonX className="w-3.5 h-3.5" />
                          Stop now
                        </button>
                      ) : r.attention === 'nodata' ? (
                        <button
                          onClick={() => toast.info(`${s.name} — opening connector health`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                        >
                          <ShieldQuestion className="w-3.5 h-3.5" />
                          Check connector
                        </button>
                      ) : r.attention === 'warning' || r.attention === 'elevated' ? (
                        <button
                          onClick={() => setDetailId(s.id)}
                          className="px-3 py-1.5 bg-white border border-[var(--stroke)] rounded-[8px] text-sm font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                        >
                          Investigate
                        </button>
                      ) : (
                        <span className="text-sm text-[#87999f]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={matches.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Confirmations. Both of these end with less security data being
          collected, so neither happens on a single click. */}
      {confirm && confirmSrc && (() => {
        const arming = confirm.kind === 'arm';
        const r = read(confirmSrc);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6">
            <div className="absolute inset-0" onClick={() => setConfirm(null)} />
            <div className="relative w-[560px] bg-white rounded-[8px] shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--stroke)]">
                <p className="text-base font-semibold text-[#092E3F]">
                  {arming ? 'Allow automatic stop' : 'Stop ingestion now'}
                </p>
                <p className="text-xs text-[#6b828c] mt-0.5">
                  On <span className="font-mono font-medium text-[#092E3F]/80">{confirmSrc.name}</span>
                  {arming ? '' : ` · currently ${Math.round(r.ratio * 100)}% of expected`}
                </p>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-[#092E3F]/80 leading-relaxed mb-4">
                  {arming
                    ? <>Seculyze will forcibly stop ingestion on this log source if it breaches <span className="font-medium">{STOP * 100}%</span> of expected hourly ingestion — <span className="font-medium">{mb(confirmSrc.baseline[HOURS - 1] * STOP)}</span> in an hour, against an expected <span className="font-medium">{mb(confirmSrc.baseline[HOURS - 1])}</span>.</>
                    : <>Ingestion on this source stops immediately and stays stopped until you resume it.</>}
                </p>
                <div className="flex gap-2.5 px-3 py-3 bg-[#fdf1ef] border-l-2 border-[#b73520] rounded-[8px]">
                  <TriangleAlert className="w-4 h-4 text-[#b73520] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-[#8a2b1b]">
                    While stopped, nothing from this source reaches Sentinel. Analytics rules on this table will not
                    run and the events are not recoverable afterwards — a spike caused by an attack would go
                    uncollected exactly when it matters.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-[var(--stroke)] bg-[#fafbfb]">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 bg-white border border-[var(--stroke)] rounded-[8px] text-xs font-medium text-[#092E3F]/70 hover:bg-[#f6f6f6] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => arming ? setAuto(confirmSrc.id, true) : stopNow(confirmSrc.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#b73520] text-white rounded-[8px] text-xs font-medium hover:bg-[#96291a] transition-colors"
                >
                  {arming ? <><Check className="w-3.5 h-3.5" />Allow automatic stop</> : <><OctagonX className="w-3.5 h-3.5" />Stop ingestion</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail drawer — the same chart with axes and labelled thresholds. */}
      {detail && (() => {
        const { s, r } = detail;
        const Icon = SOURCE_ICON[s.icon];
        const am = ATTENTION_META[r.attention];
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDetailId(null)} />
            <div className="relative w-[720px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
              <div className="bg-[#092E3F] px-6 py-5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#2A96A8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-base font-semibold text-white truncate">{s.name}</p>
                  <p className="text-xs text-white/55 mt-0.5">Last 24 hours · expected {mb(r.expectedNow)} this hour</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-[11px] font-medium ${am.chip}`}>
                  {am.label}
                </span>
                <button
                  onClick={() => setDetailId(null)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-[8px] transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-4 bg-[#fafbfb] border-b border-[var(--stroke)] shrink-0">
                <MiniStat label="Last hour" value={mb(r.lastHour)} pl />
                <MiniStat label="Of expected" value={`${Math.round(r.ratio * 100)}%`} />
                <MiniStat label="Peak today" value={mb(r.peak)} />
                <MiniStat label="Automatic stop" value={s.autoStop ? `Armed at ${STOP * 100}%` : 'Off'} />
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <HourChart s={s} w={640} h={280} />
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
    <div className="bg-white border border-[var(--stroke)] rounded-[8px] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums mt-1 ${accent === 'bad' ? 'text-[#b73520]' : 'text-[#092E3F]'}`}>{value}</p>
      <p className="text-xs text-[#6b828c] mt-0.5">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, pl }: { label: string; value: string; pl?: boolean }) {
  return (
    <div className={`py-3 ${pl ? 'px-6' : ''}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b828c]">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5 text-[#092E3F]">{value}</p>
    </div>
  );
}
