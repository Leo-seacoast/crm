export const DEFAULT_CURRENCY = "USD";
const MAX_VALUE = 999_999_999_999.99; // fits the database column

export type MoneyResult = { ok: true; value: number | null } | { ok: false; error: string };

/** "$12,500.50" -> 12500.5. Blank -> null (no value). */
export function parseMoney(input: unknown): MoneyResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input === "number") input = String(input);
  if (typeof input !== "string") return { ok: false, error: "Enter an amount like 12,500" };
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (cleaned === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, error: "Enter an amount like 12,500 or 12,500.50" };
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > MAX_VALUE) return { ok: false, error: "That amount is too large" };
  return { ok: true, value };
}

export function formatMoney(value: number | string | null | undefined, currency = DEFAULT_CURRENCY): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}
