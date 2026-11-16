import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Country assumed when a number is typed without a country code. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

export type PhoneResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Turns whatever was typed into one standard format (+16035551234), so the
 * same number always looks the same — needed for duplicate checks and SMS.
 * Empty input is fine (no phone). Anything that isn't a real number is rejected.
 */
export function normalizePhone(input: unknown, country: CountryCode = DEFAULT_PHONE_COUNTRY): PhoneResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "Enter a valid phone number" };
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > 40) return { ok: false, error: "Enter a valid phone number" };

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed || !parsed.isValid()) return { ok: false, error: "Enter a valid phone number" };
  return { ok: true, value: parsed.number };
}

/** For display: national style for home-country numbers, international otherwise. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === DEFAULT_PHONE_COUNTRY ? parsed.formatNational() : parsed.formatInternational();
}
