import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: vi.fn() }));

import { EducationHome } from "@/components/school/overview";
import { buildEducationDashboard } from "@/lib/school/dashboard";
import { schoolFixture } from "./school-fixture";

describe("education home", () => {
  it("renders real snapshot metrics and supported education actions", () => {
    const data = schoolFixture();
    const dashboard = buildEducationDashboard(data, "2026-10-03");
    const html = renderToStaticMarkup(<EducationHome data={data} dashboard={dashboard} />);

    expect(html).toContain("Good morning,");
    expect(html).toContain("Lecturer");
    expect(html).toContain("Total Students");
    expect(html).toContain(">1</strong>");
    expect(html).toContain("PHY101");
    expect(html).toContain("Àkín Johnson");
    expect(html).toContain("/dashboard/courses");
    expect(html).toContain("/dashboard/students");
    expect(html).toContain("/dashboard/attendance");
    expect(html).toContain("/dashboard/exports");
  });

  it("keeps empty activity honest", () => {
    const data = schoolFixture();
    data.classes = [];
    data.attendance = [];
    const html = renderToStaticMarkup(<EducationHome data={data} dashboard={buildEducationDashboard(data, "2026-10-03")} />);

    expect(html).toContain("No classes today");
    expect(html).toContain("No attendance records yet");
    expect(html).not.toContain("248");
  });
});
