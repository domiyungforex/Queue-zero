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
import { QrLoader } from "@/components/ui/loading";
import { authErrorMessage, isValidAuthEmail, normalizeAuthEmail } from "@/lib/auth/ui";

function CodeForm({ mode, startAdvanced = false }: { mode: "sign-in" | "sign-up"; startAdvanced?: boolean }) {
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const search = useSearchParams();
  const returnTo = safeAuthReturn(search.get("redirect_url"), mode === "sign-up" ? "/onboarding" : "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL);
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [socialBusy, setSocialBusy] = useState<"google" | "apple" | null>(null);
  const other = mode === "sign-in" ? "sign-up" : "sign-in";
  const isWelcomeBack = mode === "sign-in";

  async function send() {
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
  const [advanced, setAdvanced] = useState(startAdvanced);
  const [showCode, setShowCode] = useState(false);
  const [lastResendAt, setLastResendAt] = useState(0);
  const other = mode === "sign-in" ? "sign-up" : "sign-in";
  async function send(address = email) {
    if (mode === "sign-in") {
      const result = channel === "phone" ? await signIn.phoneCode.sendCode({ phoneNumber: address }) : await signIn.emailCode.sendCode({ emailAddress: address });
      if (result.error) throw new Error(result.error.message);
    } else {
      if (!sent) { const result = await signUp.create(channel === "phone" ? { phoneNumber: address } : { emailAddress: address }); if (result.error) throw new Error(result.error.message); }
      const result = channel === "phone" ? await signUp.verifications.sendPhoneCode() : await signUp.verifications.sendEmailCode();
      if (result.error) throw result.error;
    }
    setSent(true);
    return true;
    setLastResendAt(Date.now());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!sent) {
        await send();
        return;
      }
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
      await send();
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
    setError("");
  }

  const supportsGoogle = mode === "sign-in" && Boolean(signIn.supportedFirstFactors?.some((factor) => factor.strategy === "oauth_google"));
  const supportsApple = mode === "sign-in" && Boolean(signIn.supportedFirstFactors?.some((factor) => factor.strategy === "oauth_apple"));

  async function authenticateWithProvider(provider: "google" | "apple") {
    if (busy || socialBusy) return;
    setSocialBusy(provider);
    setError("");
    try {
      await signIn.sso({
        strategy: provider === "google" ? "oauth_google" : "oauth_apple",
        redirectUrl: returnTo,
        redirectCallbackUrl: "/sign-in/sso-callback",
      });
    } catch (cause) {
      setError(authErrorMessage(cause, "sign-in"));
      setSocialBusy(null);
    }
  }

  if (isSignedIn && !advanced) {
    return isWelcomeBack
      ? <div className={styles.signedIn}><Link className={styles.primaryButton} href={returnTo}>Continue to TuRnMaRk <ArrowRight size={18} aria-hidden="true" /></Link></div>
      : <div className="flex w-full items-start"><Link className="button-primary" href={returnTo}>Continue to TuRnMaRk</Link></div>;
  }

  // Clerk remains responsible for configured MFA, recovery and additional methods.
  if (advanced) {
    return mode === "sign-in"
      ? <SignIn routing="path" path="/sign-in" forceRedirectUrl={returnTo} />
      : <SignUp routing="path" path="/sign-up" forceRedirectUrl={returnTo} />;
  }

  const submitLabel = sent ? "Verify and continue" : "Continue";
  const fieldId = mode === "sign-in" ? "sign-in-identifier" : "sign-up-identifier";

  if (!isWelcomeBack) {
    const legacySubmitLabel = sent ? "Verify and continue" : channel === "phone" ? "Text me a code" : "Email me a code";
    return (
      <div className="w-full max-w-sm space-y-5">
        <form onSubmit={submit} noValidate className="space-y-4">
          {process.env.NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED === "true" && !sent ? (
            <label className="block text-sm">
              Sign in using
              <select aria-label="Sign in using" value={channel} disabled={busy} onChange={(event) => { setChannel(event.target.value === "phone" ? "phone" : "email"); setIdentifier(""); setError(""); }} className="min-h-12 w-full rounded-xl border border-line px-3">
                <option value="email">Email code</option>
                <option value="phone">Phone code</option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium" htmlFor={fieldId}>{channel === "phone" ? "Phone number (with country code)" : "Email address"}</label>
          <input id={fieldId} aria-describedby={error ? "auth-error" : undefined} aria-invalid={Boolean(error) && !sent} className="min-h-12 w-full rounded-xl border border-line px-3" type={channel === "phone" ? "tel" : "email"} autoComplete={channel === "phone" ? "tel" : "email"} required disabled={sent || busy} value={identifier} onChange={(event) => { setIdentifier(event.target.value); if (error) setError(""); }} placeholder={channel === "phone" ? "+234…" : "you@example.com"} />
          {sent ? <><p className="text-sm text-muted">Enter the code sent to {identifier}.</p><label className="block text-sm font-medium" htmlFor="auth-code">Verification code</label><input id="auth-code" aria-describedby={error ? "auth-error" : undefined} aria-invalid={Boolean(error)} className="min-h-12 w-full rounded-xl border border-line px-3 text-center tracking-[.35em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); if (error) setError(""); }} /></> : null}
          {error ? <p id="auth-error" role="alert" aria-live="polite" className="text-sm text-red-700">{error}</p> : null}
          <button aria-label={legacySubmitLabel} disabled={busy} className="button-primary w-full" type="submit">{busy ? sent ? "Checking code…" : "Sending code…" : "Continue"}</button>
          <div id="clerk-captcha" />
        </form>
        <div className="auth-form-links">
          {sent ? <><button type="button" disabled={busy} className="button-quiet" onClick={resend}>Resend code</button><button type="button" disabled={busy} className="button-quiet" onClick={restart}>Use another {channel}</button></> : null}
          <Link className="text-primary underline" href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}>Sign in instead</Link>
          <button type="button" className="button-quiet" onClick={() => setAdvanced(true)}>More options</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.formWrap} ${isWelcomeBack ? styles.welcomeBack : ""}`}>
      <form onSubmit={submit} noValidate className={styles.form}>
        {process.env.NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED === "true" && !sent ? (
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

        <label className={styles.label} htmlFor={fieldId}>{channel === "phone" ? "Phone number" : isWelcomeBack ? "Email" : "Email address"}</label>
        <div className={styles.inputShell} data-invalid={Boolean(error) && !sent ? "true" : undefined}>
          {channel === "email" ? <Mail size={19} aria-hidden="true" /> : null}
          {channel === "email" && isWelcomeBack ? <span className={styles.mobilePlaceholder} aria-hidden="true">Email</span> : null}
          <input
            id={fieldId}
            aria-label={channel === "phone" ? "Phone number (with country code)" : "Email address"}
            aria-describedby={error ? "auth-error" : undefined}
            aria-invalid={Boolean(error) && !sent}
            type={channel === "phone" ? "tel" : "email"}
            inputMode={channel === "phone" ? "tel" : "email"}
            autoComplete={channel === "phone" ? "tel" : "email"}
            required
            autoFocus={isWelcomeBack}
            disabled={sent || busy}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (error) setError("");
            }}
            placeholder={channel === "phone" ? "+234…" : isWelcomeBack ? "you@youremail.com" : "you@example.com"}
          />
        </div>

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
          {busy ? sent ? "Checking code…" : "Sending code…" : submitLabel}
          {!busy ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
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
          <button type="button" disabled={busy} onClick={restart}>Use another {channel}</button>
        </div>
      ) : null}

      {!sent ? (
        <button type="button" className={styles.differentMethod} onClick={() => setAdvanced(true)}>
          Use a different method <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}

      <p className={styles.accountPrompt}>
        {mode === "sign-in" ? "Don’t have an account?" : "Already have an account?"}{" "}
        <Link href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}>{mode === "sign-in" ? "Get started" : "Sign in instead"}</Link>
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
        <Suspense fallback={<AuthFormLoading />}><CodeForm mode={mode} /></Suspense>
      </ClerkLoaded>
    </div>
  );
      let address = email;
      if (!sent && channel === "email") {
        const normalized = normalizeAuthEmail(email);
        if (!isValidAuthEmail(normalized)) { setError("Enter a valid email address."); return; }
        setEmail(normalized);
        address = normalized;
      }
      if (!sent) { await send(address); return; }
      const flow = mode === "sign-in" ? signIn : signUp;
      const result = mode === "sign-in" ? (channel === "phone" ? await signIn.phoneCode.verifyCode({ code }) : await signIn.emailCode.verifyCode({ code })) : (channel === "phone" ? await signUp.verifications.verifyPhoneCode({ code }) : await signUp.verifications.verifyEmailCode({ code }));
      if (result.error) throw new Error(result.error.message);
      if (result.status === "complete") {
        const finalized = await flow.finalize({ navigate: ({ session, decorateUrl }) => {
          if (session.currentTask) { setAdvanced(true); return; }
          window.location.assign(decorateUrl(returnTo));
        } });
        if (finalized.error) throw new Error(finalized.error.message);
      } else { setAdvanced(true); }
    } catch (cause) { setError(authErrorMessage(cause, sent ? "verify" : mode)); }
    finally { setBusy(false); }
  }
  if (isSignedIn && !advanced) return <Link className="button-primary" href={returnTo}>Continue to TuRnMaRk</Link>;
  // Preserve configured MFA, account recovery and pending session requirements.
  if (advanced) return mode === "sign-in" ? <SignIn routing="path" path="/sign-in" forceRedirectUrl={returnTo} /> : <SignUp routing="path" path="/sign-up" forceRedirectUrl={returnTo} />;
  const submitLabel = sent ? "Verify and continue" : channel === "phone" ? "Text me a code" : "Email me a code";
  return <div className="w-full max-w-sm space-y-5">{sent && !showCode && <section className="rounded-3xl bg-[#FFFAF7] px-4 py-8 text-center"><div aria-hidden="true" className="mx-auto mb-6 text-7xl">✉️</div><h2 className="text-2xl font-extrabold text-[#111318]">Check your email</h2><p className="mt-3 text-sm text-[#73788A]">We’ve sent a sign in code to <strong className="block break-all text-[#111318]">{email}</strong></p><p className="mt-6 rounded-xl bg-white p-4 text-xs text-[#73788A]">If you don’t see the email, check your spam folder.</p><button type="button" onClick={() => setShowCode(true)} className="button-primary mt-6 w-full !min-h-14 !rounded-2xl !bg-[#FF6B2B]">Enter code →</button><button type="button" onClick={() => {setSent(false);setCode("");setShowCode(false)}} className="mt-4 min-h-11 text-sm font-semibold text-[#FF6B2B]">Use a different email</button></section>}{(!sent || showCode) && <form onSubmit={submit} className="space-y-4">{process.env.NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED === "true" && !sent && <label className="block text-sm">Sign in using<select aria-label="Sign in using" value={channel} disabled={busy} onChange={event => {setChannel(event.target.value === "phone" ? "phone" : "email");setEmail("")}} className="min-h-12 w-full rounded-xl border border-line px-3"><option value="email">Email code</option><option value="phone">Phone code</option></select></label>}<label className="block text-sm font-medium" htmlFor="auth-email">{channel === "phone" ? "Phone number (with country code)" : "Email address"}</label><input id="auth-email" className="min-h-12 w-full rounded-xl border border-line px-3" type={channel === "phone" ? "tel" : "email"} autoComplete={channel === "phone" ? "tel" : "email"} required disabled={sent || busy} value={email} onChange={event => setEmail(event.target.value)} placeholder={channel === "phone" ? "+234…" : "you@example.com"} />{sent && <><p className="text-sm text-muted">Enter the 6-digit code sent to {email}.</p><label className="block text-sm font-medium" htmlFor="auth-code">Verification code</label><input id="auth-code" className="min-h-14 w-full rounded-xl border border-[#D8D9DE] bg-white px-3 text-center text-2xl tracking-[.45em] focus-visible:outline-[#FF6B2B]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} /></>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button aria-label={submitLabel} disabled={busy} className="button-primary w-full !min-h-14 !rounded-2xl !bg-[#FF6B2B]" type="submit">{busy ? (sent ? "Checking code…" : "Sending code…") : "Continue"}</button>{mode === "sign-up" && <div id="clerk-captcha" />}</form>}{(!sent || showCode) && <div className="auth-form-links">{sent && <button disabled={busy} className="button-quiet" onClick={async () => {if (Date.now() - lastResendAt < 30000) {setError("Please wait 30 seconds before requesting another code.");return;}setBusy(true);setError("");try{await send()}catch{setError(authErrorMessage(null, "resend"))}finally{setBusy(false)}}}>Resend code</button>}<Link className="text-primary underline" href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}>{mode === "sign-in" ? "Create an account" : "Sign in instead"}</Link><button className="button-quiet" onClick={() => setAdvanced(true)}>More options</button>{mode === "sign-in" && <button type="button" className="button-quiet" onClick={() => setAdvanced(true)}>Forgot password?</button>}</div>}</div>;
}
export function AuthForm({ mode, startAdvanced = false }: { mode: "sign-in" | "sign-up"; startAdvanced?: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(timer); }, []);
  return <div className="flex w-full items-start justify-center"><ClerkLoading><div className="auth-loading">{slow ? <><p>Secure sign-in is taking longer than expected.</p><button className="button-secondary" onClick={() => window.location.reload()}>Try again</button><Link href="/" className="button-quiet">Back home</Link></> : <QrLoader label="Opening sign-in" />}</div></ClerkLoading><ClerkFailed><div role="alert"><p>Sign-in is temporarily unavailable</p><button className="button-secondary" onClick={() => window.location.reload()}>Try again</button></div></ClerkFailed><ClerkLoaded><Suspense fallback={<QrLoader label="Opening sign-in" />}><CodeForm mode={mode} startAdvanced={startAdvanced} /></Suspense></ClerkLoaded></div>;
}
