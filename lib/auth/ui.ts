export type AuthAction = "sign-in" | "sign-up" | "verify" | "resend";

export function normalizeAuthEmail(input: string) {
  return input.trim().toLowerCase();
}

export function isValidAuthEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function errorText(cause: unknown): string {
  if (typeof cause === "string") return cause.toLowerCase();
  if (cause instanceof Error) return cause.message.toLowerCase();
  if (!cause || typeof cause !== "object") return "";

  const value = cause as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["code", "message", "longMessage"]) {
    if (typeof value[key] === "string") parts.push(value[key]);
  }
  if (Array.isArray(value.errors)) {
    for (const item of value.errors) parts.push(errorText(item));
  }
  return parts.join(" ").toLowerCase();
}

export function authErrorMessage(cause: unknown, action: AuthAction) {
  const text = errorText(cause);

  if (
    text.includes("form_param_format_invalid") ||
    text.includes("identifier_invalid") ||
    text.includes("email_address_invalid") ||
    (text.includes("email") && text.includes("invalid"))
  ) {
    return "Enter a valid email address.";
  }

  if (
    text.includes("form_code_incorrect") ||
    text.includes("verification_invalid") ||
    text.includes("code_incorrect") ||
    (text.includes("code") && (text.includes("incorrect") || text.includes("invalid")))
  ) {
    return "That verification code is incorrect.";
  }

  if (text.includes("expired")) {
    return "That code has expired. Request a new one.";
  }

  if (
    text.includes("too_many") ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("too many attempts") ||
    text.includes("thrott")
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (action === "sign-up") return "We couldn't create your account right now. Try again.";
  if (action === "verify") return "We couldn't verify that code right now. Try again.";
  if (action === "resend") return "We couldn't resend the code right now. Try again.";
  return "We couldn't sign you in right now. Try again.";
}
