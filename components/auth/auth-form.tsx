"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn, SignUp, useSignIn, useSignUp, useAuth } from "@clerk/nextjs";
import { safeAuthReturn } from "@/lib/school-student/return-url";
import { publicEnv } from "@/lib/env";
import { QrLoader } from "@/components/ui/loading";
import { authErrorMessage, isValidAuthEmail, normalizeAuthEmail } from "@/lib/auth/ui";

function CodeForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const search = useSearchParams();
  const returnTo = safeAuthReturn(search.get("redirect_url"), mode === "sign-up" ? "/onboarding" : "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL);
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const other = mode === "sign-in" ? "sign-up" : "sign-in";
  async function send(address = email) {
    if (mode === "sign-in") {
      const result = channel === "phone" ? await signIn.phoneCode.sendCode({ phoneNumber: address }) : await signIn.emailCode.sendCode({ emailAddress: address });
      if (result.error) throw new Error(result.error.message);
    } else {
      if (!sent) { const result = await signUp.create(channel === "phone" ? { phoneNumber: email } : { emailAddress: email }); if (result.error) throw new Error(result.error.message); }
      const result = channel === "phone" ? await signUp.verifications.sendPhoneCode() : await signUp.verifications.sendEmailCode();
      if (result.error) throw new Error(result.error.message);
    }
    setSent(true);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
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
      if (flow.status === "complete") {
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
  return <div className="w-full max-w-sm space-y-5"><form onSubmit={submit} className="space-y-4">{process.env.NEXT_PUBLIC_CLERK_PHONE_AUTH_ENABLED === "true" && !sent && <label className="block text-sm">Sign in using<select aria-label="Sign in using" value={channel} disabled={busy} onChange={event => {setChannel(event.target.value === "phone" ? "phone" : "email");setEmail("")}} className="min-h-12 w-full rounded-xl border border-line px-3"><option value="email">Email code</option><option value="phone">Phone code</option></select></label>}<label className="block text-sm font-medium" htmlFor="auth-email">{channel === "phone" ? "Phone number (with country code)" : "Email address"}</label><input id="auth-email" className="min-h-12 w-full rounded-xl border border-line px-3" type={channel === "phone" ? "tel" : "email"} autoComplete={channel === "phone" ? "tel" : "email"} required disabled={sent || busy} value={email} onChange={event => setEmail(event.target.value)} placeholder={channel === "phone" ? "+234…" : "you@example.com"} />{sent && <><p className="text-sm text-muted">Enter the code sent to {email}.</p><label className="block text-sm font-medium" htmlFor="auth-code">Verification code</label><input id="auth-code" className="min-h-12 w-full rounded-xl border border-line px-3 text-center tracking-[.35em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} /></>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button aria-label={submitLabel} disabled={busy} className="button-primary w-full" type="submit">{busy ? (sent ? "Checking code…" : "Sending code…") : "Continue"}</button>{mode === "sign-up" && <div id="clerk-captcha" />}</form><div className="auth-form-links">{sent && <button disabled={busy} className="button-quiet" onClick={async () => {setBusy(true);setError("");try{await send()}catch{setError("Could not resend the code. Please try again shortly.")}finally{setBusy(false)}}}>Resend code</button>}<Link className="text-primary underline" href={`/${other}?redirect_url=${encodeURIComponent(returnTo)}`}>{mode === "sign-in" ? "Create an account" : "Sign in instead"}</Link><button className="button-quiet" onClick={() => setAdvanced(true)}>More options</button></div></div>;
}
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(timer); }, []);
  return <div className="flex w-full items-start justify-center"><ClerkLoading><div className="auth-loading">{slow ? <><p>Secure sign-in is taking longer than expected.</p><button className="button-secondary" onClick={() => window.location.reload()}>Try again</button><Link href="/" className="button-quiet">Back home</Link></> : <QrLoader label="Opening sign-in" />}</div></ClerkLoading><ClerkFailed><div role="alert"><p>Sign-in is temporarily unavailable</p><button className="button-secondary" onClick={() => window.location.reload()}>Try again</button></div></ClerkFailed><ClerkLoaded><Suspense fallback={<QrLoader label="Opening sign-in" />}><CodeForm mode={mode} /></Suspense></ClerkLoaded></div>;
}
