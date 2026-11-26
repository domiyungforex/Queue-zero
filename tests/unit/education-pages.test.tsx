import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { schoolFixture } from "./school-fixture";

const mocks = vi.hoisted(() => ({ school: vi.fn(), membership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/components/realtime/refresh", () => ({ LiveRefresh: () => null }));
vi.mock("@/components/auth/auth-navigation", () => ({ AuthNavigation: () => <button>Sign out</button> }));
vi.mock("@/lib/school/data", () => ({ getSchoolSnapshot: mocks.school }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessMembership: mocks.membership }));

import AttendancePage from "@/app/dashboard/attendance/page";
import ExportsPage from "@/app/dashboard/exports/page";
import MorePage from "@/app/dashboard/more/page";
import StudentsPage from "@/app/dashboard/students/page";

beforeEach(() => {
  mocks.school.mockReset().mockResolvedValue({ snapshot: schoolFixture(), canManage: true });
  mocks.membership.mockReset().mockResolvedValue({ businessName: "Test institution", role: "owner" });
});

describe("education workspace pages", () => {
  it("keeps a private attendance photo from crashing the page or opening onboarding", async () => {
    const snapshot = schoolFixture();
    snapshot.attendance[0].photo_url = "org/class/selfie.jpg";
    mocks.school.mockResolvedValue({ snapshot, canManage: true });
    const html = renderToStaticMarkup(await AttendancePage({ searchParams: Promise.resolve({ period: "all" }) }));
    expect(html).toContain("Attendance records");
    expect(html).toContain("Àkín Johnson");
    expect(html).not.toContain("org/class/selfie.jpg");
    expect(html).not.toContain("/onboarding");
  });

  it("calculates attendance analytics from finalized records", async () => {
    const html = renderToStaticMarkup(await AttendancePage({ searchParams: Promise.resolve({ period: "all" }) }));
    expect(html).toContain("Attendance trend");
    expect(html).toContain("100%");
    expect(html).toContain("Àkín Johnson");
    expect(html).not.toContain("248");
  });

  it("renders student profile management and student records from snapshot", async () => {
    const html = renderToStaticMarkup(await StudentsPage());
    expect(html).toContain("Student Profile Management");
    expect(html).toContain("Àkín Johnson");
    expect(html).toContain("PHY/26/1");
    expect(html).toContain("Student records");
  });

  it("lists only real finalized attendance reports", async () => {
    const html = renderToStaticMarkup(await ExportsPage());
    expect(html).toContain("PHY101");
    expect(html).toContain("1 record");
    expect(html).toContain("/dashboard/attendance/cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("renders authorized education management destinations", async () => {
    const html = renderToStaticMarkup(await MorePage());
    expect(html).toContain("Test institution");
    expect(html).toContain("Team members");
    expect(html).toContain("Settings");
    expect(html).toContain("Privacy Policy");
    expect(html).not.toContain("/terms");
  });
});
