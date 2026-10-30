"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, formatDate, formatMoney } from "@/lib/api-client";
import {
  canEdit,
  canRemove,
  REASON_LABEL,
  RESOLUTION_LABEL,
  RESOLUTIONS,
  STATUS_LABEL,
  TRANSITIONS,
  type Resolution,
  type Status,
} from "@/lib/domain";
import type { RequestNote, RequestWithNotes, ReturnRequest } from "@/lib/types";
import { ConfirmButton } from "./ConfirmButton";
import { ErrorBanner } from "./ErrorBanner";
import { StatusBadge } from "./StatusBadge";

const MOVE_LABEL: Record<Status, string> = {
  OPEN: "Reopen",
  IN_REVIEW: "Start review",
  APPROVED: "Approve…",
  REJECTED: "Reject",
  COMPLETED: "Mark completed",
};

const btnPrimary = "rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50";
const btnPlain = "rounded-md border border-rule bg-surface px-3.5 py-2 text-sm font-medium hover:bg-paper disabled:opacity-50";

export function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<RequestWithNotes | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api<RequestWithNotes>(`/api/requests/${id}`, { signal: ctrl.signal })
      .then((r) => {
        setRequest(r);
        setLoadError(null);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setLoadError(e);
      });
    return () => ctrl.abort();
  }, [id, reloadKey]);

  // Run a mutation, surface any server refusal, and never swallow errors.
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e);
      // A refusal usually means our view is stale (someone else moved it), so refresh it.
      if (e instanceof ApiError && e.status === 409) setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }, []);

  const move = (body: { status: Status; resolution?: Resolution; refundAmount?: number }) =>
    run(async () => {
      const updated = await api<ReturnRequest>(`/api/requests/${id}/transition`, { method: "POST", json: body });
      setRequest((prev) => (prev ? { ...prev, ...updated } : prev));
      setApproving(false);
    });

  const remove = () =>
    run(async () => {
      await api<void>(`/api/requests/${id}`, { method: "DELETE" });
      router.push("/");
    });

  if (loadError && !request) {
    return (
      <div className="space-y-3">
        <ErrorBanner error={loadError} onRetry={loadError.status === 404 ? undefined : () => setReloadKey((k) => k + 1)} />
        <Link href="/" className="inline-block text-sm text-accent hover:underline">
          Back to all requests
        </Link>
      </div>
    );
  }
  if (!request) {
    return <div className="h-80 animate-pulse rounded-lg border border-rule bg-surface" role="status" aria-label="Loading request" />;
  }

  const next = TRANSITIONS[request.status];

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← All requests
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{request.reference}</h1>
        <StatusBadge status={request.status} />
      </div>

      {actionError != null && <ErrorBanner error={actionError} />}

      <section aria-label="Actions" className="rounded-lg border border-rule bg-surface p-4">
        {next.length === 0 && !canRemove(request.status) ? (
          <p className="text-sm text-muted">
            This request is {STATUS_LABEL[request.status].toLowerCase()}. No further actions are available, but you can still add notes.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {next.map((to) =>
              to === "APPROVED" ? (
                <button key={to} disabled={busy} onClick={() => setApproving((v) => !v)} className={btnPrimary} aria-expanded={approving}>
                  {MOVE_LABEL[to]}
                </button>
              ) : to === "REJECTED" ? (
                <ConfirmButton key={to} label={MOVE_LABEL[to]} confirmLabel="Confirm reject" disabled={busy} onConfirm={() => move({ status: to })} />
              ) : (
                <button key={to} disabled={busy} onClick={() => move({ status: to })} className={btnPrimary}>
                  {MOVE_LABEL[to]}
                </button>
              )
            )}
            {canEdit(request.status) && (
              <Link href={`/requests/${request.id}/edit`} className={btnPlain}>
                Edit details
              </Link>
            )}
            {canRemove(request.status) && (
              <ConfirmButton label="Remove from desk" confirmLabel="Confirm remove" disabled={busy} onConfirm={remove} />
            )}
          </div>
        )}
        {!canEdit(request.status) && (next.length > 0 || canRemove(request.status)) && (
          <p className="mt-3 text-sm text-muted">Customer and item details are locked because this request is {STATUS_LABEL[request.status].toLowerCase()}.</p>
        )}
        {approving && next.includes("APPROVED") && (
          <ApproveForm busy={busy} onCancel={() => setApproving(false)} onSubmit={(r, amt) => move({ status: "APPROVED", resolution: r, refundAmount: amt })} />
        )}
      </section>

      <section aria-label="Details" className="rounded-lg border border-rule bg-surface p-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Customer" value={request.customerName} />
          <Field label="Email" value={request.customerEmail} />
          <Field label="Phone" value={request.customerPhone ?? "Not given"} />
          <Field label="Order" value={request.orderNumber} />
          <Field label="Item" value={`${request.itemName} (${request.itemSku})`} />
          <Field label="Units" value={String(request.quantity)} />
          <Field label="Reason" value={REASON_LABEL[request.reason]} />
          <Field
            label="Resolution"
            value={
              request.resolution
                ? `${RESOLUTION_LABEL[request.resolution]}${request.refundAmount != null ? ` · ${formatMoney(request.refundAmount)}` : ""}`
                : "Not decided"
            }
          />
          <Field label="Raised" value={formatDate(request.createdAt)} />
          <Field label="Last updated" value={formatDate(request.updatedAt)} />
        </dl>
      </section>

      <Notes
        requestId={request.id}
        notes={request.notes}
        onAdded={(n) => setRequest((prev) => (prev ? { ...prev, notes: [...prev.notes, n] } : prev))}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function ApproveForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (resolution: Resolution, refundAmount?: number) => void;
  onCancel: () => void;
}) {
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [amount, setAmount] = useState("");

  return (
    <form
      className="mt-4 space-y-3 border-t border-rule pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Invalid combinations are still sent on purpose: the server is the one that refuses them.
        onSubmit((resolution || undefined) as Resolution, resolution === "REFUND" && amount !== "" ? Number(amount) : undefined);
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-medium">How will this be resolved?</legend>
        <div className="flex flex-wrap gap-2">
          {RESOLUTIONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md border border-rule px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-paper">
              <input type="radio" name="resolution" value={r} checked={resolution === r} onChange={() => setResolution(r)} />
              {RESOLUTION_LABEL[r]}
            </label>
          ))}
        </div>
      </fieldset>
      {resolution === "REFUND" && (
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block font-medium">Refund amount (INR)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm"
          />
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          Approve request
        </button>
        <button type="button" onClick={onCancel} className={btnPlain}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Notes({ requestId, notes, onAdded }: { requestId: string; notes: RequestNote[]; onAdded: (n: RequestNote) => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onAdded(await api<RequestNote>(`/api/requests/${requestId}/notes`, { method: "POST", json: { body } }));
      setBody("");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Notes" className="rounded-lg border border-rule bg-surface p-4">
      <h2 className="text-base font-semibold">Notes</h2>
      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No notes yet. Notes are permanent once added.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-rule pl-3">
              <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(n.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="mt-4 space-y-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Add a note</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm"
          />
        </label>
        {error != null && <ErrorBanner error={error} />}
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Adding…" : "Add note"}
        </button>
      </form>
    </section>
  );
}
