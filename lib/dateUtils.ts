// Asia/Manila (UTC+8) Timezone Utilities for JICA Ice Logistics

export const MANILA_TIMEZONE = "Asia/Manila";

/**
 * Returns YYYY-MM-DD strictly in Asia/Manila (UTC+8).
 * Prevents UTC midnight rollover from shifting evening/early-morning dispatches to the wrong day.
 */
export function getManilaDateString(dateInput: Date | string = new Date()): string {
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(dateObj.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIMEZONE }).format(new Date());
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIMEZONE }).format(dateObj);
}

/**
 * Returns HH:MM (24-hour) strictly in Asia/Manila (UTC+8).
 */
export function getManilaTimeString(dateInput: Date | string = new Date()): string {
  const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(dateObj.getTime())) return "06:00";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(dateObj);
}

/**
 * Formats ISO timestamps or date strings for clean display in Asia/Manila.
 */
export function formatManilaDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "N/A";
  const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(dateObj.getTime())) return String(dateInput);
  return dateObj.toLocaleString("en-PH", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

export function getCurrentManilaYear(): string {
  return getManilaDateString().split("-")[0];
}
