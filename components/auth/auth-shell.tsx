import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { TURNMARK_ASSETS } from "@/lib/brand/assets";

type AuthVisual = "business" | "student";

export function AuthShell({title,description,children,visual="business"}:{title:string;description:string;children:React.ReactNode;visual?:AuthVisual}){
 const asset=visual==="student"?TURNMARK_ASSETS.characters.student:TURNMARK_ASSETS.characters.businessProfessional;
 return <div className="auth-shell auth-shell-simple"><header className="auth-simple-header"><Brand/><Link href="/"><ArrowLeft size={16}/>Home</Link></header><main id="main" className="auth-simple-main"><section><p className="eyebrow">SECURE ACCESS</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section><aside aria-hidden="true" className="auth-visual"><span>YOUR WORKSPACE</span><strong>Ready when you are.</strong><Image src={asset.src} width={asset.width} height={asset.height} alt="" sizes="260px"/></aside></main><footer className="auth-simple-footer">Your account. One secure workspace.</footer></div>;
}
