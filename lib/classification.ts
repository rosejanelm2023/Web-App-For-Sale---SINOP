export type Classification = "Expendable" | "Semi-Expendable" | "Capital Outlay";
export type ClassificationRule =
  | "Always Expendable"
  | "Always Semi-Expendable"
  | "Always Capital Outlay"
  | "Determine using acquisition-cost threshold";

export function classifyAcceptedItem(input: {
  rule: ClassificationRule;
  unitCost: number;
  threshold: number;
  usefulLifeOverOneYear: boolean;
  qualifiesAsPpe: boolean;
}): Classification {
  if (input.rule === "Always Expendable") return "Expendable";
  if (input.rule === "Always Semi-Expendable") return "Semi-Expendable";
  if (input.rule === "Always Capital Outlay") return "Capital Outlay";
  if (input.qualifiesAsPpe && input.unitCost >= input.threshold) return "Capital Outlay";
  if (input.usefulLifeOverOneYear) return "Semi-Expendable";
  return "Expendable";
}
