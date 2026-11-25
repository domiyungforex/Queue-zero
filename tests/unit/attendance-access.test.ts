import { describe, expect, it } from "vitest";
import { decideStudentAccess } from "@/lib/school-student/access";

describe("account-free attendance access", () => {
  it("returns a roster student without offering registration", () => {
    expect(decideStudentAccess({ rosterFound: true, identified: false, verificationMode: "VERIFIED", sessionOpen: true })).toEqual({
      found: true, selfRegistration: false, message: "Student found.",
    });
  });

  it("lets an institutionally registered student into any open class without course enrolment", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: true, verificationMode: "STANDARD", sessionOpen: true }).found).toBe(true);
    expect(decideStudentAccess({ rosterFound: false, identified: true, verificationMode: "VERIFIED", sessionOpen: true }).found).toBe(true);
  });

  it("offers first registration when student is not yet institutionally registered", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: false, verificationMode: "STANDARD", sessionOpen: true }).selfRegistration).toBe(true);
    expect(decideStudentAccess({ rosterFound: false, identified: false, verificationMode: "VERIFIED", sessionOpen: true }).selfRegistration).toBe(true);
  });

  it("rejects a closed session before registration", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: false, verificationMode: "STANDARD", sessionOpen: false }).message).toMatch(/closed/);
  });
});
