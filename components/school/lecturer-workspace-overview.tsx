import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  QrCode,
  UsersRound,
} from "lucide-react";
import { LiveRefresh } from "@/components/realtime/refresh";
import { PageHeading } from "@/components/ui/workspace";
import { getSchoolSnapshot } from "@/lib/school/data";
import styles from "./education-dashboard.module.css";

type Props = {
  organizationName: string;
  userName?: string | null;
};

export async function LecturerWorkspaceOverview({ organizationName, userName }: Props) {
  const { snapshot } = await getSchoolSnapshot();

  const openSession = snapshot.classes.find((c) => c.status === "OPEN");
  const upcomingClasses = snapshot.classes.filter((c) => c.status === "DRAFT");
  const pastSessions = snapshot.classes.filter((c) => c.status === "COMPLETED");

  return (
    <div className={styles.dashboard}>
      <PageHeading
        eyebrow="LECTURER WORKSPACE"
        title={`Welcome, ${userName || "Instructor"}`}
        description={`Operational teaching and attendance workspace for ${organizationName}.`}
        action={
          snapshot.courses.length > 0 && (
            <Link className="button-primary" href={`/dashboard/courses/${snapshot.courses[0].id}#session-create`}>
              <Plus size={16} aria-hidden="true" /> Start Attendance Session
            </Link>
          )
        }
      />
      <LiveRefresh topic={`school:${snapshot.organization.id}`} authenticated />

      {/* Live Session Alert Banner if attendance is active */}
      {openSession && (
        <section
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff0e8",
            border: "1.5px solid #ff5c1a",
            padding: "18px 24px",
            borderRadius: "16px",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#ff5c1a",
                  display: "inline-block",
                }}
              />
              <strong style={{ fontSize: "15px", color: "#17130f" }}>
                Class Attendance is Live Now
              </strong>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#70665e" }}>
              Students are checking in right now. Display the live QR code or monitor arrivals in realtime.
            </p>
          </div>
          <Link
            className="button-primary"
            href={`/dashboard/attendance/${openSession.id}`}
            style={{ whiteSpace: "nowrap" }}
          >
            <QrCode size={16} /> Open Live Session Controls
          </Link>
        </section>
      )}

      {/* Quick Metrics */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div><BookOpen size={18} /></div>
          <strong>{snapshot.courses.length}</strong>
          <p>Assigned Courses</p>
        </div>
        <div className="stat-card">
          <div><CalendarDays size={18} /></div>
          <strong>{upcomingClasses.length}</strong>
          <p>Upcoming Classes</p>
        </div>
        <div className="stat-card">
          <div><CheckCircle2 size={18} /></div>
          <strong>{pastSessions.length}</strong>
          <p>Completed Sessions</p>
        </div>
        <div className="stat-card">
          <div><UsersRound size={18} /></div>
          <strong>{snapshot.enrollments.length}</strong>
          <p>Enrolled Students</p>
        </div>
      </div>

      {/* Assigned Courses Section */}
      <section>
        <div className="section-toolbar">
          <h2>My Assigned Courses</h2>
          <Link href="/dashboard/courses">View all courses <ArrowRight size={14} /></Link>
        </div>

        {snapshot.courses.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
            {snapshot.courses.map((course) => {
              const rosterCount = snapshot.enrollments.filter((e) => e.course_id === course.id).length;
              return (
                <div
                  key={course.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ffd2bf",
                    borderRadius: "16px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        background: "#fff0e8",
                        color: "#d94b14",
                        fontWeight: 800,
                        fontSize: "12px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        marginBottom: "8px",
                      }}
                    >
                      {course.code}
                    </span>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#17130f" }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: "12px", color: "#70665e", margin: "6px 0 0" }}>
                      <UsersRound size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      {rosterCount} {rosterCount === 1 ? "student" : "students"} registered
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "10px", borderTop: "1px solid #f5ede6" }}>
                    <Link
                      className="button-secondary"
                      href={`/dashboard/courses/${course.id}`}
                      style={{ flex: 1, textAlign: "center", fontSize: "12px", minHeight: "36px", padding: "6px 10px" }}
                    >
                      View Roster
                    </Link>
                    <Link
                      className="button-primary"
                      href={`/dashboard/courses/${course.id}#session-create`}
                      style={{ flex: 1, textAlign: "center", fontSize: "12px", minHeight: "36px", padding: "6px 10px" }}
                    >
                      Start Class
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ marginTop: "12px" }}>
            <GraduationCap size={32} />
            <h3>No courses assigned yet</h3>
            <p>Your department administrator or institution owner will assign courses to your account.</p>
          </div>
        )}
      </section>
    </div>
  );
}
