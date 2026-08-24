import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Settings as SettingsIcon,
  AlertTriangle, ChevronDown, ChevronUp, Info, RefreshCw,
} from 'lucide-react';

// ─── Pricing data model ───────────────────────────────────────────────────────
// Prototype only. Mirrors how Seculyze derives a tenant's per-GB ingestion cost:
// a live Azure retail-price lookup (region + tier), a manual discount or a hard
// static override, minus an M365 E5 credit and a monthly free-GB allowance.

type PriceSource = 'live' | 'override' | 'default';
type PriceMode = 'discount' | 'override';

interface PricingConfig {
  azureRegion: string;
  tier: 'payg' | 'commitment';
  priceSource: PriceSource;
  regionUnitPrice: number; // EUR/GB, before discount/override
  currency: string;
  // Minutes since the last SUCCESSFUL Azure retail-price sync. The sync runs
  // hourly whether or not it succeeds, so this can be well over 60 while the
  // live lookup is failing and we sit on the cached rate.
  lastSyncMinsAgo: number | null;
  mode: PriceMode;
  discountPct: number;
  staticOverride: number | null;
  e5LicenseCount: number;
  freeGbPerMonth: number;
}

const INITIAL_PRICING: PricingConfig = {
  azureRegion: 'westeurope',
  tier: 'payg',
  priceSource: 'default',
  regionUnitPrice: 4.53,
  currency: 'EUR',
  lastSyncMinsAgo: 187,
  mode: 'discount',
  discountPct: 10,
  staticOverride: null,
  e5LicenseCount: 0,
  freeGbPerMonth: 100,
};

const PRICE_SOURCE_META: Record<PriceSource, { label: string; cls: string }> = {
  live:     { label: 'Live',              cls: 'bg-[#e5f2f4] text-[#1e7d8f]' },
  override: { label: 'Static override',   cls: 'bg-[#eef1f3] text-[#5c707a]' },
  default:  { label: 'Azure default',      cls: 'bg-[#f7efdf] text-[#c07d1e]' },
};

export default function Settings() {
  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto">
      <div className="p-6 max-w-[1200px] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[6px] bg-[#092E3F] flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[#092E3F] text-xl font-semibold">Settings</h1>
            <p className="text-sm text-[#092E3F]/60">Configure your preferences</p>
          </div>
        </div>

        {/* Section content — only Pricing for now; more sections (General,
            Notifications, Integrations) will come back as tabs later. */}
        <div className="bg-white border border-gray-200 rounded-[6px] p-6">
          <PricingSection />
        </div>
      </div>
    </div>
  );
}

