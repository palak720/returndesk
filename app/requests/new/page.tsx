import type { Metadata } from "next";
import { RequestForm } from "@/components/RequestForm";

export const metadata: Metadata = { title: "New request" };

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Raise a return request</h1>
      <p className="text-sm text-muted">A reference is generated when you save.</p>
      <RequestForm />
    </div>
  );
}
