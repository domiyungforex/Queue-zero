import { describe, expect, it } from "vitest";
import { institutionalMatric, matricMatchKey, preservedMatric, sameInstitutionalMatric } from "@/lib/school/matric";

describe("institutional matriculation numbers", () => {
  it("stores a first registration exactly, including case and leading zeros", () => {
    expect(institutionalMatric("  csc/2022/045 ")).toBe("csc/2022/045");
    expect(institutionalMatric("PHY/2026/0142")).toBe("PHY/2026/0142");
    expect(institutionalMatric("001234")).toBe("001234");
  });

  it("matches a returning student without inventing a replacement number", () => {
    const stored = "csc/2022/045";
    expect(sameInstitutionalMatric(stored, "CSC/2022/045")).toBe(true);
    expect(sameInstitutionalMatric(stored, " csc / 2022 / 045 ")).toBe(true);
    expect(preservedMatric(stored, "CSC / 2022 / 045")).toBe(stored);
  });

  it("keeps the same number across repeated attendance lookups", () => {
    const stored = "U2019/001234";
    for (const typed of ["U2019/001234", "u2019/001234", " U2019/001234 "]) {
      expect(preservedMatric(stored, typed)).toBe(stored);
      expect(matricMatchKey(typed)).toBe(matricMatchKey(stored));
    }
  });

  it("treats a second registration of the same number as the existing student", () => {
    expect(sameInstitutionalMatric("PHY/2026/0142", "phy/2026/0142")).toBe(true);
    expect(preservedMatric("PHY/2026/0142", "phy/2026/0142")).toBe("PHY/2026/0142");
  });

  it("does not treat formatting as a new identity and does not strip leading zeros", () => {
    expect(sameInstitutionalMatric("001234", "1234")).toBe(false);
    expect(preservedMatric("001234", "001234")).toBe("001234");
    expect(matricMatchKey("001234")).toBe("001234");
  });

  it("leaves the registered number alone when another profile field would change", () => {
    const stored = "Phy/20/001";
    expect(preservedMatric(stored, stored)).toBe(stored);
    expect(preservedMatric(stored, "PHY/20/001")).toBe(stored);
  });

  it("allows an explicit correction only when the institution number itself differs", () => {
    expect(preservedMatric("CSC/2020/1", "CSC/2020/2")).toBe("CSC/2020/2");
    expect(preservedMatric("CSC/2020/1", "  CSC/2020/2  ")).toBe("CSC/2020/2");
  });
});
