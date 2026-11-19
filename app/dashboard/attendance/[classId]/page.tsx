import Link from "next/link";
import Image from "next/image";
import { getSchoolSnapshot } from "@/lib/school/data";
import { schoolTime, attendanceIsLate } from "@/lib/school/contracts";
import { ClassControls, SchoolForm } from "@/components/school/forms";
import { AttendanceQr } from "@/components/school/attendance-qr";
import { LiveRefresh } from "@/components/realtime/refresh";
import { PageHeading, StatCard } from "@/components/ui/workspace";
import "@/components/school/school.css";

export default async function ClassPage({ params, searchParams }: { params: Promise<{ classId: string }>; searchParams?: Promise<{ q?: string; department?: string }> }) {
  const { classId } = await params;
  const query: { q?: string; department?: string } = searchParams ? await searchParams : {};
  const { snapshot: data } = await getSchoolSnapshot(undefined, classId);
  const session = data.classes.find(item => item.id === classId)!;
  const course = data.courses.find(item => item.id === session.course_id)!;
  const records = data.attendance.filter(row => row.class_session_id === classId);
  const roster = data.enrollments
    .filter(row => row.course_id === course.id)
    .map(row => data.students.find(student => student.id === row.student_id))
    .filter((student): student is NonNullable<typeof student> => student !== undefined);
  const flags = data.flags.filter(flag => flag.class_session_id === classId);
  const unresolved = flags.filter(flag => !flag.resolved_at);
  const isStandard = session.verification_mode === "STANDARD";

  // For standard mode, build rows from attendance records directly
  const standardRows = records.map(record => {
    const displayName = record.submitted_name ?? data.students.find(s => s.id === record.student_id)?.full_name ?? "—";
    const displayMatric = record.submitted_matric_number ?? data.students.find(s => s.id === record.student_id)?.matric_number ?? "—";
    const flagged = unresolved.some(flag => flag.student_id === record.student_id);
    return { record, displayName, displayMatric, flagged };
  });

  const search = query.q?.trim().toLocaleLowerCase() ?? "";
  const departmentFilter = query.department ?? "";
  const departmentName = (departmentId?: string) => data.departments.find((department) => department.id === departmentId)?.name ?? "—";
  const visible = (name: string, matric: string, departmentId?: string) => (!search || `${name} ${matric}`.toLocaleLowerCase().includes(search)) && (!departmentFilter || departmentId === departmentFilter);
  const visibleStandard = standardRows.filter((row) => {
    const student = data.students.find((item) => item.id === row.record.student_id);
    return visible(row.displayName, row.displayMatric, student?.department_id);
  });
  const present = records.filter(row => row.check_in_at).length;
  const percentLabel = isStandard
    ? null
    : roster.length > 0
      ? `${((present / roster.length) * 100).toFixed(0)}%`
      : null;

  return (
    <>
      <PageHeading
        eyebrow={course.code}
        title={
          session.status === "OPEN"
            ? "Attendance live"
            : session.status === "COMPLETED"
              ? "Class register"
              : "Ready for class"
        }
        description={`${course.title}${session.title ? ` · ${session.title}` : ""} · ${schoolTime(session.starts_at)}`}
        action={
          <Link className="button-secondary" href={`/dashboard/courses/${course.id}`}>
            Back to course
          </Link>
        }
      />
      <LiveRefresh topic={`class:${classId}`} authenticated />

      <div className="school-grid">
        <StatCard label="Present" value={present} />
        <StatCard label="Late" value={records.filter(row => attendanceIsLate(row, data.classes)).length} />
        {isStandard ? (
          <StatCard label="Submissions" value={records.length} />
        ) : (
          <StatCard label="Not checked in" value={Math.max(0, roster.length - present)} />
        )}
        <StatCard label="Flags to review" value={unresolved.length} />
      </div>

      {percentLabel && (
        <p className="my-4 text-muted">
          Attendance rate: <strong>{percentLabel}</strong> ({present} of {roster.length} enrolled).
        </p>
      )}

      {session.status === "OPEN" && session.arrival_open && (
        <AttendanceQr
          classId={classId}
          courseCode={course.code}
          sessionTitle={session.title ?? undefined}
        />
      )}

      <p className="my-4 text-muted">
        Attendance {session.arrival_open ? "open" : "closed"}. Verification mode:{" "}
        <strong>{session.verification_mode}</strong>.{" "}
        {isStandard
          ? "Students can submit without a preloaded CSV roster."
          : "Students must match the imported course roster."}{" "}
        No student account is required.
      </p>

      {session.planned_ends_at && (
        <p className="my-4 text-muted">Planned class end: {schoolTime(session.planned_ends_at)}.</p>
      )}

      <ClassControls session={session} />

      <h2 className="school-subheading">Student register</h2>
      <form className="school-actions" role="search">
        <label>Name or matric<input name="q" defaultValue={query.q ?? ""} placeholder="Search" /></label>
        <label>Department<select name="department" defaultValue={departmentFilter}><option value="">All departments</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <button className="button-secondary" type="submit">Filter</button>
      </form>

      {isStandard ? (
        // STANDARD MODE: show all attendance submissions
        visibleStandard.length === 0 ? (
          <p>No students have checked in yet. Students register by scanning the QR code.</p>
        ) : (
          <div className="school-table-wrap">
            <table className="school-table">
              <caption>Attendance submissions · timestamps in UTC</caption>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Matric</th>
                  <th>Arrival</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {visibleStandard.map(({ record, displayName, displayMatric, flagged }) => (
                  <tr key={record.id}>
                    <td>
                      {record.photo_url ? (
                        <Image
                          src={record.photo_url}
                          alt={`Selfie for ${displayName}`}
                          width={40}
                          height={40}
                          unoptimized
                          style={{ borderRadius: "50%", objectFit: "cover", width: 40, height: 40 }}
                        />
                      ) : (
                        <span style={{ color: "#aaa", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <th>{displayName}</th>
                    <td>{departmentName(data.students.find((student) => student.id === record.student_id)?.department_id)}</td>
                    <td>{displayMatric}</td>
                    <td>{schoolTime(record.check_in_at)}</td>
                    <td>{record.status.replaceAll("_", " ")}</td>
                    <td>
                      {record.location_verified
                        ? "✓ Verified"
                        : record.location_lat != null
                          ? "Captured"
                          : "—"}
                    </td>
                    <td>{flagged ? "Needs review" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        // VERIFIED MODE: roster-based view
        !roster.length ? (
          <p>
            No students have been added to this class yet. Import the official course roster before
            opening a verified class.
          </p>
        ) : (
          <div className="school-table-wrap">
            <table className="school-table">
              <caption>Authoritative class records · timestamps in UTC</caption>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Matric</th>
                  <th>Arrival</th>
                  <th>Status</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {roster.filter((student) => visible(student.full_name, student.matric_number, student.department_id)).map(student => {
                  const row = records.find(r => r.student_id === student.id);
                  const flagged = unresolved.some(flag => flag.student_id === student.id);
                  return (
                    <tr key={student.id}>
                      <td>
                        {row?.photo_url ? (
                          <Image
                            src={row.photo_url}
                            alt={`Selfie for ${student.full_name}`}
                            width={40}
                            height={40}
                            unoptimized
                            style={{ borderRadius: "50%", objectFit: "cover", width: 40, height: 40 }}
                          />
                        ) : (
                          <span style={{ color: "#aaa", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <th>{student.full_name}</th>
                      <td>{departmentName(student.department_id)}</td>
                      <td>{student.matric_number}</td>
                      <td>{schoolTime(row?.check_in_at ?? null)}</td>
                      <td>{row?.status.replaceAll("_", " ") ?? "NOT PRESENT"}</td>
                      <td>
                        {flagged
                          ? "Needs review"
                          : row?.check_in_at
                            ? `Roster matched${row.location_verified ? " · Location ✓" : ""}`
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <h2 id="review-flags" className="school-subheading">Review flags</h2>
      <p className="text-sm text-muted">
        Risk signals require human review. A shared device does not automatically prove proxy
        attendance.
      </p>
      {flags.length ? (
        flags.map(flag => (
          <article className="school-signal" key={flag.id}>
            <strong>
              {data.students.find(student => student.id === flag.student_id)?.full_name ??
                "Student"}
            </strong>
            <p>
              {flag.reason.replaceAll("_", " ")} · {schoolTime(flag.created_at)}
            </p>
            {flag.resolved_at ? (
              <p>Reviewed: {flag.resolution}</p>
            ) : (
              <SchoolForm action="resolve_flag" submit="Record review" fields={{ flag_id: flag.id }}>
                <label>
                  Review outcome
                  <textarea name="resolution" minLength={5} maxLength={500} required rows={2} />
                </label>
              </SchoolForm>
            )}
          </article>
        ))
      ) : (
        <p className="my-4 text-muted">No suspicious submissions recorded.</p>
      )}

      {session.status === "COMPLETED" && (
        <>
          <h2 className="school-subheading">Export official register</h2>
          <div className="school-actions">
            {(["pdf", "csv", "xlsx"] as const).map(format => (
              <a
                className="button-secondary"
                key={format}
                href={`/api/school/classes/${classId}/export?format=${format}`}
              >
                Download {format.toUpperCase()}
              </a>
            ))}
          </div>
          {isStandard && (
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              Standard mode export includes all checked-in students. Upload a course roster on the
              course page to enable full roster comparison reports.
            </p>
          )}
        </>
      )}
    </>
  );
}
