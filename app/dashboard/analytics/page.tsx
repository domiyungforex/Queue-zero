import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusinessMembership, requireBusinessManager } from "@/lib/business/membership";
import { getBusinessMetrics } from "@/lib/queue/console";
import { PageHeading } from "@/components/ui/workspace";
import { AnalyticsView } from "@/components/dashboard/analytics-view";
import { SchoolAnalytics } from "@/components/school/overview";
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{days?:string}>}){
 const m=await requireBusinessMembership();if(m.role==='student')redirect('/attend');
 if((m.organizationMode==='SCHOOL'&&m.role!=='staff')||(m.organizationMode==='HYBRID'&&m.role==='lecturer'))return <SchoolAnalytics/>;
 await requireBusinessManager();const days=(await searchParams).days==='30'?30:7;const metrics=await getBusinessMetrics(days);
 return <>{m.organizationMode==='HYBRID'&&<SchoolAnalytics/>}<PageHeading title="See the rhythm of your day." eyebrow="QUEUE ANALYTICS" description="Real arrivals, real waiting times, and clearer decisions." action={<div className="segmented"><Link aria-current={days===7?'page':undefined} href="?days=7">7 days</Link><Link aria-current={days===30?'page':undefined} href="?days=30">30 days</Link></div>}/><AnalyticsView metrics={metrics}/></>;
}
