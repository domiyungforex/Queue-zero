import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ membership: vi.fn(), professional: vi.fn(), school: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/components/realtime/refresh", () => ({ LiveRefresh: () => null }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessMembership: mocks.membership }));
vi.mock("@/lib/professional/data", () => ({ getProfessionalWorkspaceProfile: mocks.professional }));
vi.mock("@/lib/school/data", () => ({ getSchoolSnapshot: mocks.school }));
vi.mock("@/lib/institution/data", () => ({ getInstitutionSnapshot: vi.fn() }));

import ClassesPage from "@/app/dashboard/classes/page";
import ServicesPage from "@/app/dashboard/services/page";

beforeEach(() => {
  mocks.membership.mockReset().mockResolvedValue({
    businessId: "workspace-a",
    role: "owner",
    workspaceOwnership: "INDIVIDUAL",
    professionalCategory: "DOCTOR",
  });
  mocks.professional.mockReset().mockResolvedValue({
    service_name: "Consultations",
    locations: { name: "Main practice", address: "12 Clinic Road" },
  });
  mocks.school.mockReset().mockResolvedValue({
    snapshot: { organization: { id: "workspace-a" }, classes: [], courses: [], attendance: [] },
  });
});

describe("workspace-specific dashboard views", () => {
  it("renders persisted service-professional details without presenting unsupported appointments", async () => {
    const html = renderToStaticMarkup(await ServicesPage());
    expect(html).toContain("Consultations");
    expect(html).toContain("Main practice");
    expect(html).not.toContain("Appointments");
  });

  it("renders an explicit empty service state when the persisted profile is unavailable", async () => {
    mocks.professional.mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await ServicesPage());
    expect(html).toContain("No service details available");
  });

  it("redirects unsupported workspace types away from the personal services route", async () => {
    mocks.membership.mockResolvedValueOnce({
      businessId: "workspace-a",
      role: "owner",
      workspaceOwnership: "INDIVIDUAL",
      professionalCategory: "LECTURER_TEACHER",
    });
    await expect(ServicesPage()).rejects.toThrow("redirect:/dashboard");
  });

  it("renders empty and populated class-session states from real snapshot data", async () => {
    expect(renderToStaticMarkup(await ClassesPage())).toContain("No classes yet");
    mocks.school.mockResolvedValueOnce({ snapshot: {
      organization: { id: "workspace-a" },
      courses: [{ id: "course-a", code: "PHY 101", title: "Mechanics" }],
      classes: [{ id: "class-a", course_id: "course-a", starts_at: "2026-10-14T10:00:00.000Z", status: "OPEN" }],
      attendance: [{ class_session_id: "class-a", check_in_at: "2026-10-14T10:03:00.000Z" }],
    } });
    const html = renderToStaticMarkup(await ClassesPage());
    expect(html).toContain("PHY 101");
    expect(html).toContain("1 arrival");
    expect(html).toContain("/dashboard/attendance/class-a");
  });
});
