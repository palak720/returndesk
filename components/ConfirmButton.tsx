"use client";

import { useState } from "react";

// Two-step button for destructive actions: first click asks, second click does it.
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="rounded-md border border-[#d9a3a3] bg-surface px-3.5 py-2 text-sm font-medium text-danger hover:bg-[#fbeeee] disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="rounded-md bg-danger px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-md px-2 py-2 text-sm text-muted hover:underline">
        Cancel
      </button>
    </span>
  );
}
