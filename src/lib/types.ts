export type SplitType = "equal" | "unequal" | "percentage" | "share";
export type ExpenseStatus = "active" | "pending_review" | "rejected" | "skipped";
export type AnomalyAction =
  | "auto_fixed"
  | "converted"
  | "skipped"
  | "pending_approval"
  | "flagged";

export const AnomalyAction = {
  auto_fixed: "auto_fixed" as const,
  converted: "converted" as const,
  skipped: "skipped" as const,
  pending_approval: "pending_approval" as const,
  flagged: "flagged" as const,
};

export const ExpenseStatus = {
  active: "active" as const,
  pending_review: "pending_review" as const,
  rejected: "rejected" as const,
  skipped: "skipped" as const,
};
