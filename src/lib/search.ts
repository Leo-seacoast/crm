/**
 * Cleans text typed into a search box before it goes to the database.
 * Removes characters that have special meaning in database search patterns
 * (so a search can't be turned into something else) and limits the length.
 */
export function cleanSearch(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[%_*\\,()"':;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 100);
}

/**
 * For phone searches: "(603) 555" should find +1603555....
 * Returns the digits if the search looks like part of a phone number.
 */
export function phoneDigits(search: string): string | null {
  const digits = search.replace(/\D/g, "");
  return digits.length >= 3 && /^[\d\s()+.-]+$/.test(search) ? digits : null;
}

/** Page number from the address bar, safely. */
export function pageNumber(input: unknown): number {
  const n = Number.parseInt(typeof input === "string" ? input : "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}
