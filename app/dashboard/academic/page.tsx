import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers,
  Plus,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { getAcademicOverview } from "@/lib/academic/data";
import { PageHeading, StatCard } from "@/components/ui/workspace";

export default async function AcademicOverviewPage() {
  const { membership, stats, assignments } = await getAcademicOverview();

  const modules = [
    {
      href: "/dashboard/academic/assignments",
      title: "Assignments",
      description: "Create, publish, and manage homework, practicals, essays, and assessments.",
      icon: BookOpen,
      badge: `${stats.totalAssignments} total`,
    },
    {
      href: "/dashboard/academic/gradebook",
      title: "Gradebook & Results",
      description: "Review CA, exam scores, letter grades, audit trails, and export CSV results.",
      icon: FileText,
      badge: "Course results",
    },
    {
      href: "/dashboard/academic/integrity",
      title: "Academic Integrity",
      description: "Evidence-based similarity comparisons and explainable AI-writing risk reviews.",
      icon: ShieldAlert,
      badge: `${stats.pendingIntegrityReviews} pending`,
    },
    {
      href: "/dashboard/academic/question-bank",
      title: "Question Bank",
      description: "Reusable objective, mathematical, and essay questions organized by topic.",
      icon: Layers,
      badge: "Reusable items",
    },
    {
      href: "/dashboard/academic/earnings",
      title: "Lecturer Earnings",
      description: "Track paid submission revenue, commission allocations, and withdrawal balance.",
      icon: BookOpen,
      badge: "Revenue ledger",
    },
    {
      href: "/dashboard/academic/referrals",
      title: "Referral Programme",
      description: "Share referral links and track 10% commission payouts on qualifying submissions.",
      icon: UsersRound,
      badge: "10% commission",
    },
    {
      href: "/dashboard/courses",
      title: "Courses & Classes",
      description: "Manage course rosters, lecturers, and class sessions.",
      icon: GraduationCap,
      badge: `${stats.totalCourses} courses`,
    },
    {
      href: "/dashboard/students",
      title: "Students",
      description: "Shared institutional student profiles, matriculation numbers, and levels.",
      icon: UsersRound,
      badge: `${stats.totalStudents} students`,
    },
    {
      href: "/dashboard/attendance",
      title: "Attendance",
      description: "Live rotating QR attendance, geofence checks, and verified registers.",
      icon: ClipboardCheck,
      badge: "Live registers",
    },
  ];

  return (
    <main className="space-y-8">
      <PageHeading
        eyebrow="ACADEMIC MANAGEMENT"
        title="Academic CMS & Assessment"
        description={`Centralized academic operations for ${membership.businessName}.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/academic/student" className="button-secondary">
              Student Portal
            </Link>
            <Link href="/dashboard/academic/assignments/new" className="button-primary">
              <Plus size={16} aria-hidden="true" />
              Create Assignment
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Academic metrics">
        <StatCard label="Published Assignments" value={stats.publishedAssignments} />
        <StatCard label="Total Submissions" value={stats.totalSubmissions} />
        <StatCard label="Awaiting Marking" value={stats.awaitingMarking} />
        <StatCard label="Integrity Reviews" value={stats.pendingIntegrityReviews} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Academic modules">
        {modules.map(({ href, title, description, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="panel flex flex-col justify-between p-6 transition hover:border-[#ff6b2b]"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0e8] text-[#ff6b2b]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {badge}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold text-[#111318]">{title}</h2>
              <p className="mt-1.5 text-sm text-neutral-600">{description}</p>
            </div>
            <span className="mt-4 text-xs font-bold text-[#ff6b2b]">Open module →</span>
          </Link>
        ))}
      </section>

      {assignments.length > 0 ? (
        <section className="panel p-6" aria-labelledby="recent-assignments-title">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-assignments-title" className="text-lg font-bold text-[#111318]">
              Recent Assignments
            </h2>
            <Link href="/dashboard/academic/assignments" className="text-sm font-semibold text-[#ff6b2b] hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Submissions</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.slice(0, 5).map((a) => (
                  <tr key={a.id} className="border-b border-black/5">
                    <td className="py-3 pr-4 font-semibold text-[#111318]">{a.title}</td>
                    <td className="py-3 pr-4 text-neutral-600">{a.course_code}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold">
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{a.submission_count ?? 0}</td>
                    <td className="py-3">
                      <Link
                        href={`/dashboard/academic/assignments/${a.id}`}
                        className="font-semibold text-[#ff6b2b] hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
