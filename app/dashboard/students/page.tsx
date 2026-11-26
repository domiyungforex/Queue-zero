import { LiveRefresh } from "@/components/realtime/refresh";
import { StudentManagementWorkspace } from "@/components/school/student-management-workspace";
import { getSchoolSnapshot } from "@/lib/school/data";
import { getEnrichedStudents } from "@/lib/school/student-details";

export default async function StudentsPage() {
  const { snapshot, canManage } = await getSchoolSnapshot();
  const students = await getEnrichedStudents(snapshot);

  return (
    <>
      <LiveRefresh topic={`school:${snapshot.organization.id}`} authenticated />
      <StudentManagementWorkspace
        snapshot={snapshot}
        students={students}
        canManage={canManage}
      />
    </>
  );
}
