// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
const mocks=vi.hoisted(()=>({snapshot:vi.fn()}));
vi.mock("@/lib/school/data",()=>({getSchoolSnapshot:mocks.snapshot}));vi.mock("@/lib/db/server",()=>({createUserSupabaseClient:vi.fn()}));vi.mock("@/components/realtime/refresh",()=>({LiveRefresh:()=>null}));
import {SchoolAnalytics} from "@/components/school/overview";
import {schoolFixture} from "./school-fixture";
afterEach(cleanup);
describe("school analytics actual finalized records",()=>{
 it("counts early departure while retaining late arrival from server timestamps",async()=>{const data=schoolFixture();data.attendance[0].status="EARLY_LEAVE";data.attendance[0].check_in_at="2026-10-03T10:15:00Z";data.classes[0].planned_ends_at="2026-10-03T11:30:00Z";mocks.snapshot.mockResolvedValue({snapshot:data});render(await SchoolAnalytics());expect(screen.getByText("Early departures").closest(".stat-card")?.textContent).toContain("1");expect(screen.getByText("Late rate").closest(".stat-card")?.textContent).toContain("100%");expect(screen.getByText("Attendance rate").closest(".stat-card")?.textContent).toContain("100%");});
});
