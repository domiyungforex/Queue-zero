import Link from "next/link";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { Brand } from "@/components/marketing/site";
export function PageShell({title,children,showAccount=true}:{title:string;children:React.ReactNode;showAccount?:boolean}){return <div className="setup-shell"><header><Brand/>{showAccount&&<nav aria-label="Account"><AuthNavigation/></nav>}</header><main id="main"><div className="setup-heading"><p className="eyebrow">A SMALL STEP TOWARD A CALMER DAY</p><h1>{title}</h1></div>{children}</main><footer>TuRnMaRk · Your place, without the line. <Link href="/">Back home</Link></footer></div>}
