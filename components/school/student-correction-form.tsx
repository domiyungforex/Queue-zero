"use client";

import { useState } from "react";
import { correctStudentProfile } from "@/lib/school-student/registration";
import { FeedbackNotice } from "./feedback-notice";

type Student = { id: string; full_name: string; matric_number: string; department_id: string; level: string };
export function StudentCorrectionForm({ students, departments }: { students: Student[]; departments: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(students[0]?.id ?? "");
  const student = students.find((item) => item.id === selected) ?? students[0];
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  if (!student) return null;
  return (
    <form className="school-form" key={student.id} action={async (formData) => {
      const result = await correctStudentProfile({ ok: false, message: "" }, formData);
      setOk(result.ok);
      setMessage(result.message);
    }}>
      <h2>Correct a student profile</h2>
      <label>Student<select name="student_id" value={selected} onChange={(event) => setSelected(event.target.value)}>{students.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.matric_number}</option>)}</select></label>
      <label>Full name<input name="full_name" defaultValue={student.full_name} required maxLength={160} /></label>
      <label>Matriculation number<input name="matric_number" defaultValue={student.matric_number} required maxLength={80} autoComplete="off" /></label>
      <p className="text-sm text-muted">This is the institution-issued number. Saving a name, department or level change does not replace it. Change this field only to correct a genuine mistake.</p>
      <label>Department<select name="department_id" defaultValue={student.department_id}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <label>Academic level<input name="level" defaultValue={student.level} required maxLength={40} /></label>
      <label>Phone<input name="phone" maxLength={20} /></label>
      <button className="button-primary" type="submit">Save correction</button>
      {message ? <FeedbackNotice ok={ok} message={message} /> : null}
    </form>
  );
}
