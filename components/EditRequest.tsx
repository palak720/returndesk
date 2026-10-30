"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { canEdit, STATUS_LABEL } from "@/lib/domain";
import type { ReturnRequest } from "@/lib/types";
import { ErrorBanner } from "./ErrorBanner";
import { RequestForm } from "./RequestForm";

export function EditRequest({ id }: { id: string }) {
  const [state, setState] = useState<{ request?: ReturnRequest; error?: ApiError } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    api<ReturnRequest>(`/api/requests/${id}`, { signal: ctrl.signal })
      .then((request) => setState({ request }))
      .catch((error) => {
        if (!ctrl.signal.aborted) setState({ error });
      });
    return () => ctrl.abort();
  }, [id]);

  if (!state) return <div className="h-64 animate-pulse rounded-lg border border-rule bg-surface" role="status" aria-label="Loading request" />;
  if (state.error) {
    return (
      <div className="space-y-3">
        <ErrorBanner error={state.error} />
        <Link href="/" className="text-sm text-accent hover:underline">
          Back to all requests
        </Link>
      </div>
    );
  }
  const request = state.request!;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {request.reference}</h1>
      {canEdit(request.status) ? (
        <RequestForm existing={request} />
      ) : (
        <div className="rounded-lg border border-rule bg-surface p-4 text-sm">
          <p className="font-medium">This request can no longer be edited.</p>
          <p className="mt-1 text-muted">Details are locked once a request is {STATUS_LABEL[request.status].toLowerCase()}. You can still add notes.</p>
          <Link href={`/requests/${request.id}`} className="mt-3 inline-block text-accent hover:underline">
            Back to the request
          </Link>
        </div>
      )}
    </div>
  );
}
