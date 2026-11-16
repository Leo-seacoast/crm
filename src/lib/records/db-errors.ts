/** Turns database errors into messages a person can act on (never shows raw technical details). */
export type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

export function friendlyDbError(error: DbError): string {
  if (!error) return "Something went wrong. Please try again.";
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  switch (error.code) {
    case "23505": // duplicate
      if (text.includes("contacts_email_unique")) return "A contact with this email already exists.";
      if (text.includes("contacts_phone_unique")) return "A contact with this phone number already exists.";
      return "This would create a duplicate.";
    case "42501": // permission / rule from the database
      // Our own rules raise readable messages; show those, hide anything else.
      if (/opt|consent|admin|role/i.test(error.message ?? "")) return error.message!;
      return "You don't have permission to do that.";
    case "23514": // check rule
      return "Some details aren't valid. Please check the form.";
    case "22023":
      return error.message?.startsWith("Unknown time zone") ? "Choose a time zone from the list." : "Invalid value.";
    case "PGRST116": // no rows (e.g. archived record a member can't edit)
      return "This record can't be changed (it may be archived).";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function isDuplicate(error: DbError, constraint: string): boolean {
  return error?.code === "23505" && `${error.message} ${error.details}`.includes(constraint);
}
