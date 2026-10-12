/**
 * Tiny className combiner. Filters falsy values and joins with spaces.
 * Kept dependency-free; swap for clsx + tailwind-merge if conflicts appear.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