function PricingSection() {
  const [saved, setSaved] = useState<PricingConfig>(INITIAL_PRICING);
  const [draft, setDraft] = useState<PricingConfig>(INITIAL_PRICING);
  const [showDerivation, setShowDerivation] = useState(false);

  const patch = (p: Partial<PricingConfig>) => setDraft(prev => ({ ...prev, ...p }));
  const isDirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const effectivePrice = draft.mode === 'override' && draft.staticOverride != null
    ? draft.staticOverride
    : draft.regionUnitPrice * (1 - draft.discountPct / 100);

  const priceSource: PriceSource = draft.mode === 'override' && draft.staticOverride != null
    ? 'override'
    : draft.priceSource;

  // The sync runs hourly on its own schedule, so "next in" is whatever is left
  // of the current hour — not an hour from the last success.
  const mins = draft.lastSyncMinsAgo;
  const stale = mins == null || mins >= 60;
  const syncLabel = mins == null
    ? 'never'
    : mins < 60
      ? `${mins} min ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)} h ${mins % 60} min ago`
        : `${Math.floor(mins / 1440)} d ago`;
  const nextSyncLabel = mins == null ? '—' : `${60 - (mins % 60)} min`;

  const handleSave = () => {
    setSaved(draft);
    toast.success('Pricing configuration saved — takes effect on the next calculation run');
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-[#092E3F] pb-3 mb-4 border-b border-gray-100">Pricing</h2>

      {/* Status banner — calmer than a solid alert bar, but still unmissable */}
      {draft.priceSource === 'default' && (
        <div className="flex items-start gap-2.5 mb-5 pl-3 pr-4 py-3 bg-[#f7efdf] border-l-2 border-[#c07d1e] rounded-[4px]">
          <AlertTriangle className="w-4 h-4 text-[#c07d1e] mt-0.5 shrink-0" />
          <p className="text-xs text-[#8a5f16]">
            <span className="font-medium">Using the Sentinel Azure default price</span> — the live retail lookup for <span className="font-mono">{draft.azureRegion}</span> is unavailable, so figures use Microsoft&rsquo;s published default rate for Sentinel ingestion rather than a Seculyze rate.
          </p>
        </div>
      )}

      {/* Derived summary */}
      <div className="border border-gray-200 rounded-[4px] mb-6 overflow-hidden">
        <div className="divide-y divide-gray-100">
          <SummaryRow label="Azure region" value={draft.azureRegion} />
          <SummaryRow label="Tier" value={draft.tier} />
          <SummaryRow
            label="Price source"
            value={<span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PRICE_SOURCE_META[priceSource].cls}`}>{PRICE_SOURCE_META[priceSource].label}</span>}
          />
          <SummaryRow label="Unit price" value={`${draft.regionUnitPrice.toFixed(2)} ${draft.currency}/GB`} />
          <SummaryRow
            label={draft.mode === 'override' && draft.staticOverride != null ? 'Static override' : 'Discount applied'}
            value={draft.mode === 'override' && draft.staticOverride != null ? `${draft.staticOverride.toFixed(2)} ${draft.currency}/GB` : `${draft.discountPct}%`}
          />
          <SummaryRow label="Effective price" value={<span className="font-semibold">{effectivePrice.toFixed(2)} {draft.currency}/GB</span>} />
        </div>

        {/* Where the Azure price comes from and when it moves next, sat beside
            when an edit here starts counting — the two questions an analyst
            asks together. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2.5 bg-[#fafbfb] border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-xs text-[#092E3F]/60">
            <RefreshCw className="w-3.5 h-3.5 text-[#2A96A8] shrink-0" />
            {stale ? (
              <>
                Azure prices last updated <span className="font-medium text-[#092E3F]">{syncLabel}</span>
                <span className="text-[#092E3F]/40">— checked every hour, retrying</span>
              </>
            ) : (
              <>
                Azure prices last updated <span className="font-medium text-[#092E3F]">{syncLabel}</span>
                <span className="text-[#092E3F]/40">— checked every hour, next in {nextSyncLabel}</span>
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#092E3F]/50">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Your changes take effect on the next calculation run.
          </span>
        </div>
        <button
          onClick={() => setShowDerivation(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[#092E3F] bg-[#f6f6f6] hover:bg-[#eef1f3] transition-colors"
        >
          How was this derived?
          {showDerivation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDerivation && (
          <div className="px-4 py-3 space-y-1.5 bg-[#fafbfb] text-xs text-[#092E3F]/70">
            <p>1. Base rate for <span className="font-mono">{draft.azureRegion}</span> / {draft.tier} — {draft.regionUnitPrice.toFixed(2)} {draft.currency}/GB ({draft.priceSource === 'default' ? 'Sentinel Azure default rate — live retail API unavailable' : 'live Azure retail price API'}).</p>
            {draft.mode === 'override' && draft.staticOverride != null ? (
              <p>2. Static override applied — replaces the base rate entirely: {draft.staticOverride.toFixed(2)} {draft.currency}/GB.</p>
            ) : (
              <p>2. Discount of {draft.discountPct}% applied → {effectivePrice.toFixed(2)} {draft.currency}/GB.</p>
            )}
            <p>3. M365 E5 credit — {draft.e5LicenseCount} license{draft.e5LicenseCount !== 1 ? 's' : ''} {draft.e5LicenseCount > 0 ? 'applied against eligible Sentinel/Defender ingestion' : '(no effect)'}.</p>
            <p>4. First {draft.freeGbPerMonth} GB/month are not billed under the free allowance.</p>
          </div>
        )}
      </div>

      {/* How the tenant is priced. The two options are mutually exclusive, so a
          segmented control states that structurally and only the chosen one's
          input is ever on screen — no permanently greyed-out second field. */}
      <div className="mb-6">
        <span className="text-xs font-medium text-[#092E3F] mb-2 block">How this tenant is priced</span>
        <div className="inline-flex p-0.5 bg-[#f1f4f5] rounded-[6px]">
          <SegmentBtn active={draft.mode === 'discount'} onClick={() => patch({ mode: 'discount' })}>
            Discount on Azure price
          </SegmentBtn>
          <SegmentBtn active={draft.mode === 'override'} onClick={() => patch({ mode: 'override' })}>
            Fixed price
          </SegmentBtn>
        </div>

        <div className="mt-3 p-4 border border-gray-200 rounded-[4px] bg-[#fafbfb]">
          {draft.mode === 'discount' ? (
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <SuffixField
                label="Discount"
                suffix="%"
                width="w-28"
                value={draft.discountPct}
                onChange={v => patch({ discountPct: Number(v) || 0 })}
              />
              <p className="text-xs text-[#092E3F]/60 pb-2.5">
                Azure price <span className="font-medium text-[#092E3F]">{draft.regionUnitPrice.toFixed(2)}</span>
                <span className="mx-1.5 text-[#092E3F]/35">&rarr;</span>
                <span className="font-semibold text-[#092E3F]">{effectivePrice.toFixed(2)} {draft.currency}/GB</span>
                <span className="text-[#092E3F]/40"> · follows Azure as it moves</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <SuffixField
                label="Fixed price"
                suffix={`${draft.currency}/GB`}
                width="w-32"
                placeholder="—"
                value={draft.staticOverride ?? ''}
                onChange={v => patch({ staticOverride: v === '' ? null : Number(v) })}
              />
              <p className="text-xs text-[#092E3F]/60 pb-2.5">
                Replaces the Azure price of{' '}
                <span className="font-medium text-[#092E3F]">{draft.regionUnitPrice.toFixed(2)} {draft.currency}/GB</span>
                <span className="text-[#092E3F]/40"> · stays put when Azure moves</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Credits and allowances apply either way. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
        <Field
          label="E5 license count"
          value={draft.e5LicenseCount}
          onChange={v => patch({ e5LicenseCount: v })}
        />
        <Field
          label="Free GB per month"
          value={draft.freeGbPerMonth}
          onChange={v => patch({ freeGbPerMonth: v })}
        />
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="px-4 py-2 bg-[#092E3F] text-white rounded-[4px] text-xs font-medium hover:bg-[#092E3F]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#092E3F]/50">{label}</span>
      <span className="text-sm text-[#092E3F]">{value}</span>
    </div>
  );
}

function SegmentBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-[#092E3F] shadow-[0px_1px_2px_0px_rgba(9,46,63,0.10)]'
          : 'text-[#092E3F]/55 hover:text-[#092E3F]/80'
      }`}
    >
      {children}
    </button>
  );
}

function SuffixField({ label, suffix, value, onChange, placeholder, width = 'w-32' }: {
  label: string;
  suffix: string;
  value: number | string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#092E3F] mb-1.5 block">{label}</span>
      <span className={`${width} flex items-center bg-white border border-gray-200 rounded-[4px] focus-within:border-[#2A96A8] transition-colors`}>
        <input
          type="number"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 px-3 py-2 bg-transparent text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none"
        />
        <span className="pr-3 text-xs text-[#092E3F]/40 whitespace-nowrap">{suffix}</span>
      </span>
    </label>
  );
}

function Field({ label, value, onChange, disabled, placeholder }: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#092E3F] mb-1.5 block">{label}</span>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-[4px] text-sm text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none focus:border-[#2A96A8] disabled:bg-gray-50 disabled:text-[#092E3F]/40"
      />
    </label>
  );
}
