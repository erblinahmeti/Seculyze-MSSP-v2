import { useEffect, useState } from 'react';
import { Square, SquareDashed } from 'lucide-react';

// ─── Border A/B switch ───────────────────────────────────────────────────────
//
// A facilitator's control for user testing: flip every card outline on and off
// to ask whether the stroke earns its place. It writes data-borders on <html>
// and the rule in globals.css does the rest, so the switch costs one attribute
// and no re-render of the page underneath.
//
// Deliberately small and bottom-right: a participant can ignore it, and the
// left corner is taken by the sidebar's own Settings/Help buttons. It sits
// above the bulk-action bar that slides up when rows are selected, so it stays
// clickable even then.

const KEY = 'seculyze:borders';

export default function BorderToggle() {
  const [on, setOn] = useState(true);

  // Restore the last choice, so a reload mid-session does not silently switch
  // the variant the participant was looking at.
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'off') setOn(false);
    } catch {
      /* private window — default to borders on */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.borders = on ? 'on' : 'off';
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* nothing to persist to; the toggle still works for this session */
    }
  }, [on]);

  return (
    <button
      onClick={() => setOn(v => !v)}
      data-keep-border
      title={on ? 'Borders on — click to hide card outlines' : 'Borders off — click to show card outlines'}
      className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 pl-2.5 pr-3 py-2
                 bg-white border border-[var(--stroke)] rounded-[8px] shadow-lg
                 text-xs text-[#092E3F] hover:border-[#2A96A8] transition-colors"
    >
      {on
        ? <Square className="w-3.5 h-3.5 text-[#1e7d8f]" />
        : <SquareDashed className="w-3.5 h-3.5 text-[#87999f]" />}
      <span className="text-[#6b828c]">Borders</span>
      <span
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          on ? 'bg-[#2A96A8]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-all ${
            on ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </span>
    </button>
  );
}
