/** Institutional matriculation numbers are compared, never rewritten, by this key. */
export function matricMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/** The only storage cleanup: surrounding whitespace. Case, slashes and leading zeros stay. */
export function institutionalMatric(value: string): string {
  return value.trim();
}

export function sameInstitutionalMatric(left: string, right: string): boolean {
  const key = matricMatchKey(left);
  return key.length > 0 && key === matricMatchKey(right);
}

/**
 * Keep the registered number when the new value is only a formatting variant.
 * A genuinely different number is returned trimmed, for an explicit admin correction only.
 */
export function preservedMatric(stored: string, incoming: string): string {
  if (sameInstitutionalMatric(stored, incoming)) return stored;
  return institutionalMatric(incoming);
}
