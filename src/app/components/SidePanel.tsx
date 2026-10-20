import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X, Pin, PinOff } from 'lucide-react';

// ─── Side panel ──────────────────────────────────────────────────────────────
//
// Every detail panel in this app was a modal: a fixed sheet over a backdrop
// that swallowed clicks, so reading one meant the page behind it was frozen.
// That is right for a decision you must answer and wrong for a reference you
// want beside you — which is what an audit log or a setting's detail is.
//
// Sentinel solves it by docking the pane: the list keeps working while the
// details sit alongside. This does the same with a pin:
//
//   unpinned  overlay, backdrop, click-away and Escape close it. Good for a
//             quick look on a narrow screen.
//   pinned    no backdrop, nothing is blocked, and the page reserves the
//             width so the panel covers nothing. Escape and click-away stop
//             closing it, because at that point it is furniture, not a dialog.
//
// The pin is remembered per panel, so someone who works with the audit log
// open gets it docked every time without re-pinning.

interface PanelState {
  /** Width the page must keep clear on the right, in px. 0 when nothing is pinned. */
  reserved: number;
  reserve: (id: string, width: number) => void;
  release: (id: string) => void;
}

const Ctx = createContext<PanelState | null>(null);

export function SidePanelProvider({ children }: { children: React.ReactNode }) {
  const [claims, setClaims] = useState<Record<string, number>>({});

  // Stable across renders. A panel's effect must not re-run just because some
  // other panel changed the claims, or releasing and re-reserving chase each
  // other forever.
  const reserve = useCallback((id: string, width: number) => {
    setClaims(c => (c[id] === width ? c : { ...c, [id]: width }));
  }, []);
  const release = useCallback((id: string) => {
    setClaims(c => {
      if (!(id in c)) return c;
      const { [id]: _drop, ...rest } = c;
      return rest;
    });
  }, []);

  const value = useMemo<PanelState>(() => ({
    // Two pinned panels would fight over the same edge, so the widest wins
    // rather than the page reserving the sum of them.
    reserved: Math.max(0, ...Object.values(claims)),
    reserve,
    release,
  }), [claims, reserve, release]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** What the page shell reads to keep room for a pinned panel. */
export function useReservedWidth(): number {
  return useContext(Ctx)?.reserved ?? 0;
}

const pinKey = (id: string) => `seculyze:panel-pinned:${id}`;

/** Shared by SidePanel and PinnableDrawer, so a pin is remembered either way. */
function usePin(id: string, open: boolean, width: number) {
  const ctx = useContext(Ctx);
  // Held in a ref so the effect below depends on the panel's own state and
  // not on the context object, which is replaced whenever any claim changes.
  const api = useRef(ctx);
  api.current = ctx;

  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(pinKey(id)) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (open && pinned) a.reserve(id, width);
    else a.release(id);
    return () => api.current?.release(id);
  }, [id, open, pinned, width]);

  useEffect(() => {
    try { localStorage.setItem(pinKey(id), pinned ? '1' : '0'); } catch { /* private window */ }
  }, [id, pinned]);

  return [pinned, setPinned] as const;
}

/**
 * Pinning for a drawer that already has its own shell and its own header.
 *
 * Most of this app's drawers were written one at a time, each with its own
 * markup around the same idea. Rewriting twenty-five headers to take a shared
 * one is a lot of surgery on files that have nothing else wrong with them, so
 * this wraps instead: it replaces only the outermost positioning element and
 * the backdrop, and carries the pin itself on a handle at the panel's leading
 * edge — clear of whatever close button the header already has.
 *
 * Converting a drawer is two edits: its outer `fixed inset-0` wrapper and the
 * backdrop become this, and the matching close tag becomes `</PinnableDrawer>`.
 */
export function PinnableDrawer({ id, width, onClose, children }: {
  id: string;
  /** The drawer's own panel width, so the page can reserve the same. */
  width: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [pinned, setPinned] = usePin(id, true, width);

  useEffect(() => {
    if (pinned) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [pinned, onClose]);

  const handle = (
    <button
      onClick={() => setPinned(p => !p)}
      aria-pressed={pinned}
      title={pinned ? 'Unpin — let it close when you click away' : 'Pin — keep it open while you work'}
      className={`absolute top-5 -left-3.5 z-10 w-7 h-7 flex items-center justify-center rounded-full
                  border shadow-sm transition-colors ${
        pinned
          ? 'bg-[#2A96A8] border-[#2A96A8] text-white'
          : 'bg-white border-[var(--stroke)] text-[#6b828c] hover:text-[#092E3F] hover:border-[#2A96A8]'
      }`}
    >
      {pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
    </button>
  );

  if (pinned) {
    return (
      <div className="fixed inset-y-0 right-0 z-30 flex">
        <div className="relative flex">{handle}{children}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex h-full">{handle}{children}</div>
    </div>
  );
}

interface Props {
  /** Identifies the panel, for remembering its pin and claiming width. */
  id: string;
  open: boolean;
  onClose: () => void;
  width?: number;
  /** The dark panel header — title, subtitle, whatever the panel needs. */
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function SidePanel({ id, open, onClose, width = 560, header, footer, children }: Props) {
  // Claims the width only while docked, and gives it back on close so the
  // page does not keep a gutter for a panel nobody can see.
  const [pinned, setPinned] = usePin(id, open, width);

  // Pinned, the panel is part of the furniture — Escape belongs to whatever
  // the person is doing in the main area.
  useEffect(() => {
    if (!open || pinned) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, pinned, onClose]);

  if (!open) return null;

  const panel = (
    <aside
      style={{ width }}
      className={`h-full max-w-full bg-white border-l border-[var(--stroke)] flex flex-col ${
        pinned ? 'shadow-none' : 'shadow-2xl'
      }`}
    >
      <div className="shrink-0 bg-[#092E3F] px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setPinned(p => !p)}
            title={pinned
              ? 'Unpin — let it close when you click away'
              : 'Pin — keep it open while you work'}
            aria-pressed={pinned}
            className={`w-8 h-8 flex items-center justify-center rounded-[8px] transition-colors ${
              pinned ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">{children}</div>

      {footer && <div className="shrink-0">{footer}</div>}
    </aside>
  );

  // Docked: no overlay at all, so nothing between the pointer and the page.
  if (pinned) {
    return <div className="fixed inset-y-0 right-0 z-30">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative h-full">{panel}</div>
    </div>
  );
}
