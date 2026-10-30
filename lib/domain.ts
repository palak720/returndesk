export const STATUSES = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"] as const;
export const REASONS = ["DAMAGED", "WRONG_ITEM", "SIZE_ISSUE", "NOT_AS_DESCRIBED", "CHANGED_MIND"] as const;
export const RESOLUTIONS = ["REFUND", "REPLACEMENT", "STORE_CREDIT"] as const;

export type Status = (typeof STATUSES)[number];
export type Reason = (typeof REASONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

// Rule 1: sirf yehi transitions legal hain
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  OPEN: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};

// Rule 4: edit sirf undecided requests par
export const EDITABLE: readonly Status[] = ["OPEN", "IN_REVIEW"];
// Rule 5: remove sirf Open ya Rejected
export const REMOVABLE: readonly Status[] = ["OPEN", "REJECTED"];

export const canTransition = (from: Status, to: Status) => TRANSITIONS[from].includes(to);
export const canEdit = (s: Status) => EDITABLE.includes(s);
export const canRemove = (s: Status) => REMOVABLE.includes(s);