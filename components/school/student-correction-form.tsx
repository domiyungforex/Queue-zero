"use client";

import { useState } from "react";
import { UserCheck, AlertTriangle } from "lucide-react";
import { correctStudentProfile } from "@/lib/school-student/registration";
import { deleteStudentProfile } from "@/lib/school/actions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { DeleteConfirmButton } from "./delete-confirm-button";
import { FeedbackNotice } from "./feedback-notice";

type Student = { id: string; full_name: string; matric_number: string; department_id: string; level: string };

export function StudentCorrectionForm({
  students,
  departments,
}: {
  students: Student[];
  departments: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(students[0]?.id ?? "");
  const student = students.find((item) => item.id === selected) ?? students[0];
  const [departmentId, setDepartmentId] = useState(student?.department_id ?? departments[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!student) return null;

  const studentOptions = students.map((item) => ({
    value: item.id,
    label: item.full_name,
    meta: item.matric_number,
  }));

  const departmentOptions = departments.map((dept) => ({
    value: dept.id,
    label: dept.name,
  }));

  return (
    <div style={{ display: "grid", gap: "24px", padding: "24px", background: "#ffffff", minWidth: 0 }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid #eef2f7",
          paddingBottom: "18px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                display: "grid",
                width: "32px",
                height: "32px",
                placeItems: "center",
                borderRadius: "10px",
                background: "#fff0e8",
                color: "#ff6b2b",
                flexShrink: 0,
              }}
            >
              <UserCheck size={17} aria-hidden="true" />
            </span>
            <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#111318", lineHeight: 1.15 }}>
              Student profile management
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#647087", lineHeight: 1.55, textAlign: "left" }}>
            Select a student to update their name, matriculation number, department, or academic level.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            borderRadius: "999px",
            background: "#f6f8fb",
            border: "1px solid #dfe5ee",
            fontSize: "12px",
            fontWeight: 600,
            color: "#4c576c",
          }}
        >
          <span>{students.length} {students.length === 1 ? "profile" : "profiles"}</span>
        </div>
      </div>

      {/* Student Selector */}
      <CustomDropdown
        label="Select student"
        options={studentOptions}
        value={student.id}
        searchable
        onChange={(nextId) => {
          setSelected(nextId);
          const nextStudent = students.find((s) => s.id === nextId);
          if (nextStudent) setDepartmentId(nextStudent.department_id);
          setMessage("");
        }}
      />

      {/* Profile Edit Form */}
      <form
        key={student.id}
        action={async (formData) => {
          setIsSubmitting(true);
          try {
            const result = await correctStudentProfile({ ok: false, message: "" }, formData);
            setOk(result.ok);
            setMessage(result.message);
          } finally {
            setIsSubmitting(false);
          }
        }}
        style={{ display: "grid", gap: "20px", minWidth: 0 }}
      >
        <input type="hidden" name="student_id" value={student.id} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          <label style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111318" }}>Full legal name</span>
            <input
              name="full_name"
              defaultValue={student.full_name}
              required
              maxLength={160}
              style={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                minHeight: "48px",
                borderRadius: "13px",
                border: "1.5px solid #dfe5ee",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111318",
                background: "#ffffff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111318" }}>Matriculation number</span>
            <input
              name="matric_number"
              defaultValue={student.matric_number}
              required
              maxLength={80}
              autoComplete="off"
              style={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                minHeight: "48px",
                borderRadius: "13px",
                border: "1.5px solid #dfe5ee",
                padding: "0 14px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#111318",
                background: "#ffffff",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            />
          </label>

          <CustomDropdown
            name="department_id"
            label="Department"
            options={departmentOptions}
            value={departmentId || student.department_id}
            onChange={setDepartmentId}
          />

          <label style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111318" }}>Academic level</span>
            <input
              name="level"
              defaultValue={student.level}
              inputMode="numeric"
              required
              maxLength={40}
              placeholder="e.g. 100L, 200L, 400L"
              style={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                minHeight: "48px",
                borderRadius: "13px",
                border: "1.5px solid #dfe5ee",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111318",
                background: "#ffffff",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", minWidth: 0 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111318" }}>Phone contact (optional)</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              placeholder="e.g. +234 800 000 0000"
              style={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                minHeight: "48px",
                borderRadius: "13px",
                border: "1.5px solid #dfe5ee",
                padding: "0 14px",
                fontSize: "14px",
                color: "#111318",
                background: "#ffffff",
              }}
            />
          </label>
        </div>

        {/* Caution notice */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "14px 18px",
            borderRadius: "13px",
            background: "#fffaf7",
            border: "1px solid #ffd9ca",
            fontSize: "13px",
            lineHeight: 1.55,
            color: "#8a5338",
            textAlign: "left",
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#d94b14" }} aria-hidden="true" />
          <span>
            <strong>Important:</strong> Changing a student’s matriculation number updates the identifier they use for attendance check-ins. Ensure changes match official institutional records.
          </span>
        </div>

        {message ? <FeedbackNotice ok={ok} message={message} /> : null}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
          <button
            className="button-primary"
            type="submit"
            disabled={isSubmitting}
            style={{ minHeight: "48px", padding: "12px 24px", borderRadius: "13px", fontWeight: 700 }}
          >
            {isSubmitting ? "Saving changes…" : "Save student profile"}
          </button>
        </div>
      </form>

      {/* Separated Delete Bar (kept away from Save button) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          paddingTop: "18px",
          borderTop: "1px solid #eef2f7",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: "13.5px", color: "#111318" }}>
            Remove student profile
          </strong>
          <span style={{ fontSize: "12.5px", color: "#647087" }}>
            Permanently deletes {student.full_name} ({student.matric_number}) and their attendance records.
          </span>
        </div>
        <DeleteConfirmButton
          label="Delete student profile"
          confirmLabel="Confirm delete student"
          onDelete={() => deleteStudentProfile(student.id)}
          onResult={(res) => {
            setOk(res.ok);
            setMessage(res.message);
          }}
        />
      </div>
    </div>
  );
}
