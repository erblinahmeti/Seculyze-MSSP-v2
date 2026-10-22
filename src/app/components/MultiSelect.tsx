import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { ALL_TENANTS } from './tenants';

// ─── Multi-select ────────────────────────────────────────────────────────────
//
// The Customers condition was declared `multi` in the register from the start
// and every builder rendered it as a plain <select> — so a flow could be
// scoped to exactly one tenant or to the literal string "All 60", and nothing
// in between. "Nike, Adidas and Puma" was unsayable, which is most of what an
// MSSP actually wants to say.
//
// The value stays a single string because that is what a FlowCondition holds
// and what the plain-English readback prints. Two forms are understood:
//
//   "All 60"              every tenant — kept as a phrase rather than sixty
//                         names, so the sentence stays readable and a new
//                         customer is covered without editing the flow
//   "Nike, Adidas, Puma"  a specific set
//
// That second point is the reason "all" is not just every box ticked: a flow
// scoped to all sixty names would quietly exclude the sixty-first tenant you
// onboard tomorrow.

/** True when the stored value means "every tenant", however it was written. */
export const meansAll = (value: string) => value.trim() === ALL_TENANTS;

export const parseSelection = (value: string): string[] =>
  value.trim() === '' || meansAll(value)
    ? []
    : value.split(',').map(v => v.trim()).filter(Boolean);

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** The builder's own control classes, so the field matches its surroundings. */
  className: string;
  /** Narrow columns get a tighter menu. */
  dense?: boolean;
}

export default function MultiSelect({ value, onChange, options, className, dense }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLInputElement>(null);

  const all = meansAll(value);
  const picked = useMemo(() => parseSelection(value), [value]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => box.current?.focus(), 30);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(t); window.removeEventListener('keydown', esc); };
  }, [open]);

  const matches = options.filter(o => o.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = (name: string) => {
    // Coming from "all", the first tick means "all except" would be a lie —
    // start the explicit list from that one name instead.
    const next = all
      ? [name]
      : pickedSet.has(name)
        ? picked.filter(p => p !== name)
        : [...picked, name];
    onChange(next.join(', '));
  };

  const summary = all
    ? ALL_TENANTS
    : picked.length === 0
      ? ''
      : picked.length <= 2
        ? picked.join(', ')
        : `${picked.length} customers`;

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={picked.length > 2 ? picked.join(', ') : undefined}
        className={`${className} w-full flex items-center gap-1.5 text-left`}
      >
        <span className={`flex-1 truncate ${summary ? '' : 'text-[#b7c4c9]'}`}>
          {summary || 'Choose…'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#6b828c]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 z-50 mt-1 bg-white rounded-[8px] shadow-xl border border-[var(--stroke)]
                           ${dense ? 'right-0 min-w-[240px]' : 'right-0 min-w-[280px]'}`}>
            <div className="relative border-b border-gray-100">
              <Search className="w-3.5 h-3.5 text-[#b7c4c9] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={box}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Find a customer"
                className="w-full pl-8 pr-3 py-2 text-xs text-[#092E3F] placeholder:text-[#b7c4c9] focus:outline-none"
              />
            </div>

            {/* "Every customer" is its own choice, not sixty ticks — it keeps
                covering tenants onboarded after this flow was written. */}
            <button
              type="button"
              onClick={() => { onChange(ALL_TENANTS); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs border-b border-gray-100 transition-colors ${
                all ? 'bg-[#2A96A8]/10 text-[#2A96A8]' : 'text-[#092E3F] hover:bg-gray-50'
              }`}
            >
              <span>Every customer <span className="text-[#87999f]">({options.length}, and any added later)</span></span>
              {all && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>

            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-100">
              <span className="text-[10px] uppercase tracking-wide text-[#87999f]">
                {all ? 'all selected' : `${picked.length} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange(matches.join(', '))}
                  className="text-[11px] text-[#1e7d8f] hover:underline"
                >
                  {q ? `Select these ${matches.length}` : 'Select each'}
                </button>
                {(all || picked.length > 0) && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="text-[11px] text-[#6b828c] hover:text-[#092E3F]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[220px] overflow-y-auto py-1">
              {matches.length === 0 && (
                <p className="px-3 py-3 text-xs text-[#87999f]">No customer matches</p>
              )}
              {matches.map(o => {
                const on = all || pickedSet.has(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggle(o)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#092E3F] hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-4 h-4 shrink-0 rounded-[4px] border flex items-center justify-center ${
                      on ? 'bg-[#2A96A8] border-[#2A96A8]' : 'border-[#c9d6dc]'
                    }`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{o}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* The chosen names, where there is room to show them. Three tenants in
          a row beats "3 customers" you have to open a menu to read. */}
      {!dense && !all && picked.length > 0 && picked.length <= 6 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {picked.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[10px] bg-[#eef1f3] text-[#5c707a]"
            >
              {p}
              <button
                type="button"
                onClick={() => onChange(picked.filter(x => x !== p).join(', '))}
                className="hover:text-[#092E3F]"
                title={`Remove ${p}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
