// Standardized Ice Product & Sack Size Display Utilities

export const SACK_SIZE_OPTIONS = ["Small", "Medium", "Large"] as const;
export type SackSizeOption = (typeof SACK_SIZE_OPTIONS)[number];

/**
 * Formats a sack size cleanly without duplicating the word "Sack".
 * Examples:
 *  - "Medium" -> "Medium Sack"
 *  - "Small Sack" -> "Small Sack"
 *  - "50 kg" -> "50 kg Sack"
 */
export function formatSackSizeSuffix(sackSize?: string | null): string {
  const clean = (sackSize || "").trim();
  if (!clean) return "";
  if (/\bsack\b/i.test(clean)) return clean;
  return `${clean} Sack`;
}

/**
 * Standardized product display format across dropdowns, load slips, invoices, shift closing, and mobile:
 * e.g., Product Name "Tube Ice" + Sack Size "Medium" => "Tube Ice (Medium Sack)"
 */
export function formatProductLabel(
  name?: string | null,
  sackSize?: string | null,
  fallback = "Ice Product"
): string {
  const cleanName = (name || fallback).trim() || fallback;
  const suffix = formatSackSizeSuffix(sackSize);
  if (!suffix) return cleanName;
  if (cleanName.toLowerCase().includes(`(${suffix.toLowerCase()})`)) {
    return cleanName;
  }
  return `${cleanName} (${suffix})`;
}

/**
 * Maps any raw or legacy DB sack size string cleanly to "Small" | "Medium" | "Large" for selectors.
 */
export function normalizeSackSizeOption(raw?: string | null): SackSizeOption {
  const lower = (raw || "").trim().toLowerCase();
  if (lower.startsWith("small") || lower.includes("10kg") || lower.includes("20kg")) {
    return "Small";
  }
  if (lower.startsWith("large") || lower.includes("50")) {
    return "Large";
  }
  return "Medium";
}
