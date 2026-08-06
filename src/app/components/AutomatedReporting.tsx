import { useState, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  FileText, Presentation, Image as ImageIcon, Users, Search,
  Check, Loader2, Database, AlertTriangle, Upload, Download,
} from 'lucide-react';

// ─── Data model ───────────────────────────────────────────────────────────────
// Prototype only. Mirrors Seculyze's per-client automated report delivery:
// each client has its own on/off, send day, channel and SLA config — the same
// config the client themselves sees in their portal.

type Channel = 'email' | 'itsm' | 'unset';
type Sla = 'business_hours' | '24x7';
type DeliveryStatus = 'sent' | 'scheduled' | 'off' | 'failed';

interface ClientDelivery {
  id: string;
  clientName: string;
  contactEmail: string | null;
  automatic: boolean;
  dayOfMonth: number | null;
  channel: Channel;
  sla: Sla;
  hasItsm: boolean;
  lastSent: { label: string; status: DeliveryStatus } | null;
  hasLogo: boolean; // inherited from Client Registry
}

const INITIAL_CLIENTS: ClientDelivery[] = [
  { id: 'c1', clientName: 'Test04 SomeName A/S', contactEmail: 'kristian@seculyze.com', automatic: true, dayOfMonth: 1, channel: 'email', sla: 'business_hours', hasItsm: false, lastSent: { label: 'Sent 31 Jul', status: 'sent' }, hasLogo: false },
  { id: 'c2', clientName: 'procost-pro-008', contactEmail: 'kristian@seculyze.com', automatic: true, dayOfMonth: 28, channel: 'email', sla: 'business_hours', hasItsm: false, lastSent: { label: 'Sent 31 Jul', status: 'sent' }, hasLogo: false },
  { id: 'c3', clientName: 'protune-pro-009', contactEmail: null, automatic: false, dayOfMonth: null, channel: 'unset', sla: 'business_hours', hasItsm: false, lastSent: null, hasLogo: false },
  { id: 'c4', clientName: 'Nike EMEA', contactEmail: 'soc-contact@nike.com', automatic: true, dayOfMonth: 5, channel: 'itsm', sla: '24x7', hasItsm: true, lastSent: { label: 'Sent 5 Aug', status: 'sent' }, hasLogo: true },
  { id: 'c5', clientName: 'Adidas Group', contactEmail: 'security@adidas.com', automatic: true, dayOfMonth: 15, channel: 'email', sla: 'business_hours', hasItsm: false, lastSent: { label: 'Scheduled 15 Aug', status: 'scheduled' }, hasLogo: true },
  { id: 'c6', clientName: 'Apple Retail', contactEmail: 'itsec@apple.com', automatic: true, dayOfMonth: 3, channel: 'itsm', sla: '24x7', hasItsm: false, lastSent: { label: 'Failed 3 Aug', status: 'failed' }, hasLogo: true },
  { id: 'c7', clientName: 'Microsoft Partner Ops', contactEmail: 'reports@microsoft.com', automatic: true, dayOfMonth: 1, channel: 'email', sla: '24x7', hasItsm: false, lastSent: { label: 'Sent 1 Aug', status: 'sent' }, hasLogo: true },
  { id: 'c8', clientName: 'Google Cloud Sec', contactEmail: 'gcpsec@google.com', automatic: false, dayOfMonth: null, channel: 'unset', sla: 'business_hours', hasItsm: true, lastSent: null, hasLogo: false },
  { id: 'c9', clientName: 'Amazon Retail', contactEmail: 'compliance@amazon.com', automatic: true, dayOfMonth: 20, channel: 'email', sla: 'business_hours', hasItsm: false, lastSent: { label: 'Scheduled 20 Aug', status: 'scheduled' }, hasLogo: true },
  { id: 'c10', clientName: 'Tesla Energy', contactEmail: 'secops@tesla.com', automatic: true, dayOfMonth: 10, channel: 'email', sla: '24x7', hasItsm: false, lastSent: { label: 'Sent 10 Aug', status: 'sent' }, hasLogo: false },
  { id: 'c11', clientName: 'Meta Platforms', contactEmail: 'infosec@meta.com', automatic: false, dayOfMonth: null, channel: 'unset', sla: 'business_hours', hasItsm: false, lastSent: null, hasLogo: true },
  { id: 'c12', clientName: 'Netflix Studios', contactEmail: 'sec-reports@netflix.com', automatic: true, dayOfMonth: 25, channel: 'itsm', sla: 'business_hours', hasItsm: true, lastSent: { label: 'Sent 25 Jul', status: 'sent' }, hasLogo: false },
];

