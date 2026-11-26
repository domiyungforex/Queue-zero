"use client";

import { deleteCourse } from "@/lib/school/actions";
import { DeleteConfirmButton } from "./delete-confirm-button";

export function CourseDeleteBar({ courseId, courseCode }: { courseId: string; courseCode: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginTop: "24px",
        padding: "18px 20px",
        borderRadius: "16px",
        border: "1px solid #fee2e2",
        background: "#fffafa",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: "14px", color: "#111318" }}>
          Delete course {courseCode}
        </strong>
        <span style={{ fontSize: "12.5px", color: "#647087" }}>
          Permanently removes this course, its class sessions, rosters, and attendance records.
        </span>
      </div>
      <DeleteConfirmButton
        label="Delete course"
        confirmLabel="Confirm delete course"
        redirectTo="/dashboard/courses"
        onDelete={() => deleteCourse(courseId)}
      />
    </div>
  );
}
