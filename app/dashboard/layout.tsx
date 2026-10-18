import { getInstitutionSnapshot } from "@/lib/institution/data";
import { getMemberships,requireBusinessMembership } from "@/lib/business/membership";
import { WorkspaceDashboardShell } from "@/components/dashboard/workspace-dashboard-shell";
export default async function DashboardLayout({children}:{children:React.ReactNode}){
 const m=await requireBusinessMembership();
 const [memberships,institution]=await Promise.all([getMemberships(),m.institutionType?getInstitutionSnapshot():Promise.resolve(null)]);
 const institutionTeaching=Boolean(institution?.snapshot.units.some(unit=>unit.permissions.some(permission=>permission.startsWith('course.')||permission.startsWith('attendance.'))));
 const institutionStaffManagement=Boolean(institution?.snapshot.units.some(unit=>unit.permissions.includes('unit.staff.manage')));
 return <WorkspaceDashboardShell membership={m} memberships={memberships} institutionTeaching={institutionTeaching} institutionStaffManagement={institutionStaffManagement}>{children}</WorkspaceDashboardShell>
}
