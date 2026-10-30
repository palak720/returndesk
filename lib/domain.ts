export const STATUSES = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
export const REASONS = ["DAMAGED", "WRONG_ITEM", "SIZE_ISSUE", "NOT_AS_DESCRIBED", "CHANGED_MIND"] as const;
export const RESOLUTIONS = ["REFUND", "REPLACEMENT", "STORE_CREDIT"] as const;

export type Status = (typeof STATUSES)[number];
export type Reason = (typeof REASONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

// Rule 1: the only legal transitions. Shared by the API and the UI.
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  OPEN: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

// Rule 4: details can only be edited while the request is undecided.
export const EDITABLE: readonly Status[] = ["OPEN", "IN_REVIEW"];
// Rule 5: only these can be taken off the desk.
export const REMOVABLE: readonly Status[] = ["OPEN", "REJECTED"];
// Rule 3: statuses that count as "live".
export const CLOSED: readonly Status[] = ["REJECTED", "COMPLETED"];

export const canTransition = (from: Status, to: Status) => TRANSITIONS[from].includes(to);
export const canEdit = (s: Status) => EDITABLE.includes(s);
export const canRemove = (s: Status) => REMOVABLE.includes(s);

export const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};
export const REASON_LABEL: Record<Reason, string> = {
  DAMAGED: "Damaged",
  WRONG_ITEM: "Wrong item",
  SIZE_ISSUE: "Size issue",
  NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind",
};
export const RESOLUTION_LABEL: Record<Resolution, string> = {
  REFUND: "Refund",
  REPLACEMENT: "Replacement",
  STORE_CREDIT: "Store credit",
};
