import type { Reason, Resolution, Status } from "./domain";

// Shapes returned by the API. Kept free of server imports so client code can use them.
export type ReturnRequest = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  reason: Reason;
  status: Status;
  resolution: Resolution | null;
  refundAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RequestNote = { id: string; requestId: string; body: string; createdAt: string };

export type RequestWithNotes = ReturnRequest & { notes: RequestNote[] };

export type ListResponse = {
  data: ReturnRequest[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};