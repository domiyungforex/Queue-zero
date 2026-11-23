"use client";

import { useMemo, useState } from "react";
import { registerStudent } from "@/lib/school-student/registration";
import { FaceCapture } from "./face-capture";
import { FeedbackNotice } from "./feedback-notice";

type Department = { id: string; faculty_id: string; name: string };
type Props = {
  organizationId: string;
  institution: string;
  faculties: { id: string; name: string }[];
  departments: Department[];
};

export function StudentRegistration(props: Props) {
  const [facultyId, setFacultyId] = useState(props.faculties[0]?.id ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);
  const departments = useMemo(() => props.departments.filter((department) => department.faculty_id === facultyId), [facultyId, props.departments]);

  async function submit(formData: FormData) {
    if (!photo) {
      setOk(false);
      setMessage("Capture and confirm a reference photograph before submitting.");
      return;
    }
    setPending(true);
    formData.set("photo", photo);
    formData.set("organizationId", props.organizationId);
    const result = await registerStudent(formData);
    setPending(false);
    setOk(result.ok);
    setMessage(result.message);
  }

  if (!props.faculties.length || !props.departments.length) {
    return <p role="status">This institution has not added a faculty and department yet. Ask an administrator to finish school setup.</p>;
  }

  return (
    <form action={submit} className="school-form">
      <p>Register once at {props.institution}. Enter the matriculation number issued by your institution. TuRnMaRk stores that number and does not create or replace it. Later attendance only needs the same number and a new photograph.</p>
      <label>Full name<input name="fullName" required maxLength={160} autoComplete="name" /></label>
      <label>Matriculation number<input name="matricNumber" required maxLength={80} autoComplete="off" /></label>
      <label>Faculty<select name="facultyId" value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>{props.faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>
      <label>Department<select name="departmentId" required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <label>Academic level<input name="level" required maxLength={40} placeholder="e.g. 300" /></label>
      <label>Email<input name="email" type="email" maxLength={254} autoComplete="email" /></label>
      <label>Phone<input name="phone" type="tel" maxLength={20} autoComplete="tel" /></label>
      <p>Provide an email or a phone number. The reference photograph is not biometric proof of identity.</p>
      <label className="school-check"><input type="checkbox" name="consent" value="yes" required /> I agree that {props.institution} may store this photograph for attendance reference, and I understand it will not be compared by an automated biometric service.</label>
      <FaceCapture onAccept={setPhoto} busy={pending} />
      <button className="button-primary" type="submit" disabled={pending || !photo}>{pending ? "Saving…" : "Submit registration"}</button>
      {message ? <FeedbackNotice ok={ok} message={message} /> : null}
    </form>
  );
}
