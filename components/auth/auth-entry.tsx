"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

export function AuthEntry() {
  const [screen, setScreen] = useState<"welcome" | "email">("welcome");
  return (
    <div className="min-h-[100dvh] bg-[#FFFAF7] text-[#111318]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] md:max-w-[480px]">
        <header className="flex min-h-12 items-center justify-between">
          {screen === "email" ? (
            <button type="button" aria-label="Back to welcome" onClick={() => setScreen("welcome")} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B2B]"><ArrowLeft size={20} /></button>
          ) : <span />}
          <span className="text-xl font-extrabold tracking-[-.06em]"><span className="text-[#FF6B2B]">Tu</span>Rn<span className="text-[#FF4765]">MaRk</span></span>
        </header>
        {screen === "welcome" ? (
          <main className="flex flex-1 flex-col">
            <section className="relative flex min-h-[270px] flex-1 flex-col justify-between overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_75%_55%,#FFD4BF_0%,transparent_52%)] py-5">
              <p className="text-sm leading-5">Queues. Attendance.<br />Appointments.<br />Made Simple.</p>
              <p className="-rotate-6 self-start text-3xl font-black italic leading-[1.05] tracking-tight">Scan<br />Join<br />Leave<br />the line</p>
            </section>
            <section className="rounded-[28px] bg-white px-5 py-7 shadow-[0_12px_40px_rgba(60,28,12,.06)]">
              <h1 className="text-[23px] font-extrabold tracking-tight">Welcome to <span className="text-[#FF4765]">TuRnMaRk</span></h1>
              <p className="mt-1 text-sm text-[#73788A]">Sign in or create your account to get started.</p>
              <button type="button" onClick={() => setScreen("email")} className="mt-6 flex min-h-14 w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#FF6B2B] to-[#FF4765] px-5 font-semibold text-white shadow-[0_8px_18px_rgba(255,107,43,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B2B]"><Mail size={19} />Continue with email<ArrowRight size={20} /></button>
              <p className="mt-5 text-center text-xs text-[#73788A]">Have an account? Continue with email to sign in.</p>
              <p className="mt-6 text-center text-[11px] leading-5 text-[#73788A]">By continuing, you agree to TuRnMaRk's applicable terms and privacy policies.</p>
            </section>
          </main>
        ) : (
          <main className="flex flex-1 flex-col justify-center pb-20">
            <h1 className="text-[29px] font-extrabold tracking-tight">Sign in</h1>
            <p className="mb-7 mt-1 text-sm text-[#73788A]">Enter your email to continue</p>
            <div className="[&_input]:border-[#D8D9DE] [&_input]:bg-white [&_input]:focus-visible:outline-[#FF6B2B] [&_button.button-primary]:min-h-14 [&_button.button-primary]:rounded-2xl [&_button.button-primary]:bg-gradient-to-r [&_button.button-primary]:from-[#FF6B2B] [&_button.button-primary]:to-[#FF4765]">
              <AuthForm mode="sign-in" />
            </div>
            <p className="mt-8 text-center text-xs text-[#73788A]">New to TuRnMaRk? <Link className="font-semibold text-[#FF6B2B]" href="/sign-up">Create an account</Link></p>
          </main>
        )}
      </div>
    </div>
  );
}
