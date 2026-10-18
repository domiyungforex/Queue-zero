"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { SignIn, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";
import { isValidAuthEmail, normalizeAuthEmail } from "@/lib/auth/ui";
import { useSearchParams } from "next/navigation";
import { safeAuthReturn } from "@/lib/school-student/return-url";
import { publicEnv } from "@/lib/env";

export function PhaseOneAuth({ initial = "welcome" }: { initial?: "welcome" | "email" }) {
  const [step, setStep] = useState<"welcome" | "email" | "clerk">(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const params = useSearchParams();
  const returnTo = safeAuthReturn(params.get("redirect_url"), "/dashboard", publicEnv.NEXT_PUBLIC_APP_URL);
  const next = () => {
    const normalized = normalizeAuthEmail(email);
    if (!isValidAuthEmail(normalized)) { setError("Enter a valid email address."); return; }
    setEmail(normalized);
    setError("");
    setStep("clerk");
  };
  return <main id="main" className="min-h-[100dvh] bg-[#FFFAF7] text-[#111318] lg:grid lg:grid-cols-2">
    <aside className="hidden lg:flex flex-col justify-center items-center bg-[#FFF0E9] p-12">
      <Image src={TURNMARK_ASSETS.auth.welcomeStudent.src} width={360} height={520} alt={TURNMARK_ASSETS.auth.welcomeStudent.alt} className="max-h-[60vh] w-auto object-contain" priority />
      <p className="mt-6 text-center text-xl font-bold">Scan. Join. Leave the line.</p>
    </aside>
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-6 pt-[max(28px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] lg:justify-center">
      <header className="flex min-h-12 items-center justify-center relative">
        {step !== "welcome" && <button type="button" aria-label="Back" onClick={() => { setStep(step === "clerk" ? "email" : "welcome"); setError(""); }} className="absolute left-0 min-h-11 min-w-11 flex items-center justify-center"><ArrowLeft /></button>}
        <Image src={TURNMARK_ASSETS.branding.wordmark.src} width={170} height={38} alt="TuRnMaRk" className="h-auto w-[170px]" priority />
      </header>
      {step === "welcome" ? <>
        <div className="flex flex-1 flex-col items-center justify-center py-5">
          <p className="text-center text-sm font-semibold leading-5">Queues. Attendance. Appointments.<br />Made Simple.</p>
          <div className="relative mt-5 flex min-h-[260px] w-full items-center justify-center overflow-hidden rounded-[28px] bg-[radial-gradient(ellipse_at_center,#FFD8C8_0%,#FFFAF7_72%)]">
            <Image src={TURNMARK_ASSETS.auth.welcomeStudent.src} width={280} height={408} alt={TURNMARK_ASSETS.auth.welcomeStudent.alt} className="h-[290px] w-auto object-contain" priority />
            <span className="absolute bottom-6 right-2 -rotate-6 text-lg font-black italic">Scan. Join.<br />Leave the line.</span>
          </div>
        </div>
        <section className="rounded-[26px] bg-white p-5 shadow-[0_12px_40px_rgba(80,30,20,.07)]">
          <h1 className="text-center text-xl font-extrabold">Welcome to TuRnMaRk</h1>
          <p className="mt-2 text-center text-sm text-[#73788A]">Sign in or create your account to get started.</p>
          <button onClick={() => setStep("email")} className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#FF6B2B] to-[#FF4765] font-semibold text-white">Continue with email <ArrowRight size={18} /></button>
          <p className="mt-5 text-center text-xs text-[#73788A]">By continuing, you agree to our <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        </section>
      </> : step === "email" ? <section className="flex flex-1 flex-col justify-center pb-20">
        <h1 className="text-3xl font-extrabold tracking-tight">Enter your email</h1>
        <p className="mt-3 text-sm text-[#73788A]">We&apos;ll help you continue securely with Clerk.</p>
        <form className="mt-9" onSubmit={e => { e.preventDefault(); next(); }} noValidate>
          <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold">Email</label>
          <div className="flex min-h-14 items-center gap-3 rounded-xl border border-[#DDDDE2] bg-white px-4 focus-within:ring-2 focus-within:ring-[#FF6B2B]"><Mail size={19} className="text-[#73788A]" /><input id="auth-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => {setEmail(e.target.value);setError("");}} placeholder="you@example.com" aria-invalid={Boolean(error)} aria-describedby={error ? "auth-email-error" : undefined} className="w-full min-w-0 bg-transparent outline-none" /></div>
          {error && <p id="auth-email-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          <button type="submit" className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#FF6B2B] to-[#FF4765] font-semibold text-white">Continue <ArrowRight size={18} /></button>
        </form>
      </section> : <section className="flex flex-1 flex-col justify-center pb-12">
        <h1 className="mb-4 text-2xl font-bold">Continue securely</h1>
        <p className="mb-6 break-all text-sm text-[#73788A]">{email}</p>
        <ClerkLoading><p role="status">Loading secure authentication…</p></ClerkLoading>
        <ClerkLoaded><SignIn routing="hash" initialValues={{identifier:email}} fallbackRedirectUrl={returnTo} /></ClerkLoaded>
      </section>}
    </div>
  </main>;
}
