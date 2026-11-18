import type { Mode } from "@/lib/config";

/** "Fri 20 Nov" from a YYYY-MM-DD date (no timezone shift). */
export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export const windowLabel = (start: string, end: string) => `${start.slice(0, 5)}–${end.slice(0, 5)}`;

export const MODE_LABEL: Record<Mode, string> = { train: "Train", bus: "Bus", flight: "Flight", cab: "Cab" };

export function yearLabel(year: number | null) {
  if (!year) return null;
  const s = ["th", "st", "nd", "rd"][year % 10 > 3 || [11, 12, 13].includes(year % 100) ? 0 : year % 10];
  return `${year}${s} year`;
}

export function relativeHours(iso: string, now = Date.now()) {
  const h = Math.round((new Date(iso).getTime() - now) / 3_600_000);
  if (h <= 0) return "expires within the hour";
  return h >= 48 ? `expires in ${Math.round(h / 24)} days` : `expires in ${h} h`;
}
