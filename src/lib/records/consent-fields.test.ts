import { describe, expect, it } from "vitest";
import { prepareConsentFields } from "./consent-fields";
import { contactSchema } from "./schemas";

describe("consent on the edit form", () => {
  it("'No change' on one channel while changing the other is accepted", () => {
    const raw = {
      first_name: "Jane",
      email_consent: "opted_out",
      email_consent_source: "Asked to stop",
      sms_consent: "",
      sms_consent_source: "",
    };
    const { toCheck, keepEmailConsent, keepSmsConsent } = prepareConsentFields(raw, true);
    expect(keepEmailConsent).toBe(false);
    expect(keepSmsConsent).toBe(true);
    expect(toCheck).not.toHaveProperty("sms_consent");
    expect(contactSchema.safeParse(toCheck).success).toBe(true);
  });

  it("'No change' on both channels is accepted", () => {
    const raw = { first_name: "Jane", email_consent: "", sms_consent: "" };
    const { toCheck } = prepareConsentFields(raw, true);
    expect(contactSchema.safeParse(toCheck).success).toBe(true);
  });

  it("on a new contact, blanks are not treated as 'No change'", () => {
    const { keepEmailConsent, keepSmsConsent } = prepareConsentFields({ first_name: "J" }, false);
    expect(keepEmailConsent).toBe(false);
    expect(keepSmsConsent).toBe(false);
  });
});
