"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api-client";
import { REASON_LABEL, REASONS, STATUS_LABEL, STATUSES } from "@/lib/domain";
import type { ListResponse } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";
import { STATUS_STYLE, StatusBadge } from "./StatusBadge";

const SORTS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "customerName:asc", label: "Customer A to Z" },
  { value: "customerName:desc", label: "Customer Z to A" },
  { value: "status:asc", label: "Status, earliest stage first" },
  { value: "status:desc", label: "Status, latest stage first" },
  { value: "reference:asc", label: "Reference" },
];

const PAGE_SIZE = 10;
const fieldClass =
  "w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

type Result = { key: string; data?: ListResponse; error?: unknown };

export function RequestList() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const reason = sp.get("reason") ?? "";
  const sort = sp.get("sort") ?? "createdAt";
  const order = sp.get("order") ?? "desc";
  const page = Number(sp.get("page")) > 0 ? Number(sp.get("page")) : 1;

  const [search, setSearch] = useState(q);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page"); // any filter change returns to page 1
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  // Wait for a pause in typing before touching the URL, which is what triggers the request.
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => update({ q: search.trim() || undefined }), 400);
    return () => clearTimeout(t);
  }, [search, q, update]);

  const apiQuery = new URLSearchParams({ sort, order, page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) apiQuery.set("q", q);
  if (status) apiQuery.set("status", status);
  if (reason) apiQuery.set("reason", reason);
  const key = `${apiQuery.toString()}#${reloadKey}`;

  useEffect(() => {
    const ctrl = new AbortController();
    api<ListResponse>(`/api/requests?${key.split("#")[0]}`, { signal: ctrl.signal })
      .then((data) => setResult({ key, data }))
      .catch((error) => {
        if (!ctrl.signal.aborted) setResult({ key, error });
      });
    return () => ctrl.abort();
  }, [key]);

  const loading = result?.key !== key;
  const data = result?.data;
  const filtersActive = Boolean(q || status || reason);

  const clearFilters = () => {
    setSearch("");
    router.replace(pathname, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Return requests</h1>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="grid grid-cols-2 gap-3 rounded-lg border border-rule bg-surface p-3 lg:grid-cols-[2fr_1fr_1fr_1fr]"
      >
        <label className="col-span-2 block text-sm lg:col-span-1">
          <span className="mb-1 block font-medium">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, order or reference"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select value={status} onChange={(e) => update({ status: e.target.value || undefined })} className={fieldClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Reason</span>
          <select value={reason} onChange={(e) => update({ reason: e.target.value || undefined })} className={fieldClass}>
            <option value="">All reasons</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block text-sm lg:col-span-1">
          <span className="mb-1 block font-medium">Sort by</span>
          <select
            value={`${sort}:${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split(":");
              update({ sort: s, order: o });
            }}
            className={fieldClass}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {result?.error && !loading ? (
        <ErrorBanner error={result.error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !data ? (
        <ListSkeleton />
      ) : data.data.length === 0 ? (
        <EmptyState
          filtersActive={filtersActive}
          pastEnd={data.meta.total > 0}
          onClear={clearFilters}
          onFirstPage={() => update({ page: undefined })}
        />
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""} aria-busy={loading}>
          <ResultsTable rows={data.data} />
          <Pager meta={data.meta} onPage={(p) => update({ page: p === 1 ? undefined : String(p) })} />
        </div>
      )}
    </div>
  );
}

function ResultsTable({ rows }: { rows: ListResponse["data"] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-rule bg-surface sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule bg-paper text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Order and item</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Raised</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="relative border-b border-rule last:border-b-0 hover:bg-paper">
                <td className={`border-l-4 px-4 py-3 ${STATUS_STYLE[r.status].stripe}`}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="font-mono font-medium text-accent after:absolute after:inset-0 hover:underline"
                  >
                    {r.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.customerName}</div>
                  <div className="text-muted">{r.customerEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.orderNumber}</div>
                  <div className="text-muted">
                    {r.itemName} × {r.quantity}
                  </div>
                </td>
                <td className="px-4 py-3">{REASON_LABEL[r.reason]}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <li key={r.id} className={`relative rounded-lg border border-rule border-l-4 bg-surface p-3 ${STATUS_STYLE[r.status].stripe}`}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/requests/${r.id}`} className="font-mono font-medium text-accent after:absolute after:inset-0">
                {r.reference}
              </Link>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-1 font-medium">{r.customerName}</p>
            <p className="text-sm text-muted">
              {r.orderNumber} · {r.itemName} × {r.quantity}
            </p>
            <p className="mt-1 text-sm">
              {REASON_LABEL[r.reason]} <span className="text-muted">· {formatDate(r.createdAt)}</span>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Pager({ meta, onPage }: { meta: ListResponse["meta"]; onPage: (p: number) => void }) {
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  const btn =
    "rounded-md border border-rule bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Showing {from} to {to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </button>
        <span className="text-sm">
          Page {meta.page} of {meta.totalPages}
        </span>
        <button className={btn} disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

function EmptyState(props: {
  filtersActive: boolean;
  pastEnd: boolean;
  onClear: () => void;
  onFirstPage: () => void;
}) {
  const box = "rounded-lg border border-dashed border-rule bg-surface px-6 py-12 text-center";
  const btn = "mt-4 rounded-md border border-rule px-4 py-2 text-sm font-medium hover:bg-paper";
  if (props.pastEnd) {
    return (
      <div className={box}>
        <p className="font-medium">There are no results on this page.</p>
        <button className={btn} onClick={props.onFirstPage}>
          Go to the first page
        </button>
      </div>
    );
  }
  if (props.filtersActive) {
    return (
      <div className={box}>
        <p className="font-medium">No requests match your search and filters.</p>
        <p className="mt-1 text-sm text-muted">Check the spelling or loosen a filter.</p>
        <button className={btn} onClick={props.onClear}>
          Clear search and filters
        </button>
      </div>
    );
  }
  return (
    <div className={box}>
      <p className="font-medium">No return requests yet.</p>
      <Link href="/requests/new" className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
        Raise the first request
      </Link>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading requests">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-rule bg-surface" />
      ))}
    </div>
  );
}

