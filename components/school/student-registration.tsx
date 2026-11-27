"use client";

import { useMemo, useState } from "react";
import { registerStudent } from "@/lib/school-student/registration";
import { FaceCapture } from "./face-capture";
import { FeedbackNotice } from "./feedback-notice";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { matchDepartment, matchFaculty } from "@/lib/school/classification";

type Department = { id: string; faculty_id: string; name: string };
type Props = {
  organizationId: string;
  institution: string;
  faculties: { id: string; name: string }[];
  departments: Department[];
};

export function StudentRegistration(props: Props) {
  const [facultyQuery, setFacultyQuery] = useState(props.faculties[0]?.name ?? "");
  const [facultyId, setFacultyId] = useState(props.faculties[0]?.id ?? "");
  const [deptQuery, setDeptQuery] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  const facultyMatch = useMemo(
    () => matchFaculty(facultyQuery, props.faculties),
    [facultyQuery, props.faculties],
  );

  const effectiveFacultyId = facultyMatch.matched?.id ?? facultyId;
  const departments = useMemo(
    () => props.departments.filter((department) => department.faculty_id === effectiveFacultyId),
    [effectiveFacultyId, props.departments],
  );

  const deptMatch = useMemo(
    () => matchDepartment(deptQuery, effectiveFacultyId, props.departments),
    [deptQuery, effectiveFacultyId, props.departments],
  );

  async function submit(formData: FormData) {
    if (!photo) {
      setOk(false);
      setMessage("Capture and confirm a reference photograph before submitting.");
      return;
    }
    setPending(true);
    formData.set("photo", photo);
    formData.set("organizationId", props.organizationId);
    if (facultyMatch.matched) formData.set("facultyId", facultyMatch.matched.id);
    if (deptMatch.matched) formData.set("departmentId", deptMatch.matched.id);
    const result = await registerStudent(formData);
    setPending(false);
    setOk(result.ok);
    setMessage(result.message);
  }

  if (!props.faculties.length || !props.departments.length) {
    return (
      <p role="status">
        This institution has not added a faculty and department yet. Ask an administrator to finish school setup.
      </p>
    );
  }

  return (
    <form action={submit} className="school-form">
      <p>
        Register once at {props.institution}. Enter the matriculation number issued by your institution. TuRnMaRk
        stores that number and does not create or replace it. Later attendance only needs the same number and a new
        photograph.
      </p>
      <label>
        Full name
        <input name="fullName" required maxLength={160} autoComplete="name" />
      </label>
      <label>
        Matriculation number
        <input name="matricNumber" required maxLength={80} autoComplete="off" />
      </label>

      <label>
        Faculty (type to match or select below)
        <input
          type="text"
          list="faculty-suggestions"
          value={facultyQuery}
          onChange={(e) => {
            setFacultyQuery(e.target.value);
            const m = matchFaculty(e.target.value, props.faculties);
            if (m.matched) setFacultyId(m.matched.id);
          }}
          placeholder="e.g. Faculty of Science"
        />
        <datalist id="faculty-suggestions">
          {props.faculties.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
        {facultyQuery.trim() ? (
          <small>
            {facultyMatch.matched
              ? `Matched faculty: ${facultyMatch.matched.name}`
              : "No exact faculty match — select from the list below or flag for admin review."}
          </small>
        ) : null}
      </label>

      <CustomDropdown
        name="facultyId"
        label="Verified Faculty"
        value={effectiveFacultyId}
        onChange={(id) => {
          setFacultyId(id);
          const found = props.faculties.find((f) => f.id === id);
          if (found) setFacultyQuery(found.name);
        }}
        options={props.faculties.map((faculty) => ({ value: faculty.id, label: faculty.name }))}
        required
      />

      <label>
        Department (type to match or select below)
        <input
          type="text"
          list="department-suggestions"
          value={deptQuery}
          onChange={(e) => setDeptQuery(e.target.value)}
          placeholder="e.g. Computer Science or CSC"
        />
        <datalist id="department-suggestions">
          {departments.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
        {deptQuery.trim() ? (
          <small>
            {deptMatch.matched
              ? `Matched department: ${deptMatch.matched.name}`
              : "Unmatched department name — your administrator can verify it without creating duplicates."}
          </small>
        ) : null}
      </label>

      <CustomDropdown
        name="departmentId"
        label="Verified Department"
        defaultValue={deptMatch.matched?.id ?? departments[0]?.id ?? ""}
        key={`${effectiveFacultyId}-${deptMatch.matched?.id ?? ""}`}
        options={departments.map((department) => ({ value: department.id, label: department.name }))}
        required
      />

      <label>
        Academic level
        <input name="level" inputMode="numeric" required maxLength={40} placeholder="e.g. 300" />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" />
      </label>
      <p>Provide an email or a phone number. The reference photograph is not biometric proof of identity.</p>
      <label className="school-check">
        <input type="checkbox" name="consent" value="yes" required /> I agree that {props.institution} may store this
        photograph for attendance reference, and I understand it will not be compared by an automated biometric service.
      </label>
      <FaceCapture onAccept={setPhoto} busy={pending} />
      <button className="button-primary" type="submit" disabled={pending || !photo}>
        {pending ? "Saving…" : "Submit registration"}
      </button>
      {message ? <FeedbackNotice ok={ok} message={message} /> : null}
    </form>
  );
}
