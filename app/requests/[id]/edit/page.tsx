import type { Metadata } from "next";
import { EditRequest } from "@/components/EditRequest";

export const metadata: Metadata = { title: "Edit request" };

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditRequest id={(await params).id} />;
}
