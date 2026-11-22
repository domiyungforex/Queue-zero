"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, UserCheck, UsersRound, X } from "lucide-react";
import { AssignLecturerForm } from "./assign-lecturer-form";
import { removeLecturerAction } from "@/lib/organization/cms-actions";

type Lecturer = {
  clerk_user_id: string;
  display_name: string;
  role: string;
};

type Props = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  departmentName: string;
  facultyName: string;
  enrolledCount: number;
  lecturers: Lecturer[];
  canManage: boolean;
};

export function CourseManagerRow({
  courseId,
  courseCode,
  courseTitle,
  departmentName,
  facultyName,
  enrolledCount,
  lecturers,
  canManage,
}: Props) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const handleRemoveLecturer = async (userId: string) => {
    if (!confirm("Are you sure you want to unassign this lecturer from the course?")) return;
    setIsRemoving(userId);
    const fd = new FormData();
    fd.set("courseId", courseId);
    fd.set("userId", userId);
    await removeLecturerAction(fd);
    setIsRemoving(null);
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #ffd2bf",
        borderRadius: "16px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span
              style={{
                background: "#fff0e8",
                color: "#d94b14",
                fontWeight: 800,
                fontSize: "12px",
                padding: "3px 8px",
                borderRadius: "6px",
              }}
            >
              {courseCode}
            </span>
            <span style={{ fontSize: "12px", color: "#8c827b" }}>
              {facultyName} · {departmentName}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "#17130f" }}>
            {courseTitle}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#70665e" }}>
            <UsersRound size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            {enrolledCount} {enrolledCount === 1 ? "student" : "students"} enrolled
          </p>
        </div>

        <Link
          href={`/dashboard/courses/${courseId}`}
          className="button-secondary"
          style={{ fontSize: "12px", minHeight: "36px", padding: "6px 12px" }}
        >
          Course Details <ChevronRight size={14} />
        </Link>
      </div>

      {/* Assigned Lecturers Area */}
      <div
        style={{
          background: "#fffbf9",
          borderRadius: "12px",
          padding: "12px 14px",
          border: "1px solid #f5ede6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <UserCheck size={16} style={{ color: "#ff5c1a" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#70665e" }}>Assigned Lecturers:</span>
          {lecturers.length > 0 ? (
            lecturers.map((lec) => (
              <span
                key={lec.clerk_user_id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#ffffff",
                  border: "1px solid #e7ded6",
                  borderRadius: "20px",
                  padding: "3px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#17130f",
                }}
              >
                {lec.display_name}
                {canManage && (
                  <button
                    onClick={() => handleRemoveLecturer(lec.clerk_user_id)}
                    disabled={isRemoving === lec.clerk_user_id}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      color: "#b91c1c",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Remove assignment"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))
          ) : (
            <span style={{ fontSize: "12px", color: "#a89f97", fontStyle: "italic" }}>
              No lecturer assigned yet
            </span>
          )}
        </div>

        {canManage && (
          <button
            type="button"
            className="button-quiet"
            onClick={() => setShowAssignModal(true)}
            style={{ fontSize: "12px", color: "#d94b14", fontWeight: 700, padding: "4px 8px" }}
          >
            <Plus size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Assign Lecturer
          </button>
        )}
      </div>

      {showAssignModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAssignModal(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <AssignLecturerForm
            courseId={courseId}
            courseCode={courseCode}
            courseTitle={courseTitle}
            onClose={() => setShowAssignModal(false)}
          />
        </div>
      )}
    </div>
  );
}
