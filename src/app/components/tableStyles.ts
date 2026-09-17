// ─── The one table look ──────────────────────────────────────────────────────
//
// Tables had drifted into seven different designs — headers in white, #F8FAFB,
// #f9fafb, #f6f6f6 and teal #e5f2f4; labels at 10px and 12px, in #6b828c and
// #092E3F/70; cell padding from px-3 to px-10; hover in gray-50 and #fafbfb;
// corners from 6px to 12px. These constants are the single source of truth, so
// the next new page inherits the look instead of inventing an eighth one.
//
// The design is the one from Data Collection and the Ingestion pages (the most
// recent deliberate pass): a quiet grey header, small uppercase labels in raven,
// hairline dividers, and a 6px card — matching the ~4px radius the rest of the
// system uses.
//
// Two sets, because the app builds tables two ways and neither is worth
// rewriting: semantic <table> where columns resize or sort, CSS grid rows where
// a row expands or holds a chart. They render identically.

// ── Shell ────────────────────────────────────────────────────────────────────
/** Wrapper around any table. Clips the header's fill to the rounded corners. */
export const TABLE_SHELL = 'bg-white border border-gray-200 rounded-[6px] overflow-hidden';

/**
 * Same shell, unclipped — for tables whose rows must draw outside their bounds
 * (an in-cell chart's hover tooltip). Never clip such a table just for the
 * corners; the header's fill squares off only where the border rounds.
 */
export const TABLE_SHELL_OPEN = 'bg-white border border-gray-200 rounded-[6px]';

// ── Semantic <table> ─────────────────────────────────────────────────────────
/** <thead>. Add `sticky top-0 z-10` where the body scrolls under it. */
export const TABLE_HEAD = 'bg-[#f6f6f6] border-b border-gray-200';

/**
 * <th> type and metrics only, with no colour or fill — for the rare header cell
 * that is deliberately highlighted and brings its own. Composing beats an
 * important modifier, which in Tailwind v4 is a suffix and easy to get wrong.
 */
export const TABLE_TH_TYPE =
  'px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap';

/**
 * <th>. Carries its own background so a sticky header stays opaque while rows
 * scroll beneath it.
 */
export const TABLE_TH = `${TABLE_TH_TYPE} text-[#6b828c] bg-[#f6f6f6]`;

/** Append to TABLE_TH on a sortable or resizable header. */
export const TABLE_TH_INTERACTIVE =
  'relative group select-none cursor-pointer hover:bg-[#eceff0] transition-colors';

/** <tbody>. */
export const TABLE_BODY = 'divide-y divide-gray-100';

/** <tr> in the body. */
export const TABLE_ROW = 'transition-colors hover:bg-[#fafbfb]';

/** <td>. */
export const TABLE_TD = 'px-4 py-3';

// ── CSS-grid rows ────────────────────────────────────────────────────────────
/** Header row. Pair with the page's own `grid grid-cols-[…] gap-3`. */
export const GRID_HEAD =
  'px-4 py-2.5 bg-[#f6f6f6] border-b border-gray-200 text-[10px] font-medium uppercase tracking-wide text-[#6b828c]';

/**
 * Body row without the hover fill — for rows that carry their own state colour
 * (a selected or active row), where a hover tint would paint over it.
 */
export const GRID_ROW_BASE = 'px-4 py-3 transition-colors';

/** Body row. Pair with the page's own `grid grid-cols-[…] gap-3 items-center`. */
export const GRID_ROW = `${GRID_ROW_BASE} hover:bg-[#fafbfb]`;

/** Wrapper around grid body rows, for the hairlines between them. */
export const GRID_BODY = 'divide-y divide-gray-100';

/**
 * Goes just inside TABLE_SHELL, around the header row and the body together so
 * the two stay aligned. A dense table given the full width of a 4K screen still
 * has to survive a 1280px laptop: below its natural width it scrolls sideways
 * rather than crushing its columns or getting clipped by the shell.
 */
export const GRID_SCROLL = 'overflow-x-auto';
