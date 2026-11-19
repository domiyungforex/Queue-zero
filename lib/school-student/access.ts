export type AttendanceAccess = {
  found: boolean;
  selfRegistration: boolean;
  message: string;
};

/** Decide what an account-free student may do after a matric lookup. Never grants staff access. */
export function decideStudentAccess(input: {
  rosterFound: boolean;
  identified: boolean;
  eligibleForClass: boolean;
  verificationMode: "STANDARD" | "VERIFIED" | "UNKNOWN";
  sessionOpen: boolean;
}): AttendanceAccess {
  if (!input.sessionOpen) {
    return { found: false, selfRegistration: false, message: "Attendance for this class is closed." };
  }
  if (input.rosterFound || (input.identified && input.eligibleForClass)) {
    return { found: true, selfRegistration: false, message: "Student found." };
  }
  if (input.identified) {
    return {
      found: false,
      selfRegistration: false,
      message: "You are registered, but this class is not open for your enrolment. Contact your lecturer. No account is required.",
    };
  }
  if (input.verificationMode === "STANDARD") {
    return {
      found: false,
      selfRegistration: true,
      message: "This matriculation number is not registered yet. Register once for this class. No TuRnMaRk account is required.",
    };
  }
  return {
    found: false,
    selfRegistration: false,
    message: "That matriculation number is not on this class roster. Ask your lecturer to add you. No account is required.",
  };
}
