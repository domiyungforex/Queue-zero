"use client";

import { useState } from "react";
import { saveCourseAudience } from "@/lib/school-student/registration";
import { FeedbackNotice } from "./feedback-notice";

export function CourseAudienceForm({ courseId, departments }: { courseId: string; departments: { id: string; name: string }[] }) {
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <form className="school-form" action={async (formData) => {
      const result = await saveCourseAudience({ ok: false, message: "" }, formData);
      setOk(result.ok);
      setMessage(result.message);
    }}>
      <h2>Participating departments</h2>
      <p>Choose who this course is intended for. Saving this list does not enroll students. Import or enroll the actual roster.</p>
      <input type="hidden" name="course_id" value={courseId} />
      <fieldset>{departments.map((department) => <label key={department.id} className="school-check"><input type="checkbox" name="department_id" value={department.id} />{department.name}</label>)}</fieldset>
      <label>Eligible level, if the course is limited<input name="level" maxLength={40} placeholder="Optional, e.g. 300" /></label>
      <button className="button-primary" type="submit">Save audience</button>
      {message ? <FeedbackNotice ok={ok} message={message} /> : null}
    </form>
  );
}
