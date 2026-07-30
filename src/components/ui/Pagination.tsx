"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Compute a compact set of page numbers with ellipses for large page counts. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  label = "records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = pageWindow(page, totalPages);

  const navBtn =
    "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-xs font-semibold transition";

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        Showing <span className="font-semibold text-foreground">{start} to {end}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span> {label}
      </p>
      <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            navBtn,
            "border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                navBtn,
                p === page
                  ? "border-transparent bg-brand-gradient text-white shadow-sm"
                  : "border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            navBtn,
            "border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
        {onPageSizeChange && (
          <div className="relative">
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 appearance-none rounded-md border border-border bg-surface pl-2.5 pr-7 text-xs font-medium text-foreground transition hover:border-primary/40 focus:border-primary focus:outline-none"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          </div>
        )}
      </div>
    </div>
  );
}
