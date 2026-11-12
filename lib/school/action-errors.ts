type SchoolActionError = { code?: string; message?: string; details?: string; hint?: string };

const stateMessages: Record<string, string> = {
  "Attendance is closed": "This attendance session has ended.",
  "Class cannot be reopened": "This attendance session has ended.",
  "Class is not open": "This attendance session is not open.",
  "Class cannot finish before its scheduled start": "This class cannot be finished before its scheduled start.",
  "Invalid class attendance window": "Please check your class times. Closing time must follow start time and be within 6 hours.",
  "Choose a valid attendance mode": "Please select a valid attendance mode (Standard or Verified).",
  // Compatibility message for a database that has not received the migration.
  // Lecturer assignment is optional and must not block attendance.
  "Assign a lecturer before opening attendance": "Attendance could not open because this workspace needs a database update.",
  "Course unavailable": "You don’t have permission to create or update classes for this course.",
  "Class unavailable": "You don’t have permission to update this class.",
  "Flag unavailable": "You don’t have permission to update this attendance record.",
};

export function schoolActionErrorMessage(error: SchoolActionError) {
  if (error.message && stateMessages[error.message]) return stateMessages[error.message];
  if (error.code === "42501") return "You don’t have permission to update this class.";
  if (error.code === "23505") return "Attendance has already been recorded.";
  if (error.code === "23503") return "The selected course or record was not found.";
  if (error.code === "22023" && error.message) return error.message;
  if (error.code === "PGRST301" || error.code === "PGRST302") return "Your session has expired. Sign in and try again.";
  if (error.code?.startsWith("PGRST")) return "We couldn’t connect. Try again.";
  return "We couldn’t save attendance. Try again.";
}
