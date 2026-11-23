"use client";

import { useState } from "react";
import { UserCheck, AlertTriangle } from "lucide-react";
import { correctStudentProfile } from "@/lib/school-student/registration";
import { FeedbackNotice } from "./feedback-notice";

type Student = { id: string; full_name: string; matric_number: string; department_id: string; level: string };

export function StudentCorrectionForm({ students, departments }: { students: Student[]; departments: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(students[0]?.id ?? "");
  const student = students.find((item) => item.id === selected) ?? students[0];
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!student) return null;

  return (
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
      style={{
        display: "grid",
        gap: "20px",
        background: "#ffffff",
      }}
    >
      <div style={{ borderBottom: "1px solid #f3ece8", paddingBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ display: "grid", width: "28px", height: "28px", placeItems: "center", borderRadius: "8px", background: "#fff0e8", color: "#ff6b2b" }}>
            <UserCheck size={16} aria-hidden="true" />
          </span>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 850, color: "#111318" }}>
            Student Profile Management
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "#73788a" }}>
          Select an enrolled student to update administrative records, fix typos, or reassign departments.
        </p>
      </div>

      {/* Student Picker */}
      <label style={{ display: "grid", gap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Select Student</span>
        <select
          name="student_id"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          style={{
            minHeight: "44px",
            borderRadius: "12px",
            border: "1.5px solid #e2dad5",
            padding: "0 14px",
            fontSize: "13px",
            fontWeight: 650,
            background: "#fff",
            color: "#111318",
          }}
        >
          {students.map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name} — {item.matric_number}
            </option>
          ))}
        </select>
      </label>

      {/* Grid of Student Details */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Full Legal Name</span>
          <input
            name="full_name"
            defaultValue={student.full_name}
            required
            maxLength={160}
            style={{
              minHeight: "44px",
              borderRadius: "12px",
              border: "1.5px solid #e2dad5",
              padding: "0 14px",
              fontSize: "13px",
              color: "#111318",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Matriculation Number</span>
          <input
            name="matric_number"
            defaultValue={student.matric_number}
            required
            maxLength={80}
            autoComplete="off"
            style={{
              minHeight: "44px",
              borderRadius: "12px",
              border: "1.5px solid #e2dad5",
              padding: "0 14px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#111318",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Department</span>
          <select
            name="department_id"
            defaultValue={student.department_id}
            style={{
              minHeight: "44px",
              borderRadius: "12px",
              border: "1.5px solid #e2dad5",
              padding: "0 14px",
              fontSize: "13px",
              color: "#111318",
              background: "#fff",
            }}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Academic Level</span>
          <input
            name="level"
            defaultValue={student.level}
            required
            maxLength={40}
            placeholder="e.g. 100L, 200L, 400L"
            style={{
              minHeight: "44px",
              borderRadius: "12px",
              border: "1.5px solid #e2dad5",
              padding: "0 14px",
              fontSize: "13px",
              color: "#111318",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 750, color: "#111318" }}>Phone Contact (Optional)</span>
          <input
            name="phone"
            maxLength={20}
            placeholder="e.g. +234 800 000 0000"
            style={{
              minHeight: "44px",
              borderRadius: "12px",
              border: "1.5px solid #e2dad5",
              padding: "0 14px",
              fontSize: "13px",
              color: "#111318",
            }}
          />
        </label>
      </div>

      {/* Caution notice */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "12px",
          background: "#fffaf7",
          border: "1px solid #ffd9ca",
          fontSize: "12px",
          color: "#8a5338",
        }}
      >
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#d94b14" }} aria-hidden="true" />
        <span>
          <strong>Important:</strong> Changing a student’s matriculation number alters the permanent identifier they use for attendance check-ins. Ensure changes match their official university portal credentials.
        </span>
      </div>

      {message ? <FeedbackNotice ok={ok} message={message} /> : null}

      <div>
        <button
          className="button-primary"
          type="submit"
          disabled={isSubmitting}
          style={{ minHeight: "46px", padding: "0 24px", borderRadius: "12px", fontWeight: 800 }}
        >
          {isSubmitting ? "Saving Changes…" : "Save Student Profile Updates"}
        </button>
      </div>
    </form>
  );
}
