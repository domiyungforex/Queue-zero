export type AttendanceAccess = {
  found: boolean;
  selfRegistration: boolean;
  message: string;
};

/** Decide what an account-free student may do after a matric lookup. Never grants staff access.
 * A registered institutional student can attend any open class session without course enrolment.
 */
export function decideStudentAccess(input: {
  rosterFound: boolean;
  identified: boolean;
  eligibleForClass?: boolean;
  verificationMode: "STANDARD" | "VERIFIED" | "UNKNOWN";
  sessionOpen: boolean;
}): AttendanceAccess {
  if (!input.sessionOpen) {
    return { found: false, selfRegistration: false, message: "Attendance for this class is closed." };
  }
  // If student is found on roster OR identified at the institution, they are recognized for attendance
  if (input.rosterFound || input.identified) {
    return { found: true, selfRegistration: false, message: "Student found." };
  }
  // If not identified at the institution, offer first-time institutional registration
  return {
    found: false,
    selfRegistration: true,
    message: "This matriculation number is not registered yet. Complete first-time student registration to continue.",
  };
}
