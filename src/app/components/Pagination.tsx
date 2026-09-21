import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── The one pagination ──────────────────────────────────────────────────────
//
// Six pages had six pagers: Previous/Next with numbered buttons in teal, in
// navy, at 10px radius and at 12px, some with ellipses, some counting
// "1-10 of 29 incidents" and some "1 to 10 of 29 clients". This replaces all of
// them.
//
// A numbered button per page stops working the moment a list is long — 40 pages
// of log sources is a row of 40 buttons or an ellipsis puzzle. A page counter
// with two arrows reads the same at 3 pages and at 300, and the row count moves
// into the control the analyst actually wants when a page feels too short.

interface PaginationProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Rows across every page, after filtering. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const arrow =
    'w-7 h-7 flex items-center justify-center rounded-[4px] text-[#6b828c] transition-colors ' +
    'hover:bg-[#f1f4f5] hover:text-[#092E3F] disabled:opacity-30 disabled:pointer-events-none';

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 bg-white border border-gray-200 rounded-[6px]">
      <p className="text-xs text-[#6b828c]">
        Showing {from}–{to} of {total}
      </p>

      <div className="flex items-center gap-2">
        <label htmlFor="rows-per-page" className="text-xs text-[#6b828c]">
          Rows
        </label>
        {/* appearance-none: the native chevron would crowd a two-digit number,
            and the control is obvious enough without it. */}
        <select
          id="rows-per-page"
          value={pageSize}
          onChange={e => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1); // the current page may not exist at the new size
          }}
          className="h-7 pl-2.5 pr-2.5 text-xs text-[#092E3F] bg-white border border-gray-200 rounded-[4px]
                     text-center appearance-none cursor-pointer transition-colors
                     hover:border-[#2A96A8] focus:outline-none focus:border-[#2A96A8]"
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Previous page"
            className={arrow}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-[#092E3F] tabular-nums px-1">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className={arrow}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
