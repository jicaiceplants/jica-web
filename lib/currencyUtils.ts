// Currency precision and price input helpers (prevents IEEE 754 float drift)

export function roundCurrency(value: number | string | null | undefined): number {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function multiplyCurrency(qty: number, unitPrice: number): number {
  const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;
  const priceCents = Math.round((Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0) * 100);
  return Math.round(safeQty * priceCents) / 100;
}

export function sumCurrency(values: number[]): number {
  const totalCents = values.reduce((acc, v) => acc + Math.round((roundCurrency(v)) * 100), 0);
  return totalCents / 100;
}

/**
 * Validates raw user input string during free typing for price fields.
 * Allows empty string "", "0", "0.", "150.50"; blocks negatives and non-numeric input.
 */
export function sanitizePriceTyping(raw: string): string | null {
  if (raw === "") return "";
  if (/^\d*\.?\d{0,2}$/.test(raw)) {
    return raw;
  }
  return null;
}

/**
 * Normalizes a free-typed price string cleanly on blur or form submit.
 */
export function normalizePriceOnBlur(raw: string): number {
  if (!raw || raw.trim() === "" || raw === ".") return 0;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function formatPhp(value: number | string | null | undefined): string {
  const rounded = roundCurrency(value);
  return rounded.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
