"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard,ListOrdered,MapPin,ChartNoAxesCombined,CreditCard,Settings2,UsersRound } from "lucide-react";
export function DashboardNavigation({role}:{role:'owner'|'admin'|'staff'}){
 const pathname=usePathname();const links=[{href:'/dashboard',label:'Overview',icon:LayoutDashboard,visible:true},{href:'/dashboard/queues',label:'Queues',icon:ListOrdered,visible:true},{href:'/dashboard/locations',label:'Locations',icon:MapPin,visible:role!=='staff'},{href:'/dashboard/analytics',label:'Analytics',icon:ChartNoAxesCombined,visible:role!=='staff'},{href:'/dashboard/team',label:'Team',icon:UsersRound,visible:role!=='staff'},{href:'/dashboard/billing',label:'Billing',icon:CreditCard,visible:role==='owner'},{href:'/dashboard/settings',label:'Settings',icon:Settings2,visible:role==='owner'}];
 return <nav aria-label="Business navigation" className="workspace-nav">{links.filter(l=>l.visible).map(l=><Link href={l.href} key={l.href} aria-current={(l.href==='/dashboard'?pathname===l.href:pathname.startsWith(l.href))?'page':undefined}><l.icon size={19}/>{l.label}</Link>)}</nav>
}
