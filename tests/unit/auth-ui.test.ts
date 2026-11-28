import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  isValidAuthEmail,
  normalizeAuthEmail,
} from "@/lib/auth/ui";

describe("authentication UI helpers", () => {
  it("normalizes email identifiers before Clerk submission", () => {
    expect(normalizeAuthEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it.each([
    ["user@example.com", true],
    [" user@example.com ", false],
    ["userexample.com", false],
    ["user@", false],
    ["", false],
  ])("validates email input %s", (value, expected) => {
    expect(isValidAuthEmail(value)).toBe(expected);
  });

  it("maps invalid email errors without exposing raw SDK/browser text", () => {
    expect(
      authErrorMessage(
        {
          errors: [
            {
              code: "form_param_format_invalid",
              message: "The string did not match the expected pattern.",
            },
          ],
        },
        "sign-in",
      ),
    ).toBe("Enter a valid email address.");
  });

  it("maps verification failures", () => {
    expect(
      authErrorMessage({ code: "form_code_incorrect", message: "Code incorrect" }, "verify"),
    ).toBe("That verification code is incorrect.");
    expect(authErrorMessage(new Error("verification code expired"), "verify")).toBe(
      "That code has expired. Request a new one.",
    );
  });

  it("maps an unknown account without exposing Clerk internals", () => {
    expect(authErrorMessage({ code: "form_identifier_not_found" }, "sign-in")).toBe(
      "We couldn't continue with that email. Check it or create an account.",
    );
  });

  it("maps an incorrect password instead of falling through to the generic failure", () => {
    expect(
      authErrorMessage(
        { errors: [{ code: "form_password_incorrect", message: "Password is incorrect" }] },
        "sign-in",
      ),
    ).toBe("That password is incorrect. Try again, or use an email code instead.");
  });

  it("maps duplicate accounts and short passwords on sign-up", () => {
    expect(authErrorMessage({ code: "form_identifier_exists" }, "sign-up")).toBe(
      "An account with that email already exists. Sign in instead.",
    );
    expect(authErrorMessage({ code: "form_password_length_too_short" }, "sign-up")).toBe(
      "Use a longer password (at least 8 characters).",
    );
  });

  it("maps rate limits and unknown failures", () => {
    expect(authErrorMessage({ code: "too_many_requests" }, "sign-in")).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
    expect(authErrorMessage(new Error("network failed"), "sign-in")).toBe(
      "We couldn't sign you in right now. Try again.",
    );
  });
});
