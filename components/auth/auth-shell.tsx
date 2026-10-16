import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/ui/brand";
export function AuthShell({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <div className="auth-shell auth-shell-simple"><header className="auth-simple-header"><Brand/><Link href="/"><ArrowLeft size={16}/>Home</Link></header><main id="main" className="auth-simple-main"><section><p className="eyebrow">SECURE ACCESS</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section><aside aria-hidden="true"><span>SCAN</span><strong>JOIN</strong><span>GO</span></aside></main><footer className="auth-simple-footer">Your account. One secure workspace.</footer></div>}
