import { currentUser } from "@clerk/nextjs/server";
import { getInstitutionSnapshot } from "@/lib/institution/data";
import { getMemberships,requireBusinessMembership } from "@/lib/business/membership";
import { WorkspaceDashboardShell } from "@/components/dashboard/workspace-dashboard-shell";
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const m=await requireBusinessMembership();
 const [memberships,institution,identity]=await Promise.all([getMemberships(),m.institutionType?getInstitutionSnapshot():Promise.resolve(null),currentUser().catch(()=>null)]);
 const institutionTeaching=Boolean(institution?.snapshot.units.some(unit=>unit.permissions.some(permission=>permission.startsWith('course.')||permission.startsWith('attendance.'))));
 const institutionStaffManagement=Boolean(institution?.snapshot.units.some(unit=>unit.permissions.includes('unit.staff.manage')));
 return <WorkspaceDashboardShell membership={m} memberships={memberships} institutionTeaching={institutionTeaching} institutionStaffManagement={institutionStaffManagement} userName={identity?.fullName??identity?.primaryEmailAddress?.emailAddress??null} userImageUrl={identity?.imageUrl??null}>{children}</WorkspaceDashboardShell>
}
