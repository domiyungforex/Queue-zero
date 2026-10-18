import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";

type AuthVisual = "business" | "student";

export function AuthShell({title,description,children,visual="business"}:{title:string;description:string;children:React.ReactNode;visual?:AuthVisual}){
 const asset=visual==="student"?TURNMARK_ASSETS.characters.student:TURNMARK_ASSETS.characters.businessProfessional;
 return <div className="auth-shell auth-shell-simple"><header className="auth-simple-header"><Brand/><Link href="/"><ArrowLeft size={16}/>Home</Link></header><main id="main" className="auth-simple-main"><section><p className="eyebrow">SECURE ACCESS</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section><aside aria-hidden="true" className="auth-visual"><span>YOUR WORKSPACE</span><strong>Ready when you are.</strong><Image src={asset.src} width={asset.width} height={asset.height} alt="" sizes="260px"/></aside></main><footer className="auth-simple-footer">Your account. One secure workspace.</footer></div>;

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#FFFAF7] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] text-[#111318]">
      <div className="mx-auto w-full max-w-md">
        <header className="flex min-h-14 items-center justify-between">
          <Link href="/sign-in" aria-label="Back to sign in" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline-[#FF6B2B]"><ArrowLeft size={20}/></Link>
          <Link href="/" className="text-xl font-extrabold tracking-tight">TuRn<span className="text-[#FF6B2B]">MaRk</span></Link>
        </header>
        <main id="main" className="mt-14 rounded-[28px] bg-white px-5 py-8 shadow-[0_18px_50px_rgba(80,30,20,.06)] sm:px-8">
          <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-[#73788A]">{description}</p>
          <div className="[&_input]:rounded-xl [&_input]:border-[#D8D9DE] [&_input]:bg-white [&_button.button-primary]:min-h-14 [&_button.button-primary]:w-full [&_button.button-primary]:rounded-2xl [&_button.button-primary]:bg-gradient-to-r [&_button.button-primary]:from-[#FF6B2B] [&_button.button-primary]:to-[#FF4765]">{children}</div>
        </main>
      </div>
    </div>
  );
}
