/**
 * Username support for email-optional sign-up.
 *
 * Firebase Auth requires an email address, so usernames are mapped to a
 * synthetic email of the form `<username>@u.<projectId>.local`. That domain
 * is clearly non-routable and unique to this project, so it can never
 * collide with real user email addresses.
 */

const PROJECT_ID =
  (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? "chat";

export const SYNTHETIC_EMAIL_DOMAIN = `u.${PROJECT_ID}.local`;

// 3–20 chars, letters/digits/underscore/dot/hyphen.
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,20}$/;

export function isValidUsername(name: string): boolean {
  return USERNAME_REGEX.test(name);
}

export function usernameToAuthEmail(username: string): string {
  return `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/** Extracts "<username>" from a synthetic email, or null if not synthetic. */
export function usernameFromSyntheticEmail(
  email: string | null | undefined,
): string | null {
  if (!email || !isSyntheticEmail(email)) return null;
  return email.split("@")[0];
}

export type ResolvedIdentifier = {
  /** The email address to feed into Firebase Auth (real or synthetic). */
  authEmail: string;
  /** The username if the identifier was a username, else null. */
  username: string | null;
};

/**
 * Accepts an "email or username" input from a form and resolves it to:
 *   - a valid Firebase Auth email (real or synthetic), and
 *   - the username (if applicable) so we can persist it in the users doc.
 *
 * Throws a user-facing error if the input is neither a valid email nor a
 * valid username.
 */
export function resolveIdentifier(input: string): ResolvedIdentifier {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("กรุณากรอกอีเมล หรือ username");
  if (trimmed.includes("@")) {
    // Assume email; Firebase will validate format server-side too.
    return { authEmail: trimmed, username: null };
  }
  if (!isValidUsername(trimmed)) {
    throw new Error(
      "username ต้องเป็น a-z, 0-9, _ . - ความยาว 3–20 ตัว",
    );
  }
  return { authEmail: usernameToAuthEmail(trimmed), username: trimmed };
}
