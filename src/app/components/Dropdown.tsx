import { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// ─── Dropdown ────────────────────────────────────────────────────────────────
//
// A single-choice menu drawn by the page, for the places that used a native
// <select>. The native one hands its menu to the operating system, so on a
// Mac in dark mode it opened as a dark grey sheet with a blue highlight right
// next to MultiSelect's white one — two different-looking menus in the same
// row, and neither choice was ours.
//
// This uses MultiSelect's menu styling (white, the stroke, the shadow, teal
// for the chosen row) so every menu in the builder opens the same way.

export interface DropdownGroup {
  label?: string;
  options: { value: string; label: string }[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Plain options, or groups with a heading each (the playbook list). */
  options: string[] | DropdownGroup[];
  /** Shown while nothing is chosen. Omit for a menu that always has a value. */
  placeholder?: string;
  /** The builder's own control classes, so the field matches its surroundings. */
  className: string;
}

const asGroups = (o: string[] | DropdownGroup[]): DropdownGroup[] =>
  o.length > 0 && typeof o[0] === 'string'
    ? [{ options: (o as string[]).map(v => ({ value: v, label: v })) }]
    : (o as DropdownGroup[]);

export default function Dropdown({ value, onChange, options, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const groups = asGroups(options);
  const current = groups.flatMap(g => g.options).find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };

  return (
    <div className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className} w-full flex items-center gap-1.5 text-left`}
      >
        <span className={`flex-1 truncate ${current ? '' : 'text-[#b7c4c9]'}`}>
          {current?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#6b828c]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1 min-w-[200px] max-h-[260px] overflow-y-auto py-1
                       bg-white rounded-[8px] shadow-xl border border-[var(--stroke)]"
          >
            {groups.map((g, gi) => (
              <div key={gi} className={gi > 0 ? 'border-t border-gray-100 mt-1 pt-1' : ''}>
                {g.label && (
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[#87999f]">{g.label}</p>
                )}
                {g.options.map(o => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => choose(o.value)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                        on ? 'bg-[#2A96A8]/10 text-[#1e7d8f]' : 'text-[#092E3F] hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex-1 min-w-0 truncate">{o.label}</span>
                      {on && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
