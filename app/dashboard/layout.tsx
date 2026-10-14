import { getInstitutionSnapshot } from "@/lib/institution/data";
import Link from "next/link";
import { LiveRefresh } from "@/components/realtime/refresh";
import { ArrowUpRight,LifeBuoy,Leaf } from "lucide-react";
import { getMemberships,requireBusinessMembership } from "@/lib/business/membership";
import { AuthNavigation } from "@/components/auth/auth-navigation";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { BusinessSelector } from "@/components/dashboard/business-selector";
import { Brand } from "@/components/marketing/site";
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const m=await requireBusinessMembership(),memberships=await getMemberships();
 const institution=m.institutionType?await getInstitutionSnapshot():null;
 const institutionTeaching=Boolean(institution?.snapshot.units.some(unit=>unit.permissions.some(permission=>permission.startsWith('course.')||permission.startsWith('attendance.'))));
 return <div data-dashboard-shell className="workspace"><aside data-dashboard-sidebar className="workspace-sidebar"><Brand/><p className="nav-caption">WORKSPACE</p><DashboardNavigation role={m.role} mode={m.organizationMode} institution={Boolean(m.institutionType)} institutionTeaching={institutionTeaching}/><div className="sidebar-bottom"><div className="sidebar-note"><Leaf size={22}/><strong>Good service starts here.</strong><p>Give your customers a little more time for their day.</p></div><Link href="/how-it-works" className="sidebar-help"><LifeBuoy size={17}/>How TuRnMaRk works<ArrowUpRight size={15}/></Link></div></aside><div className="workspace-body"><header data-dashboard-header className="workspace-header"><div><p>{m.businessName}</p><span>{m.role} workspace</span><LiveRefresh key={m.businessId} topic={`business:${m.businessId}`} authenticated/></div><BusinessSelector key={m.businessId} businessId={m.businessId} memberships={memberships}/><AuthNavigation/></header><main id="main" className="workspace-main">{children}</main><footer className="workspace-footer"><span>TuRnMaRk · A calmer way to serve.</span><span>Your business. Your pace.</span></footer></div></div>
}
