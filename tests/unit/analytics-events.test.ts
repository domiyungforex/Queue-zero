import { describe, expect, it } from "vitest";
import { safeAnalyticsProperties } from "@/lib/analytics/events";

describe("analytics property privacy allowlist", () => {
  it("keeps known low-risk product categories", () => {
    expect(safeAnalyticsProperties({
      account_type: "INDIVIDUAL",
      profession_category: "LECTURER_TEACHER",
      page_path: "/pricing",
      page_category: "marketing",
    })).toEqual({
      account_type: "INDIVIDUAL",
      profession_category: "LECTURER_TEACHER",
      page_path: "/pricing",
      page_category: "marketing",
    });
  });

  it("drops free text, identifiers, and unapproved enum values", () => {
    expect(safeAnalyticsProperties({
      profession_category: "Akinyele Dominion",
      user_role: "student PHY/2026/0142",
      feature_name: "private customer note",
      page_path: "/ticket/secret-token?phone=234",
      page_category: "private",
    })).toEqual({});
  });

  it("does not accept arbitrary property names", () => {
    expect(safeAnalyticsProperties({
      email: "person@example.com",
      matric_number: "PHY/2026/0142",
    } as never)).toEqual({});
  });
});
