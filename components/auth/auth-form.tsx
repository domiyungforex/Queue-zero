"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Apple, ArrowRight, ChevronDown, Mail } from "lucide-react";
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp, useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { authErrorMessage, isValidAuthEmail, normalizeAuthEmail } from "@/lib/auth/ui";
import { publicEnv } from "@/lib/env";
import { safeAuthReturn } from "@/lib/school-student/return-url";
import styles from "./auth-form.module.css";

function AuthFormInner({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const search = useSearchParams();
  const returnTo = safeAuthReturn(search.get("redirect_url"), mode === "sign-up" ? "/onboarding" : "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL);
  // Plan chosen on the public pricing page (/sign-up?plan=starter). Shown so
  // the selection is not silently lost; billing itself still happens after
  // onboarding, in the dashboard.
  const planParam = mode === "sign-up" ? search.get("plan")?.toLowerCase() : null;
  const selectedPlan =
    planParam && ["free", "starter", "events", "growth", "education", "professional"].includes(planParam)
      ? planParam[0].toUpperCase() + planParam.slice(1)
      : null;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"password" | "code">("password");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(search.get("oauth") === "continue");
  const [socialBusy, setSocialBusy] = useState<"google" | "apple" | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const other = mode === "sign-in" ? "sign-up" : "sign-in";
  const isWelcomeBack = mode === "sign-in";

  async function handlePasswordAuth() {
    const email = normalizeAuthEmail(identifier);
    if (!isValidAuthEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIdentifier(email);
    if (mode === "sign-in") {
      const result = await signIn.create({ identifier: email, password });
      if (result.error) throw result.error;
      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ decorateUrl }) => window.location.assign(decorateUrl(returnTo)),
        });
      } else {
        setAdvanced(true);
      }
    } else {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.error) throw result.error;
      // Trigger verification using existing verifications API
      await signUp.verifications.sendEmailCode();
      setSent(true);
      setMethod("code");
    }
  }

  async function sendCode() {
    const value = channel === "email" ? normalizeAuthEmail(identifier) : identifier.trim();
    if (channel === "email" && !isValidAuthEmail(value)) {
      setError("Enter a valid email address.");
      return false;
    }
    if (!value) {
      setError(channel === "email" ? "Enter a valid email address." : "Enter a valid phone number.");
      return false;
    }

    setIdentifier(value);
    if (mode === "sign-in") {
      const result = channel === "phone"
        ? await signIn.phoneCode.sendCode({ phoneNumber: value })
        : await signIn.emailCode.sendCode({ emailAddress: value });
      if (result.error) throw result.error;
    } else {
      if (!sent) {
        const result = await signUp.create(channel === "phone" ? { phoneNumber: value } : { emailAddress: value });
        if (result.error) throw result.error;
      }
      const result = channel === "phone" ? await signUp.verifications.sendPhoneCode() : await signUp.verifications.sendEmailCode();
      if (result.error) throw result.error;
    }
    setSent(true);
    return true;
  }

  async function verifyCode() {
    const flow = mode === "sign-in" ? signIn : signUp;
    const result = mode === "sign-in"
      ? channel === "phone" ? await signIn.phoneCode.verifyCode({ code }) : await signIn.emailCode.verifyCode({ code })
      : channel === "phone" ? await signUp.verifications.verifyPhoneCode({ code }) : await signUp.verifications.verifyEmailCode({ code });
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
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (forgotMode) {
        // Fall back to code-based recovery (existing supported path) or advanced Clerk UI
        setForgotMode(false);
        setMethod("code");
        setError("Enter your email and continue to receive a verification code, or use a different method for password reset.");
        return;
      }

      if (method === "password" && !sent) {
        await handlePasswordAuth();
        return;
      }

      if (!sent) {
        await sendCode();
        return;
      }

      await verifyCode();
    } catch (cause) {
      setError(authErrorMessage(cause, sent ? "verify" : mode));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (method === "code") await sendCode();
    } catch (cause) {
      setError(authErrorMessage(cause, "resend"));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    if (busy) return;
    setSent(false);
    setCode("");
    setPassword("");
    setError("");
    setForgotMode(false);
    setMethod("password");
  }

  const supportsGoogle = true;
  const supportsApple = mode === "sign-in" && Boolean(signIn.supportedFirstFactors?.some((factor) => factor.strategy === "oauth_apple"));

  async function authenticateWithProvider(provider: "google" | "apple") {
    if (busy || socialBusy) return;
    setSocialBusy(provider);
    setError("");
    try {
      await signIn.sso({
        strategy: provider === "google" ? "oauth_google" : "oauth_apple",
        redirectUrl: returnTo,
        redirectCallbackUrl: `/sign-in/sso-callback?redirect_url=${encodeURIComponent(returnTo)}`,
      });
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
      setSocialBusy(null);
    }
  }

  if (isSignedIn && !advanced) {
    return isWelcomeBack
      ? <div className={styles.signedIn}><Link className={styles.primaryButton} href={returnTo}>Continue to TuRnMaRk <ArrowRight size={18} aria-hidden="true" /></Link></div>
      : <div className="flex w-full items-start"><Link className="button-primary" href={returnTo}>Continue to TuRnMaRk</Link></div>;
  }

  if (advanced) {
    return mode === "sign-in"
      ? <SignIn routing="path" path="/sign-in" forceRedirectUrl={returnTo} />
      : <SignUp routing="path" path="/sign-up" forceRedirectUrl={returnTo} />;
  }

  const submitLabel = sent ? "Verify and continue" : forgotMode ? "Send reset code" : "Continue";
  const fieldId = mode === "sign-in" ? "sign-in-identifier" : "sign-up-identifier";

  return (
    <div className={`${styles.formWrap} ${styles.welcomeBack}`}>
      {selectedPlan ? (
        <p className={styles.planNotice} role="note">
          Selected plan: <strong>{selectedPlan}</strong> — create your account first; you can confirm or change
          your plan after setup.
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className={styles.form}>
        {process.env.NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED === "true" && method === "code" && !sent ? (
          <label className={styles.methodLabel}>
            Sign in using
            <select
              aria-label="Sign in using"
              value={channel}
              disabled={busy}
              onChange={(event) => {
                setChannel(event.target.value === "phone" ? "phone" : "email");
                setIdentifier("");
                setError("");
              }}
            >
              <option value="email">Email code</option>
              <option value="phone">Phone code</option>
            </select>
          </label>
        ) : null}

        <label className={styles.label} htmlFor={fieldId}>
          {channel === "phone" && method === "code" ? "Phone number" : "Email address"}
        </label>
        <div className={styles.inputShell} data-invalid={Boolean(error) && !sent ? "true" : undefined}>
          {channel === "email" || method === "password" ? <Mail size={19} aria-hidden="true" /> : null}
          <input
            id={fieldId}
            aria-label={channel === "phone" && method === "code" ? "Phone number (with country code)" : "Email address"}
            aria-describedby={error ? "auth-error" : undefined}
            aria-invalid={Boolean(error) && !sent}
            type={channel === "phone" && method === "code" ? "tel" : "email"}
            inputMode={channel === "phone" && method === "code" ? "tel" : "email"}
            autoComplete={channel === "phone" && method === "code" ? "tel" : "email"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus={isWelcomeBack}
            disabled={sent || busy}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (error) setError("");
            }}
            placeholder={channel === "phone" && method === "code" ? "+234…" : "you@youremail.com"}
          />
        </div>

        {method === "password" && !sent && !forgotMode ? (
          <>
            <label className={styles.label} htmlFor="auth-password">Password</label>
            <div className={styles.inputShell} data-invalid={Boolean(error) ? "true" : undefined}>
              <input
                id="auth-password"
                aria-label="Password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                required
                disabled={busy}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="••••••••"
              />
            </div>
            {mode === "sign-in" ? (
              <button type="button" className={styles.differentMethod} onClick={() => setForgotMode(true)} disabled={busy}>
                Forgot password?
              </button>
            ) : null}
          </>
        ) : null}

        {sent ? (
          <div className={styles.codeBlock}>
            <p>Enter the verification code sent to <strong>{identifier}</strong>.</p>
            <label className={styles.label} htmlFor="auth-code">Verification code</label>
            <input
              id="auth-code"
              className={styles.codeInput}
              aria-describedby={error ? "auth-error" : undefined}
              aria-invalid={Boolean(error)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError("");
              }}
            />
          </div>
        ) : null}

        <div id="auth-error" className={styles.error} role={error ? "alert" : undefined} aria-live="polite">{error}</div>

        <button aria-label={submitLabel} disabled={busy} className={styles.primaryButton} type="submit">
          {busy ? (sent ? "Checking code…" : "Continuing…") : submitLabel}
          {!busy ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
        <div id="clerk-captcha" />
      </form>

      {!sent && (supportsGoogle || supportsApple) ? (
        <div className={styles.socialMethods}>
          <div className={styles.divider}><span>OR</span></div>
          {supportsGoogle ? (
            <button type="button" className={styles.providerButton} disabled={Boolean(socialBusy)} onClick={() => authenticateWithProvider("google")}>
              <span className={styles.googleMark} aria-hidden="true">G</span>
              {socialBusy === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
          ) : null}
          {supportsApple ? (
            <button type="button" className={styles.providerButton} disabled={Boolean(socialBusy)} onClick={() => authenticateWithProvider("apple")}>
              <Apple size={20} fill="currentColor" aria-hidden="true" />
              {socialBusy === "apple" ? "Opening Apple…" : "Continue with Apple"}
            </button>
          ) : null}
        </div>
      ) : null}

      {sent ? (
        <div className={styles.inlineActions}>
          <button type="button" disabled={busy} onClick={resend}>Resend code</button>
          <button type="button" disabled={busy} onClick={restart}>Start over</button>
        </div>
      ) : null}

      {!sent && !forgotMode ? (
        <button type="button" className={styles.differentMethod} onClick={() => setMethod(method === "password" ? "code" : "password")}>
          {method === "password" ? "Use email code instead" : "Use password instead"} <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}

      {!sent ? (
        <button type="button" className={styles.differentMethod} onClick={() => setAdvanced(true)}>
          Use a different method <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}

      <p className={styles.accountPrompt}>
        {mode === "sign-in" ? "Don’t have an account?" : "Already have an account?"}{" "}
        <Link href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}>{mode === "sign-in" ? "Create account" : "Sign in instead"}</Link>
      </p>

      {mode === "sign-in" && !sent ? (
        <p className={styles.legal}>
          By continuing, you agree to our <span>Terms of Service</span><br />
          and <Link href="/privacy">Privacy Policy</Link>
        </p>
      ) : null}
    </div>
  );
}

function AuthFormLoading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.formWrap} ${styles.welcomeBack}`} aria-busy="true">
      <div className={styles.form}>
        <label className={styles.label} htmlFor="sign-in-loading-email">Email</label>
        <div className={styles.inputShell}>
          <Mail size={19} aria-hidden="true" />
          <span className={styles.mobilePlaceholder} aria-hidden="true">Email</span>
          <input id="sign-in-loading-email" type="email" placeholder="Email" disabled />
        </div>
        <p className={slow ? styles.connectionError : styles.connectionStatus} role="status">
          {slow ? "Secure sign-in is taking longer than expected." : "Connecting secure sign-in…"}
        </p>
        <button className={styles.primaryButton} type="button" disabled>Continue <ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      {slow ? <button className={styles.retryButton} type="button" onClick={() => window.location.reload()}>Try again</button> : null}
    </div>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className={styles.root}>
      <ClerkLoading>
        <AuthFormLoading />
      </ClerkLoading>
      <ClerkFailed>
        <div className={styles.failed} role="alert">
          <p>Sign-in is temporarily unavailable.</p>
          <button className="button-secondary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </ClerkFailed>
      <ClerkLoaded>
        <Suspense fallback={<AuthFormLoading />}><AuthFormInner mode={mode} /></Suspense>
      </ClerkLoaded>
    </div>
  );
}
