import {
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LogOut,
  Search,
  ShieldCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LiveRefresh } from "@/components/realtime/refresh";
import {
  EducationEmpty,
  EducationHeading,
  EducationMetric,
  EducationStatus,
  formatTime,
  initials,
} from "@/components/school/education-ui";
import { AttendanceLocation } from "@/components/school/attendance-location";
import styles from "@/components/school/education-pages.module.css";
import { getSchoolSnapshot } from "@/lib/school/data";
import { attendancePhotoSrc } from "@/lib/school/photo-src";

const attended = new Set(["PRESENT", "LATE", "EARLY_LEAVE", "INCOMPLETE", "FLAGGED"]);
const percent = (count: number, total: number) =>
  total ? `${Math.round((count / total) * 100)}%` : "—";
const statusTone = (status: string) =>
  status === "PRESENT"
    ? ("success" as const)
    : status === "ABSENT"
      ? ("danger" as const)
      : status === "LATE"
        ? ("warning" as const)
        : ("info" as const);

function reportingCutoff(days: number) {
  return Date.now() - days * 86_400_000;
}

const PAGE_SIZE = 15;

export default async function AttendancePage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{
    course?: string;
    session?: string;
    period?: string;
    mode?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
} = {}) {
  const [{ snapshot: data }, query] = await Promise.all([getSchoolSnapshot(), searchParams]);

  const days = query.period === "30" ? 30 : query.period === "all" ? null : 7;
  const cutoff = days ? reportingCutoff(days) : null;

  // Filter sessions by course, session ID, and cutoff date
  const sessions = data.classes.filter(
    (session) =>
      (!query.course || session.course_id === query.course) &&
      (!query.session || session.id === query.session) &&
      (!cutoff || !session.starts_at || Date.parse(session.starts_at) >= cutoff)
  );
  const sessionIds = new Set(sessions.map((session) => session.id));

  // Analytics: Only calculate percentages against authoritative population (Verified classes)
  const verifiedCompletedSessions = sessions.filter(
    (session) => session.status === "COMPLETED" && session.verification_mode === "VERIFIED"
  );
  const verifiedIds = new Set(verifiedCompletedSessions.map((session) => session.id));
  const finalized = data.attendance.filter((record) => verifiedIds.has(record.class_session_id));
  const totalVerified = finalized.length;
  const presentVerified = finalized.filter((record) => attended.has(record.status)).length;
  const lateVerified = finalized.filter((record) => record.status === "LATE").length;
  const absentVerified = finalized.filter((record) => record.status === "ABSENT").length;
  const earlyVerified = finalized.filter((record) => record.status === "EARLY_LEAVE").length;

  // Total raw attendance submissions in selected scope (works for both modes)
  const totalSubmissionsInScope = data.attendance.filter((record) =>
    sessionIds.has(record.class_session_id)
  ).length;

  // Filter records by search query, verification mode, and attendance status
  const searchFilter = (query.search ?? "").trim().toLowerCase();
  const allFilteredRecords = data.attendance
    .filter((record) => sessionIds.has(record.class_session_id))
    .filter((record) => {
      // Filter by verification mode
      if (query.mode === "STANDARD" && record.verification_mode !== "STANDARD") return false;
      if (query.mode === "VERIFIED" && record.verification_mode !== "VERIFIED") return false;

      // Filter by attendance status
      if (query.status && query.status !== "ALL" && record.status !== query.status) return false;

      // Filter by search (name or matric)
      if (searchFilter) {
        const student = data.students.find((s) => s.id === record.student_id);
        const name = (record.submitted_name ?? student?.full_name ?? "").toLowerCase();
        const matric = (record.submitted_matric_number ?? student?.matric_number ?? "").toLowerCase();
        if (!name.includes(searchFilter) && !matric.includes(searchFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.check_in_at ?? "").localeCompare(a.check_in_at ?? ""));

  // Pagination
  const totalCount = allFilteredRecords.length;
  const currentPage = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRecords = allFilteredRecords.slice(startIndex, startIndex + PAGE_SIZE);

  // Trend for analytics
  const trend = sessions
    .filter((session) => session.status === "COMPLETED")
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
    .slice(-7)
    .map((session) => {
      const records = data.attendance.filter((record) => record.class_session_id === session.id);
      const value =
        session.verification_mode === "VERIFIED" && records.length
          ? Math.round((records.filter((r) => attended.has(r.status)).length / records.length) * 100)
          : null;
      return {
        id: session.id,
        value,
        label: session.starts_at
          ? new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
              new Date(session.starts_at)
            )
          : "Class",
      };
    });

  // Course breakdown
  const breakdown = data.courses
    .map((course) => {
      const ids = new Set(
        sessions
          .filter(
            (session) =>
              session.course_id === course.id &&
              session.status === "COMPLETED" &&
              session.verification_mode === "VERIFIED"
          )
          .map((session) => session.id)
      );
      const records = data.attendance.filter((record) => ids.has(record.class_session_id));
      return {
        course,
        rate: records.length
          ? Math.round((records.filter((r) => attended.has(r.status)).length / records.length) * 100)
          : null,
      };
    })
    .filter((item) => item.rate !== null);

  const actionable =
    sessions.find((session) => session.status === "OPEN") ??
    sessions.find((session) => session.status === "DRAFT");

  // Helper to build URL query preserving filters
  const buildPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams();
    if (query.course) params.set("course", query.course);
    if (query.session) params.set("session", query.session);
    if (query.period) params.set("period", query.period);
    if (query.mode) params.set("mode", query.mode);
    if (query.status) params.set("status", query.status);
    if (query.search) params.set("search", query.search);
    params.set("page", String(pageNumber));
    return `/dashboard/attendance?${params.toString()}`;
  };

  return (
    <main className={styles.page}>
      <EducationHeading
        eyebrow="ATTENDANCE"
        title="Attendance records"
        description="Search, filter, and monitor student attendance across courses and sessions in real time."
        action={
          actionable ? (
            <Link className={styles.primary} href={`/dashboard/attendance/${actionable.id}`}>
              <ClipboardCheck size={18} aria-hidden="true" />
              Take attendance
            </Link>
          ) : undefined
        }
      />
      <LiveRefresh topic={`school:${data.organization.id}`} authenticated />

      {/* Search and Filters Toolbar */}
      <form className={styles.toolbar} method="get" action="/dashboard/attendance">
        <label className={styles.search} style={{ gridColumn: "1 / -1" }}>
          <Search size={16} aria-hidden="true" />
          <input
            name="search"
            placeholder="Search by student name or matriculation number…"
            defaultValue={query.search ?? ""}
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", width: "100%", gridColumn: "1 / -1" }}>
          <label className={styles.search} style={{ flex: "1 1 180px", minHeight: "44px" }}>
            <span className="sr-only">Course</span>
            <select name="course" defaultValue={query.course ?? ""}>
              <option value="">All courses</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.search} style={{ flex: "1 1 180px", minHeight: "44px" }}>
            <span className="sr-only">Session</span>
            <select name="session" defaultValue={query.session ?? ""}>
              <option value="">All sessions</option>
              {data.classes.map((cls) => {
                const c = data.courses.find((item) => item.id === cls.course_id);
                return (
                  <option key={cls.id} value={cls.id}>
                    {c ? `${c.code} · ` : ""}
                    {cls.title ? `${cls.title} · ` : ""}
                    {cls.starts_at?.slice(0, 10) ?? "Session"} ({cls.status})
                  </option>
                );
              })}
            </select>
          </label>

          <label className={styles.search} style={{ flex: "1 1 140px", minHeight: "44px" }}>
            <span className="sr-only">Time period</span>
            <select name="period" defaultValue={query.period ?? "7"}>
              <option value="7">This week</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </label>

          <label className={styles.search} style={{ flex: "1 1 140px", minHeight: "44px" }}>
            <span className="sr-only">Verification Mode</span>
            <select name="mode" defaultValue={query.mode ?? ""}>
              <option value="">All modes</option>
              <option value="STANDARD">Standard</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </label>

          <label className={styles.search} style={{ flex: "1 1 140px", minHeight: "44px" }}>
            <span className="sr-only">Status</span>
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">All statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="EARLY_LEAVE">Early leave</option>
            </select>
          </label>

          <button className={styles.secondary} type="submit" style={{ minHeight: "44px", padding: "0 18px" }}>
            Apply filters
          </button>
        </div>
      </form>

      {/* Analytics Summary */}
      <section className={styles.metrics} aria-label="Attendance summary">
        <EducationMetric
          icon={CheckCircle2}
          value={totalVerified ? percent(presentVerified, totalVerified) : `${totalSubmissionsInScope}`}
          label={totalVerified ? "Attendance rate (verified)" : "Total submissions"}
          color="#18a66c"
          soft="#e6f8ef"
        />
        <EducationMetric
          icon={Clock3}
          value={totalVerified ? percent(lateVerified, totalVerified) : "—"}
          label="Late rate"
          color="#f29a20"
          soft="#fff4df"
        />
        <EducationMetric
          icon={UserX}
          value={totalVerified ? percent(absentVerified, totalVerified) : "—"}
          label={totalVerified ? "Absence rate (roster)" : "Absentees (requires roster)"}
          color="#ff4765"
          soft="#ffeaf0"
        />
        <EducationMetric
          icon={LogOut}
          value={totalVerified ? percent(earlyVerified, totalVerified) : "—"}
          label="Early departures"
          color="#7c3aed"
          soft="#f0e9ff"
        />
      </section>

      {/* Trend & Breakdown Panels */}
      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2>Attendance trend</h2>
              <p>Verified sessions only; Standard mode has no assumed denominator</p>
            </div>
          </header>
          {trend.some((item) => item.value !== null) ? (
            <div className={styles.chart} aria-label="Attendance trend chart">
              {trend.map((item) => (
                <div className={styles.chartItem} key={item.id}>
                  <strong>{item.value === null ? "—" : `${item.value}%`}</strong>
                  <i className={styles.chartBar} style={{ height: `${item.value ?? 2}%` }} />
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          ) : (
            <EducationEmpty
              title="No finalized attendance yet"
              description="Finish your first class to see attendance insights."
              icon={CalendarCheck}
            />
          )}
        </div>

        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2>Class breakdown</h2>
              <p>Verified attendance rate</p>
            </div>
          </header>
          {breakdown.length ? (
            <ul className={`${styles.breakdown} ${styles.panelBody}`}>
              {breakdown.map(({ course, rate }) => (
                <li key={course.id}>
                  <strong>{course.code}</strong>
                  <span>{rate}%</span>
                  <span className={styles.progress}>
                    <i style={{ width: `${rate}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EducationEmpty
              title="No class breakdown"
              description="Completed class records will appear here."
            />
          )}
        </div>
      </section>

      {/* Attendance Records List with Photos, Verification Info & Pagination */}
      <section className={styles.panel} aria-label="Attendance records table">
        <header className={styles.panelHeader}>
          <div>
            <h2>Attendance records</h2>
            <p>
              Showing {paginatedRecords.length} of {totalCount} submissions
              {searchFilter ? ` matching "${searchFilter}"` : ""}
            </p>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#858894" }}>
                Page {currentPage} of {totalPages}
              </span>
              {currentPage > 1 ? (
                <Link
                  href={buildPageUrl(currentPage - 1)}
                  className={styles.secondary}
                  style={{ minHeight: "32px", padding: "0 10px", borderRadius: "8px" }}
                >
                  <ChevronLeft size={14} /> Prev
                </Link>
              ) : null}
              {currentPage < totalPages ? (
                <Link
                  href={buildPageUrl(currentPage + 1)}
                  className={styles.secondary}
                  style={{ minHeight: "32px", padding: "0 10px", borderRadius: "8px" }}
                >
                  Next <ChevronRight size={14} />
                </Link>
              ) : null}
            </div>
          )}
        </header>

        {paginatedRecords.length ? (
          <ul className={styles.rows}>
            {paginatedRecords.map((record) => {
              const student = data.students.find((item) => item.id === record.student_id);
              const session = data.classes.find((item) => item.id === record.class_session_id);
              const course = data.courses.find((item) => item.id === session?.course_id);

              const displayName =
                record.submitted_name ?? student?.full_name ?? "Student";
              const displayMatric =
                record.submitted_matric_number ?? student?.matric_number ?? "—";

              return (
                <li key={record.id} style={{ gridTemplateColumns: "44px minmax(0, 1fr) auto 18px" }}>
                  {attendancePhotoSrc(record.photo_url) ? (
                    <Image
                      src={attendancePhotoSrc(record.photo_url)!}
                      alt={`Photo for ${displayName}`}
                      width={40}
                      height={40}
                      unoptimized
                      style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                        width: 40,
                        height: 40,
                        border: "2px solid #e8f8ef",
                      }}
                    />
                  ) : (
                    <span className={styles.avatar}>{initials(displayName)}</span>
                  )}

                  <Link className={styles.rowLink} href={`/dashboard/attendance/${record.class_session_id}`}>
                    <strong style={{ fontSize: "13px" }}>{displayName}</strong>
                    <span style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "3px" }}>
                      <span style={{ fontWeight: 600 }}>{displayMatric}</span>
                      <span>·</span>
                      <span>{course?.code ?? "Class"}</span>
                      {session?.title ? (
                        <>
                          <span>·</span>
                          <span>{session.title}</span>
                        </>
                      ) : null}
                      {record.verification_mode === "VERIFIED" ? (
                        <span style={{ color: "#15945f", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <ShieldCheck size={12} /> Roster
                        </span>
                      ) : (
                        <span style={{ color: "#6d36d3" }}>Standard</span>
                      )}
                      <AttendanceLocation record={record} />
                    </span>
                  </Link>

                  <span className={styles.rowEnd}>
                    <EducationStatus tone={statusTone(record.status)}>
                      {record.status.replaceAll("_", " ")}
                    </EducationStatus>
                    <small>{formatTime(record.check_in_at)}</small>
                  </span>

                  <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        ) : (
          <EducationEmpty
            title="No attendance records found"
            description={
              searchFilter || query.course || query.mode || query.status
                ? "Try adjusting your search query or filters to find records."
                : "Verified arrivals will appear here after a class begins."
            }
            icon={CalendarCheck}
          />
        )}
      </section>
    </main>
  );
}