// Deterministic colour per client, for the logo-present initials badge.
const LOGO_COLORS = ['#2A96A8', '#c07d1e', '#2f7d52', '#c2453d', '#5c707a', '#1e7d8f'];
function logoColor(name: string) {
  const seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return LOGO_COLORS[seed % LOGO_COLORS.length];
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const STATUS_META: Record<DeliveryStatus, { label: string; cls: string }> = {
  sent: { label: '', cls: 'bg-[#e3f0e8] text-[#2f7d52]' },
  scheduled: { label: '', cls: 'bg-[#e5f2f4] text-[#1e7d8f]' },
  off: { label: 'Off', cls: 'bg-gray-100 text-[#87999f]' },
  failed: { label: '', cls: 'bg-[#f7e6e4] text-[#c2453d]' },
};

const PAGE_SIZE = 5;

function rowsEqual(a: ClientDelivery, b: ClientDelivery) {
  return a.automatic === b.automatic && a.dayOfMonth === b.dayOfMonth && a.channel === b.channel && a.sla === b.sla;
}

export default function AutomatedReporting() {
  const [mode, setMode] = useState<'multi' | 'single'>('multi');

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#092E3F] text-xl font-semibold">Automated Reporting</h1>
              <p className="text-sm text-[#092E3F]/60">
                {mode === 'multi'
                  ? 'Generate client reports, manage your template, and configure automatic monthly delivery.'
                  : 'Generate your report, manage your template, and configure automatic monthly delivery.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#eef1f3] rounded-[4px] p-1 shrink-0">
            <button
              onClick={() => setMode('multi')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${mode === 'multi' ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'}`}
            >
              Multi-tenant
            </button>
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${mode === 'single' ? 'bg-white text-[#092E3F] shadow-sm' : 'text-[#092E3F]/60 hover:text-[#092E3F]'}`}
            >
              Single-tenant
            </button>
          </div>
        </div>

        <GenerateReportCard singleTenant={mode === 'single'} />
        <TemplateBrandingCard singleTenant={mode === 'single'} />
        {mode === 'multi' ? <DeliveryTableCard /> : <SingleTenantDeliveryCard />}
        <WhatsIncludedCard />
      </div>
    </div>
  );
}

// ─── Card 1 — Generate Report ─────────────────────────────────────────────────

const CLIENT_OPTIONS = INITIAL_CLIENTS.map(c => c.clientName);
const DATE_RANGES = ['Current Month', 'Last Month', 'Last 3 Months'] as const;

function GenerateReportCard({ singleTenant }: { singleTenant?: boolean }) {
  const [client, setClient] = useState('');
  const [dateRange, setDateRange] = useState<typeof DATE_RANGES[number]>('Current Month');
  const [sla, setSla] = useState<Sla>('business_hours');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canGenerate = singleTenant || !!client;

  const generate = () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setReportReady(false);
    setTimeout(() => {
      setIsGenerating(false);
      setReportReady(true);
      toast.success(`Report generated${singleTenant ? '' : ` for ${client}`}`);
    }, 1200);
  };

  const exportPptx = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      toast.success('PowerPoint exported');
    }, 900);
  };

  return (
    <Card icon={FileText} title="Generate Report">
      <div className={`grid ${singleTenant ? 'grid-cols-2' : 'grid-cols-3'} gap-4 mb-4`}>
        {!singleTenant && (
          <Labeled label="Client">
            <select
              value={client}
              onChange={e => { setClient(e.target.value); setReportReady(false); }}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
            >
              <option value="">Select a client…</option>
              {CLIENT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Labeled>
        )}
        <Labeled label="Date Range">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as typeof DATE_RANGES[number])}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
          >
            {DATE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Labeled>
        <Labeled label="SLA Coverage" hint="Controls how mean times (acknowledge, resolve, close) are calculated.">
          <select
            value={sla}
            onChange={e => setSla(e.target.value as Sla)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
          >
            <option value="business_hours">Business hours (Mon–Fri, 07:00–17:00)</option>
            <option value="24x7">24×7</option>
          </select>
        </Labeled>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-3 py-1.5 bg-[#f6f6f6] rounded-[4px] text-xs text-[#092E3F]">01 Aug 2026</span>
        <span className="text-[#87999f]">→</span>
        <span className="px-3 py-1.5 bg-[#f6f6f6] rounded-[4px] text-xs text-[#092E3F]">31 Aug 2026</span>

        <button
          onClick={generate}
          disabled={!canGenerate || isGenerating}
          title={!canGenerate ? 'Select a client first' : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-sm font-medium hover:bg-[#092E3F]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {isGenerating ? 'Generating…' : 'Generate Report'}
        </button>

        <button
          onClick={exportPptx}
          disabled={!reportReady || isExporting}
          title={!reportReady ? 'Generate a report first' : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c9d6dc] text-[#092E3F] rounded-[4px] text-sm font-medium hover:border-[#092E3F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
          {isExporting ? 'Exporting…' : 'Get PowerPoint'}
        </button>

        {!canGenerate && <span className="text-xs text-[#87999f]">Select a client to generate a report.</span>}
      </div>
    </Card>
  );
}

// ─── Card 2 — Template ─────────────────────────────────────────────────────────
// Applies to every client's report — one active template at a time: either the
// Seculyze default, or a single custom upload (uploading again replaces it).

function TemplateBrandingCard({ singleTenant }: { singleTenant?: boolean }) {
  const [customTemplate, setCustomTemplate] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);

  const mockAction = (msg: string) => toast.success(msg);
  const activeName = useCustom && customTemplate ? customTemplate : 'Seculyze default template';

  const uploadTemplate = () => {
    const name = customTemplate ? 'Nike custom deck (2).pptx' : 'Nike custom deck.pptx';
    setCustomTemplate(name);
    setUseCustom(true);
    toast.success(`"${name}" uploaded and applied${singleTenant ? '' : ' to all clients'}`);
  };

  const removeCustomTemplate = () => {
    setCustomTemplate(null);
    setUseCustom(false);
    toast.success('Custom template removed — using default');
  };

  return (
    <Card icon={Presentation} title="Template">
      <p className="text-xs text-[#092E3F]/60 mb-4">
        {singleTenant
          ? "Applies to your report — choose the default, or upload one custom template to use instead."
          : "Applies to every client's report — choose the default, or upload one custom template to use instead."}
      </p>

      <div className="space-y-2.5 mb-4">
        <RadioRow checked={!useCustom} onClick={() => setUseCustom(false)} label="Seculyze default template" />
        <RadioRow
          checked={useCustom}
          onClick={() => customTemplate && setUseCustom(true)}
          label={customTemplate ? customTemplate : 'Custom template (upload one below)'}
          disabled={!customTemplate}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <SecondaryButton icon={Download} onClick={() => mockAction('Sample deck downloaded')}>Download sample</SecondaryButton>
        <SecondaryButton icon={Download} onClick={() => mockAction(`"${activeName}" downloaded`)}>Download active template</SecondaryButton>
        <SecondaryButton icon={Upload} onClick={uploadTemplate}>{customTemplate ? 'Replace template' : 'Upload template'}</SecondaryButton>
        {customTemplate && (
          <button onClick={removeCustomTemplate} className="text-xs text-[#c2453d] hover:underline">Remove custom template</button>
        )}
      </div>
      <p className="text-xs text-[#87999f]">Data is placed into named anchor shapes; keep those intact when editing the template.</p>
    </Card>
  );
}

// ─── Card 3 — Automatic delivery table ────────────────────────────────────────

function DeliveryTableCard() {
  const [saved, setSaved] = useState<ClientDelivery[]>(INITIAL_CLIENTS);
  const [draft, setDraft] = useState<ClientDelivery[]>(INITIAL_CLIENTS);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDay, setBulkDay] = useState('');
  const [bulkChannel, setBulkChannel] = useState('');
  const [page, setPage] = useState(1);
  const [confirmSave, setConfirmSave] = useState<{ type: 'row'; id: string } | { type: 'bulk' } | null>(null);

  const patchRow = (id: string, patch: Partial<ClientDelivery>) => {
    setDraft(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const dirtyIds = useMemo(() => new Set(
    draft.filter(d => {
      const s = saved.find(x => x.id === d.id)!;
      return !rowsEqual(d, s);
    }).map(d => d.id)
  ), [draft, saved]);

  const filtered = useMemo(() => draft.filter(c =>
    c.clientName.toLowerCase().includes(search.toLowerCase()) || (c.contactEmail ?? '').toLowerCase().includes(search.toLowerCase())
  ), [draft, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAllOnPage = () => {
    const pageIds = pageRows.map(r => r.id);
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };
  const selectAllMatching = () => setSelected(new Set(filtered.map(r => r.id)));

  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));

  const commitRow = (id: string) => {
    setSaved(prev => prev.map(r => r.id === id ? draft.find(d => d.id === id)! : r));
    toast.success('Delivery config saved');
    setConfirmSave(null);
  };

  const commitAllDirty = () => {
    const count = dirtyIds.size;
    setSaved(draft);
    toast.success(`Saved ${count} change${count !== 1 ? 's' : ''}`);
    setConfirmSave(null);
  };

  const applyBulk = (patch: Partial<ClientDelivery>) => {
    setDraft(prev => prev.map(r => selected.has(r.id) ? { ...r, ...patch } : r));
  };

  return (
    <Card icon={Users} title="Automatic delivery — your clients">
      <p className="text-xs text-[#092E3F]/60 mb-4">
        Configure how and when the previous month's report is auto-sent for each client. This edits the client's own delivery config — the same setting the client sees. Email goes to the client's registry contact; ITSM requires the client to have an ITSM integration configured.
      </p>

      {/* Search + save-all */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b828c]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search clients…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
          />
        </div>
        <div className="ml-auto">
          {dirtyIds.size > 0 && (
            <button
              onClick={() => setConfirmSave({ type: 'bulk' })}
              className="flex items-center gap-2 px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-sm font-medium hover:bg-[#092E3F]/90 transition-colors"
            >
              <Check className="w-4 h-4" /> Save {dirtyIds.size} change{dirtyIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Bulk-edit bar */}
      {selected.size > 0 && (
        <div className="mb-3 bg-gradient-to-r from-[#2A96A8]/10 to-[#e5f2f4] border border-[#2A96A8]/30 rounded-[4px] p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-[#092E3F] whitespace-nowrap">
            {selected.size} client{selected.size !== 1 ? 's' : ''} selected
          </span>
          {allPageSelected && !allFilteredSelected && filtered.length > pageRows.length && (
            <button onClick={selectAllMatching} className="text-xs text-[#2A96A8] hover:underline whitespace-nowrap">
              Select all clients
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <button onClick={() => applyBulk({ automatic: true })} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] hover:border-[#092E3F] transition-colors">Turn On</button>
            <button onClick={() => applyBulk({ automatic: false, dayOfMonth: null, channel: 'unset' })} className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] hover:border-[#092E3F] transition-colors">Turn Off</button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[#092E3F]/70">
            Day of month
            <select
              value={bulkDay}
              onChange={e => { setBulkDay(e.target.value); applyBulk({ dayOfMonth: Number(e.target.value) }); }}
              className="px-2 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F]"
            >
              <option value="" disabled>Select…</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#092E3F]/70">
            Channel
            <select
              value={bulkChannel}
              onChange={e => { setBulkChannel(e.target.value); applyBulk({ channel: e.target.value as Channel }); }}
              className="px-2 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F]"
            >
              <option value="" disabled>Select…</option>
              <option value="email">Email</option>
              <option value="itsm">ITSM</option>
            </select>
          </label>
          <button onClick={() => { setSelected(new Set()); setBulkDay(''); setBulkChannel(''); }} className="ml-auto text-xs text-[#092E3F]/60 hover:text-[#092E3F]">Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-[4px] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#f9fafb]">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={pageRows.length > 0 && pageRows.every(r => selected.has(r.id))}
                  onChange={toggleSelectAllOnPage}
                  className="rounded-[3px]"
                />
              </th>
              {['Logo', 'Client', 'Automatic', 'Day of month', 'Channel', 'SLA', 'Last sent', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-xs uppercase tracking-wide text-[#6b828c] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(row => {
              const isDirty = dirtyIds.has(row.id);
              return (
                <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-[#fafbfb]">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded-[3px]" />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.hasLogo ? (
                      <div
                        className="w-8 h-8 rounded-[4px] flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                        style={{ backgroundColor: logoColor(row.clientName) }}
                        title={`${row.clientName} logo`}
                      >
                        {initials(row.clientName)}
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-[4px] border border-dashed border-[#c9d6dc] flex items-center justify-center shrink-0"
                        title="No logo on file — upload one in Client Registry to include it on this client's report."
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#b7c4c9]" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#c07d1e] shrink-0" title="Unsaved changes" />}
                      <div>
                        <p className="text-sm text-[#092E3F]">{row.clientName}</p>
                        {row.contactEmail && <p className="text-[11px] text-[#87999f]">{row.contactEmail}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={row.automatic ? 'on' : 'off'}
                      onChange={e => {
                        const on = e.target.value === 'on';
                        patchRow(row.id, on ? { automatic: true, dayOfMonth: row.dayOfMonth ?? 1, channel: row.channel === 'unset' ? 'email' : row.channel } : { automatic: false, dayOfMonth: null, channel: 'unset' });
                      }}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
                    >
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={row.dayOfMonth ?? ''}
                      disabled={!row.automatic}
                      onChange={e => patchRow(row.id, { dayOfMonth: Number(e.target.value) })}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] disabled:bg-gray-50 disabled:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
                    >
                      {!row.automatic && <option value="">—</option>}
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={row.channel}
                      disabled={!row.automatic}
                      onChange={e => patchRow(row.id, { channel: e.target.value as Channel })}
                      title={!row.hasItsm ? 'ITSM requires the client to have an ITSM integration configured' : undefined}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] disabled:bg-gray-50 disabled:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
                    >
                      {!row.automatic && <option value="unset">Select…</option>}
                      <option value="email">Email</option>
                      <option value="itsm" disabled={!row.hasItsm}>ITSM{!row.hasItsm ? ' (not configured)' : ''}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={row.sla}
                      onChange={e => patchRow(row.id, { sla: e.target.value as Sla })}
                      className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-[4px] text-xs text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
                    >
                      <option value="business_hours">Business hours</option>
                      <option value="24x7">24×7</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.lastSent ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META[row.lastSent.status].cls}`}>
                        {row.lastSent.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                        {row.lastSent.label}
                      </span>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META.off.cls}`}>Off</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setConfirmSave({ type: 'row', id: row.id })}
                      disabled={!isDirty}
                      className="px-3 py-1.5 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pageRows.length === 0 && (
          <div className="text-center py-10">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No clients match your search</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-[#87999f]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs text-[#092E3F] rounded-[4px] hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-[4px] text-xs font-medium ${p === page ? 'bg-[#092E3F] text-white' : 'text-[#092E3F] hover:bg-gray-100'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs text-[#092E3F] rounded-[4px] hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {confirmSave && (
        <ConfirmDialog
          title="Save delivery changes?"
          message={
            confirmSave.type === 'row'
              ? `This updates the automatic delivery config for ${draft.find(d => d.id === confirmSave.id)?.clientName} — the same setting the client sees in their portal.`
              : `This updates the automatic delivery config for ${dirtyIds.size} client${dirtyIds.size !== 1 ? 's' : ''} — the same setting each client sees in their portal.`
          }
          confirmLabel="Save"
          onCancel={() => setConfirmSave(null)}
          onConfirm={() => confirmSave.type === 'row' ? commitRow(confirmSave.id) : commitAllDirty()}
        />
      )}
    </Card>
  );
}

// ─── Card 3b — Single-tenant delivery config ──────────────────────────────────
// Same fields as a row in the multi-tenant table, but for one organization —
// no search, bulk actions or pagination needed.

interface OrgDelivery {
  automatic: boolean;
  dayOfMonth: number | null;
  channel: Channel;
  sla: Sla;
  lastSent: { label: string; status: DeliveryStatus } | null;
}

const INITIAL_ORG_DELIVERY: OrgDelivery = {
  automatic: true,
  dayOfMonth: 1,
  channel: 'email',
  sla: 'business_hours',
  lastSent: { label: 'Sent 31 Jul', status: 'sent' },
};

function SingleTenantDeliveryCard() {
  const [saved, setSaved] = useState<OrgDelivery>(INITIAL_ORG_DELIVERY);
  const [draft, setDraft] = useState<OrgDelivery>(INITIAL_ORG_DELIVERY);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (p: Partial<OrgDelivery>) => setDraft(prev => ({ ...prev, ...p }));

  const commit = () => {
    setSaved(draft);
    toast.success('Delivery config saved');
    setConfirmOpen(false);
  };

  return (
    <Card icon={Users} title="Automatic delivery">
      <p className="text-xs text-[#092E3F]/60 mb-4">
        Configure how and when your monthly report is auto-sent. Email goes to your registry contact; ITSM requires an ITSM integration configured.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <Labeled label="Automatic delivery">
          <select
            value={draft.automatic ? 'on' : 'off'}
            onChange={e => {
              const on = e.target.value === 'on';
              patch(on ? { automatic: true, dayOfMonth: draft.dayOfMonth ?? 1, channel: draft.channel === 'unset' ? 'email' : draft.channel } : { automatic: false, dayOfMonth: null, channel: 'unset' });
            }}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </Labeled>
        <Labeled label="Day of month">
          <select
            value={draft.dayOfMonth ?? ''}
            disabled={!draft.automatic}
            onChange={e => patch({ dayOfMonth: Number(e.target.value) })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] disabled:bg-gray-50 disabled:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
          >
            {!draft.automatic && <option value="">—</option>}
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Labeled>
        <Labeled label="Channel">
          <select
            value={draft.channel}
            disabled={!draft.automatic}
            onChange={e => patch({ channel: e.target.value as Channel })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] disabled:bg-gray-50 disabled:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8]"
          >
            {!draft.automatic && <option value="unset">Select…</option>}
            <option value="email">Email</option>
            <option value="itsm">ITSM</option>
          </select>
        </Labeled>
        <Labeled label="SLA">
          <select
            value={draft.sla}
            onChange={e => patch({ sla: e.target.value as Sla })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] focus:outline-none focus:border-[#2A96A8]"
          >
            <option value="business_hours">Business hours</option>
            <option value="24x7">24×7</option>
          </select>
        </Labeled>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#87999f]">Last sent:</span>
          {draft.lastSent ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META[draft.lastSent.status].cls}`}>
              {draft.lastSent.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
              {draft.lastSent.label}
            </span>
          ) : (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_META.off.cls}`}>Off</span>
          )}
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!isDirty}
          className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-sm font-medium hover:bg-[#092E3F]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Save delivery changes?"
          message="This updates your organization's automatic delivery config — the same setting you see in the client portal."
          confirmLabel="Save"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={commit}
        />
      )}
    </Card>
  );
}

// ─── Card 4 — What's included ──────────────────────────────────────────────────

function WhatsIncludedCard() {
  const AREAS = [
    { icon: Database, title: 'Log Analytics data', description: "Identity, sign-in and response metrics queried from your Log Analytics workspace — risky users, geographical and blocked logins, device and user changes, top alerts, alerts handled, the most common alert, and mean time to acknowledge, resolve and close." },
    { icon: AlertTriangle, title: 'Incidents', description: 'Incident metrics from the Seculyze database — incidents by severity and classification, alerts enriched with threat intelligence, incident growth versus the previous period, and total analyst comments.' },
    { icon: FileText, title: 'Calibrate', description: 'Coverage and ingestion metrics from Service Health — MITRE ATT&CK tactic coverage and ingestion cost and volume.' },
  ];
  return (
    <Card icon={FileText} title="What's included">
      <p className="text-xs text-[#092E3F]/60 mb-4">Every report area is generated automatically. The report combines:</p>
      <div className="grid grid-cols-3 gap-4">
        {AREAS.map((a, i) => (
          <div key={i} className="border border-gray-200 rounded-[4px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <a.icon className="w-4 h-4 text-[#2A96A8]" />
              <h4 className="text-sm font-medium text-[#092E3F]">{a.title}</h4>
            </div>
            <p className="text-xs text-[#092E3F]/60 leading-relaxed">{a.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────────

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-[6px] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[#2A96A8]" />
        <h2 className="text-sm font-semibold text-[#092E3F]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#092E3F] mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[#87999f] mt-1 block">{hint}</span>}
    </label>
  );
}

function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-[6px] shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-[#092E3F] mb-2">{title}</h3>
        <p className="text-xs text-[#092E3F]/70 mb-5 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-[4px] text-xs font-medium text-[#092E3F] hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function RadioRow({ checked, onClick, label, disabled }: { checked: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <label onClick={disabled ? undefined : onClick} className={`flex items-center gap-2.5 w-fit ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'border-[#2A96A8]' : 'border-[#c4d2d6]'}`}>
        {checked && <div className="w-2 h-2 rounded-full bg-[#2A96A8]" />}
      </div>
      <span className={`text-sm ${disabled ? 'text-[#092E3F]/40' : 'text-[#092E3F]'}`}>{label}</span>
    </label>
  );
}

function SecondaryButton({ icon: Icon, onClick, children }: { icon: any; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-[#092E3F] rounded-[4px] text-xs font-medium hover:border-[#092E3F] transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}
