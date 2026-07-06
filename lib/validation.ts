/**
 * Pure input-validation helpers for public forms. No framework imports.
 */

/** TikTok usernames: letters, digits, underscores, periods; 2-24 chars. */
const HANDLE_RE = /^[a-z0-9_.]{2,24}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Trim, drop a leading @, lowercase. */
export function normalizeHandle(raw: string): string {
  return (raw ?? "").trim().replace(/^@+/u, "").toLowerCase();
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}
