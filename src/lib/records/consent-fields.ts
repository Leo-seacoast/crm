/**
 * On the edit form, a blank consent choice means "No change".
 * Those fields are removed before checking, so the current consent is left alone.
 */
export function prepareConsentFields(raw: Record<string, unknown>, isEdit: boolean) {
  const toCheck = { ...raw };
  const keepEmailConsent = isEdit && !raw.email_consent;
  const keepSmsConsent = isEdit && !raw.sms_consent;
  if (keepEmailConsent) {
    delete toCheck.email_consent;
    delete toCheck.email_consent_source;
  }
  if (keepSmsConsent) {
    delete toCheck.sms_consent;
    delete toCheck.sms_consent_source;
  }
  return { toCheck, keepEmailConsent, keepSmsConsent };
}
