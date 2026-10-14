import { InstitutionOverview } from "@/components/institution/overview";
import { ProfessionalOverview } from "@/components/professional/overview";
import { SchoolOverview } from "@/components/school/overview";
import Link from "next/link";
import { ArrowUpRight,Plus,Users,CheckCheck,Clock3,UserRound } from "lucide-react";
import { requireBusinessMembership } from "@/lib/business/membership";
import { getDashboardQueues } from "@/lib/dashboard/data";
import { getBusinessMetrics } from "@/lib/queue/console";
import { QueueSummary } from "@/components/dashboard/queue-summary";
import { PageHeading,StatCard,duration } from "@/components/ui/workspace";
type DashboardPageProps = { searchParams?: Promise<{ onboarding?: string | string[] }> };

export default async function Page({ searchParams }: DashboardPageProps = {}){
 const m=await requireBusinessMembership();
 const query = await searchParams;
 const onboardingComplete = query?.onboarding === "complete" && Boolean(m.onboardingCompletedAt);
 const success = onboardingComplete ? <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">Your workspace is ready.</div> : null;
 if(m.role==='student')return <>{success}<PageHeading eyebrow="YOUR WORKSPACE" title={m.businessName} description="Use the workspace switcher above to move between organizations you belong to."/></>;
 if(m.institutionType)return <>{success}<InstitutionOverview/></>;
 if(m.workspaceOwnership==='INDIVIDUAL'&&m.professionalCategory&&m.professionalCategory!=='LECTURER_TEACHER')return <>{success}<ProfessionalOverview category={m.professionalCategory} canManage={m.role==='owner'||m.role==='admin'}/></>;
 if((m.organizationMode==='SCHOOL'||m.organizationMode==='HYBRID')&&m.role!=='staff')return <>{success}<SchoolOverview individual={m.workspaceOwnership==='INDIVIDUAL'}/></>;
 const [queues,metrics]=await Promise.all([getDashboardQueues(),getBusinessMetrics()]);
 return <>{success}<PageHeading eyebrow="LET’S MAKE TODAY FLOW" title="Your day, at a glance." description="A little less queue chaos. A little more personal service." action={(m.role==='owner'||m.role==='admin')&&<Link className="button-primary" href="/dashboard/queues/new"><Plus size={18}/>Create queue</Link>}/><div className="overview-banner"><div><span className="status-dot"/><strong>{queues.filter(q=>q.status==='open').length} open {queues.filter(q=>q.status==='open').length===1?'queue':'queues'}</strong><span>Ready to welcome your customers.</span></div></div><div className="metrics-grid"><StatCard label="Waiting now" value={metrics.waiting} icon={<Users size={20}/>} note="Across your accessible queues"/><StatCard label="Serving now" value={metrics.serving} icon={<UserRound size={20}/>} note="One person at a time"/><StatCard label="Served today" value={metrics.completed_today} icon={<CheckCheck size={20}/>} note="Completed customer visits"/><StatCard label="Average wait" value={duration(metrics.average_wait_seconds)} icon={<Clock3 size={20}/>} note="Last 7 days · until called"/></div><div className="section-toolbar"><h2>Your queues</h2><Link href="/dashboard/queues">View all<ArrowUpRight size={16}/></Link></div><QueueSummary queues={queues} staff={m.role==='staff'}/><section className="workspace-tip"><span className="tip-symbol">✳</span><div><h2>One small QR. A better waiting experience.</h2><p>Print a queue QR code and place it where customers arrive. Their first scan is all it takes.</p></div><Link href="/dashboard/queues" className="button-secondary">Get a queue QR<ArrowUpRight size={17}/></Link></section></>
}
