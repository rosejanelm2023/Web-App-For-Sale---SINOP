export type TransferRow = Record<string, unknown>;

export type DmwTransferData = {
  export_format: string;
  export_version: number;
  source_project_ref: string;
  exported_at: string;
  exclusions: string[];
  import_order: string[];
  record_counts: Record<string, number>;
  data: Record<string, TransferRow[]>;
};

export const textValue = (row: TransferRow | undefined, key: string) => {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
};

export const numberValue = (row: TransferRow | undefined, key: string) => {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

export const rowsById = (rows: TransferRow[] = []) =>
  new Map(rows.map(row => [textValue(row, "id"), row]));

export const dateLabel = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

