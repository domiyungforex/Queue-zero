import { Brand } from "@/components/ui/brand";
import { ShieldCheck } from "lucide-react";
export function PublicQueueShell({children}:{children:React.ReactNode}){return <div className="customer-shell"><header><Brand/><span><ShieldCheck size={14}/>No account needed.</span></header><main id="main">{children}</main><footer><span className="customer-flower" aria-hidden="true">✳</span><p>Your place, without the line.</p><small>Powered by TuRnMaRk</small></footer></div>}
