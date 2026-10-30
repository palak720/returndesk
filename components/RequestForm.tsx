"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { REASON_LABEL, REASONS, type Reason } from "@/lib/domain";
import type { ReturnRequest } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";

type Values = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: string;
  reason: Reason | "";
};

const EMPTY: Values = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  orderNumber: "",
  itemSku: "",
  itemName: "",
  quantity: "1",
  reason: "",
};

const fromRequest = (r: ReturnRequest): Values => ({
  customerName: r.customerName,
  customerEmail: r.customerEmail,
  customerPhone: r.customerPhone ?? "",
  orderNumber: r.orderNumber,
  itemSku: r.itemSku,
  itemName: r.itemName,
  quantity: String(r.quantity),
  reason: r.reason,
});

export function RequestForm({ existing }: { existing?: ReturnRequest }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(existing ? fromRequest(existing) : EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const fieldErrors = error?.fieldErrors ?? {};
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      customerPhone: values.customerPhone,
      orderNumber: values.orderNumber,
      itemSku: values.itemSku,
      itemName: values.itemName,
      quantity: values.quantity.trim() === "" ? undefined : Number(values.quantity),
      reason: values.reason || undefined,
    };
    try {
      const saved = existing
        ? await api<ReturnRequest>(`/api/requests/${existing.id}`, { method: "PATCH", json: payload })
        : await api<ReturnRequest>("/api/requests", { method: "POST", json: payload });
      router.push(`/requests/${saved.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Something went wrong."));
      setSaving(false);
    }
  }

  const input = (key: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        value={values[key]}
        onChange={set(key)}
        aria-invalid={Boolean(fieldErrors[key])}
        className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm aria-[invalid=true]:border-danger"
        {...props}
      />
      {fieldErrors[key] && <span className="mt-1 block text-danger">{fieldErrors[key]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <ErrorBanner error={error} />}

      <fieldset className="space-y-3 rounded-lg border border-rule bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Customer</legend>
        {input("customerName", "Name", { autoComplete: "off" })}
        <div className="grid gap-3 sm:grid-cols-2">
          {input("customerEmail", "Email", { type: "email", inputMode: "email" })}
          {input("customerPhone", "Phone (optional)", { type: "tel", inputMode: "tel" })}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-rule bg-surface p-4">
        <legend className="px-1 text-sm font-semibold">Order and item</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("orderNumber", "Order number")}
          {input("itemSku", "Item SKU")}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          {input("itemName", "Item name")}
          {input("quantity", "Units", { type: "number", min: 1, step: 1, inputMode: "numeric" })}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Reason for return</span>
          <select
            value={values.reason}
            onChange={set("reason")}
            aria-invalid={Boolean(fieldErrors.reason)}
            className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm aria-[invalid=true]:border-danger"
          >
            <option value="">Choose a reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
          {fieldErrors.reason && <span className="mt-1 block text-danger">{fieldErrors.reason}</span>}
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : existing ? "Save changes" : "Raise request"}
        </button>
        <Link
          href={existing ? `/requests/${existing.id}` : "/"}
          className="rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
