"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
  useAuth,
  useSignIn,
  useSignUp,
} from "@clerk/nextjs";
import {
  authErrorMessage,
  isValidAuthEmail,
  normalizeAuthEmail,
  type AuthAction,
} from "@/lib/auth/ui";
import { safeAuthReturn } from "@/lib/school-student/return-url";

function logAuthError(action: AuthAction, cause: unknown) {
  const code =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;
  console.error("[QueueZero auth]", { action, code });
}

function VerificationCode({
  code,
  disabled,
  onChange,
}: {
  code: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(
    () => Array.from({ length: 6 }, (_, index) => code[index] ?? ""),
    [code],
  );

  return (
    <div className="grid grid-cols-6 gap-2" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          aria-label={`Verification code digit ${index + 1}`}
          className="min-h-12 min-w-0 rounded-xl border border-line px-0 text-center text-lg font-semibold"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, "").slice(-1);
            const next = [...digits];
            next[index] = nextDigit;
            onChange(next.join(""));
            if (nextDigit && index < 5) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (pasted.length === 6) {
              event.preventDefault();
              onChange(pasted);
              refs.current[5]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

function CodeForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const search = useSearchParams();

  const returnTo = safeAuthReturn(
    search.get("redirect_url"),
    mode === "sign-up" ? "/onboarding" : "/dashboard",
  );

  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const other = mode === "sign-in" ? "sign-up" : "sign-in";

  async function requestCode(action: "sign-in" | "sign-up" | "resend") {
    const normalized = normalizeAuthEmail(email || emailInput);

    if (!isValidAuthEmail(normalized)) {
      setError("Enter a valid email address.");
      return false;
    }

    setEmail(normalized);

    try {
      if (mode === "sign-in") {
        const result = await signIn.emailCode.sendCode({ emailAddress: normalized });
        if (result.error) throw result.error;
      } else {
        if (!sent) {
          const created = await signUp.create({ emailAddress: normalized });
          if (created.error) throw created.error;
        }
        const result = await signUp.verifications.sendEmailCode();
        if (result.error) throw result.error;
      }

      setSent(true);
      setCode("");
      return true;
    } catch (cause) {
      logAuthError(action, cause);
      setError(authErrorMessage(cause, action));
      return false;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      if (!sent) {
        await requestCode(mode);
        return;
      }

      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit verification code.");
        return;
      }

      const flow = mode === "sign-in" ? signIn : signUp;
      const result =
        mode === "sign-in"
          ? await signIn.emailCode.verifyCode({ code })
          : await signUp.verifications.verifyEmailCode({ code });

      if (result.error) throw result.error;

      if (flow.status === "complete") {
        const finalized = await flow.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session.currentTask) {
              setAdvanced(true);
              return;
            }
            window.location.assign(decorateUrl(returnTo));
          },
        });
        if (finalized.error) throw finalized.error;
      } else {
        setAdvanced(true);
      }
    } catch (cause) {
      logAuthError("verify", cause);
      setError(authErrorMessage(cause, "verify"));
    } finally {
      setBusy(false);
    }
  }

  if (isSignedIn && !advanced) {
    return (
      <Link className="button-primary" href={returnTo}>
        Continue to QueueZero
      </Link>
    );
  }

  if (advanced) {
    return mode === "sign-in" ? (
      <SignIn routing="path" path="/sign-in" forceRedirectUrl={returnTo} />
    ) : (
      <SignUp routing="path" path="/sign-up" forceRedirectUrl={returnTo} />
    );
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!sent ? (
          <>
            <label className="block text-sm font-medium" htmlFor="auth-email">
              Email address
            </label>
            <input
              id="auth-email"
              className="min-h-12 w-full rounded-xl border border-line px-3"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={busy}
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted">Enter the verification code we sent to:</p>
              <p className="mt-1 text-sm font-medium">{email}</p>
            </div>
            <VerificationCode code={code} disabled={busy} onChange={setCode} />
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <button disabled={busy} className="button-primary w-full" type="submit">
          {busy ? "Please wait…" : sent ? "Verify" : "Continue"}
        </button>

        {mode === "sign-up" && <div id="clerk-captcha" />}
      </form>

      {sent && (
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="button-quiet"
            type="button"
            onClick={async () => {
              setBusy(true);
              setError("");
              await requestCode("resend");
              setBusy(false);
            }}
          >
            Resend code
          </button>
          <button
            disabled={busy}
            className="button-quiet"
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setEmail("");
              setEmailInput("");
              setError("");
            }}
          >
            Use another email
          </button>
        </div>
      )}

      <Link
        className="text-primary underline"
        href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}
      >
        {mode === "sign-in" ? "Create an account" : "Already have an account? Sign in"}
      </Link>

      <button className="button-quiet block" type="button" onClick={() => setAdvanced(true)}>
        Other sign-in options
      </button>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-80 w-full justify-center">
      <ClerkLoading>
        <div className="auth-loading" role="status">
          {slow ? (
            <>
              <p>Secure sign-in is taking longer than expected.</p>
              <button className="button-secondary" onClick={() => window.location.reload()}>
                Try again
              </button>
              <Link href="/" className="button-quiet">
                Back to home
              </Link>
            </>
          ) : (
            <>
              <span className="loading-pulse" />
              <p>Loading secure sign-in…</p>
            </>
          )}
        </div>
      </ClerkLoading>
      <ClerkFailed>
        <div role="alert">
          <p>Sign-in is temporarily unavailable</p>
          <button className="button-secondary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </ClerkFailed>
      <ClerkLoaded>
        <Suspense fallback={<p role="status">Loading secure sign-in…</p>}>
          <CodeForm mode={mode} />
        </Suspense>
      </ClerkLoaded>
    </div>
  );
}
