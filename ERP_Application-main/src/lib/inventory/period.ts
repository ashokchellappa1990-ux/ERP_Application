/** Month/year helpers for the day-wise stock-position reports. */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Current { year, month } where month is 0-indexed (Jan = 0). */
export function currentYM(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** First & last calendar day of a month as YYYY-MM-DD strings. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const m = String(month + 1).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(lastDay).padStart(2, "0")}` };
}

/** Recent years for the dropdown (current year back N). */
export function yearOptions(back = 4): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: back + 1 }, (_, i) => y - i);
}
