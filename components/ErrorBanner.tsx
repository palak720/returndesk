import { ApiError, type FieldIssue } from "@/lib/api-client";

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const issues =
    error instanceof ApiError && Array.isArray(error.details) ? (error.details as FieldIssue[]) : [];

  return (
    <div role="alert" className="rounded-md border border-[#e3b5b5] bg-[#fbeeee] px-4 py-3 text-sm text-[#7d2020]">
      <p className="font-medium">{message}</p>
      {issues.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {issues.map((i, n) => (
            <li key={n}>
              {i.field ? `${i.field}: ` : ""}
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded border border-[#c98b8b] px-3 py-1 font-medium hover:bg-[#f5dede]">
          Try again
        </button>
      )}
    </div>
  );
}
