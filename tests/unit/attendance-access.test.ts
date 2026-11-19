import { describe, expect, it } from "vitest";
import { decideStudentAccess } from "@/lib/school-student/access";

describe("account-free attendance access", () => {
  it("returns a roster student without offering registration", () => {
    expect(decideStudentAccess({ rosterFound: true, identified: false, eligibleForClass: false, verificationMode: "VERIFIED", sessionOpen: true })).toEqual({
      found: true, selfRegistration: false, message: "Student found.",
    });
  });

  it("lets a registered student into an eligible open class", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: true, eligibleForClass: true, verificationMode: "STANDARD", sessionOpen: true }).found).toBe(true);
  });

  it("does not let a registered student self-enrol in a different class", () => {
    const decision = decideStudentAccess({ rosterFound: false, identified: true, eligibleForClass: false, verificationMode: "STANDARD", sessionOpen: true });
    expect(decision.selfRegistration).toBe(false);
    expect(decision.message).toMatch(/not open for your enrolment/);
  });

  it("offers first registration only for an open standard class", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: false, eligibleForClass: false, verificationMode: "STANDARD", sessionOpen: true }).selfRegistration).toBe(true);
    expect(decideStudentAccess({ rosterFound: false, identified: false, eligibleForClass: false, verificationMode: "VERIFIED", sessionOpen: true }).selfRegistration).toBe(false);
    expect(decideStudentAccess({ rosterFound: false, identified: false, eligibleForClass: false, verificationMode: "UNKNOWN", sessionOpen: true }).selfRegistration).toBe(false);
  });

  it("rejects a closed session before registration", () => {
    expect(decideStudentAccess({ rosterFound: false, identified: false, eligibleForClass: false, verificationMode: "STANDARD", sessionOpen: false }).message).toMatch(/closed/);
  });
});
