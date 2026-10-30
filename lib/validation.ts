import { z } from "zod";
import { REASONS, RESOLUTIONS, STATUSES } from "./domain";

const text = (max = 200) => z.string().trim().min(1, "Required").max(max);

const details = z.strictObject({
  customerName: text(),
  customerEmail: z.string().trim().max(200).email("Enter a valid email"),
  customerPhone: z.string().trim().max(30).optional(),
  orderNumber: text(50),
  itemSku: text(50),
  itemName: text(),
  quantity: z.number().int("Must be a whole number").min(1, "At least 1"),
  reason: z.enum(REASONS),
});

export const createRequestSchema = details;

export const updateRequestSchema = details
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

// Rule 2 lives here, in one place.
export const transitionSchema = z
  .strictObject({
    status: z.enum(STATUSES),
    resolution: z.enum(RESOLUTIONS).optional(),
    refundAmount: z.number().positive("Must be greater than zero").multipleOf(0.01).optional(),
  })
  .superRefine((v, ctx) => {
    const add = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });

    if (v.status === "APPROVED") {
      if (!v.resolution) return add("resolution", "Resolution is required to approve");
      if (v.resolution === "REFUND" && v.refundAmount === undefined)
        add("refundAmount", "A refund amount greater than zero is required for a refund");
      if (v.resolution !== "REFUND" && v.refundAmount !== undefined)
        add("refundAmount", "Refund amount is only allowed when the resolution is REFUND");
    } else {
      if (v.resolution) add("resolution", "Resolution can only be set when approving");
      if (v.refundAmount !== undefined) add("refundAmount", "Refund amount can only be set when approving");
    }
  });

export const noteSchema = z.strictObject({
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  reason: z.enum(REASONS).optional(),
  sort: z.enum(["createdAt", "customerName", "status", "reference"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
