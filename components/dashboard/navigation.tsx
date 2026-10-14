"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard,ListOrdered,MapPin,ChartNoAxesCombined,CreditCard,Settings2,UsersRound,BookOpen,ClipboardCheck,Download,Building2 } from "lucide-react";
export function DashboardNavigation({role,mode="BUSINESS",institution=false,institutionTeaching=false}:{role:'owner'|'admin'|'staff'|'lecturer'|'student';mode?:'BUSINESS'|'SCHOOL'|'HYBRID';institution?:boolean;institutionTeaching?:boolean}){
 const pathname=usePathname(),manager=role==='owner'||role==='admin',school=mode!=='BUSINESS',teaching=school&&(manager||role==='lecturer'||institutionTeaching);
 const links=[
  {href:'/dashboard',label:'Overview',icon:LayoutDashboard,visible:role!=='student'},
  {href:'/dashboard/units',label:'Units',icon:Building2,visible:institution},
  {href:'/dashboard/services',label:'Services',icon:Building2,visible:institution},
  {href:'/dashboard/people',label:'People',icon:UsersRound,visible:institution},
  {href:'/dashboard/queues',label:'Queues',icon:ListOrdered,visible:role!=='student'},
  {href:'/dashboard/attendance',label:'Attendance',icon:ClipboardCheck,visible:teaching},
  {href:'/dashboard/courses',label:'Courses',icon:BookOpen,visible:teaching&&(mode==='SCHOOL'||institution)},
  {href:school?'/dashboard/students':'/dashboard/customers',label:mode==='SCHOOL'?'Students':mode==='HYBRID'?'People':'Customers',icon:UsersRound,visible:!institution&&(school?teaching:manager)},
  {href:'/dashboard/analytics',label:'Analytics',icon:ChartNoAxesCombined,visible:manager||teaching},
  {href:'/dashboard/locations',label:'Locations',icon:MapPin,visible:manager&&mode!=='SCHOOL'},
  {href:'/dashboard/exports',label:'Exports',icon:Download,visible:teaching},
  {href:'/dashboard/team',label:'Team',icon:UsersRound,visible:manager&&!institution},
  {href:'/dashboard/billing',label:'Billing',icon:CreditCard,visible:role==='owner'&&(mode==='BUSINESS'||institution)},
  {href:'/dashboard/settings',label:'Settings',icon:Settings2,visible:role==='owner'},
 ];
 return <nav aria-label="Business navigation" className="workspace-nav">{links.filter(l=>l.visible).map(l=><Link href={l.href} key={l.href} aria-current={(l.href==='/dashboard'?pathname===l.href:pathname.startsWith(l.href))?'page':undefined}><l.icon size={19}/>{l.label}</Link>)}</nav>
}
