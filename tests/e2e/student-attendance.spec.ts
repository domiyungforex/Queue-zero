import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signAttendanceToken } from "../../lib/qr/signing";

// Only an explicitly selected disposable preview can be mutated by this test.
const container = process.env.PREVIEW_DB_CONTAINER;
const signingSecret = process.env.E2E_ATTENDANCE_QR_SECRET;
test.skip(!container || !signingSecret, "Requires a disposable preview and its local attendance signing secret.");

function sql(source: string) {
  if (!container || !/^queuezero-preview-[a-f0-9]{12}-db$/.test(container)) throw new Error("Local disposable preview only");
  return execFileSync("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { input: source, encoding: "utf8" }).trim();
}

test("student without preregistration can attend, persist, retry, and see closure", async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local preview only");
  const owner = `user_attendance${randomUUID().replaceAll("-", "")}`;
  const actor = `select set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}"}',true);`;
  const value = (expression: string) => sql(`begin;${actor}select 'DATA:'||(${expression})::text;commit;`).match(/DATA:([^\n]+)/)![1];
  const org = value("onboard_organization('Local attendance QA','education','NG','UTC','Campus','Local test','SCHOOL')");
  const manage = (action: string, fields: Record<string, string>) => JSON.parse(value(`school_manage('${action}','${JSON.stringify({ organization_id: org, ...fields })}'::jsonb)`));
  const faculty = manage("faculty", { name: "Science" }).id;
  const department = manage("department", { faculty_id: faculty, name: "Physics" }).id;
  const course = manage("course", { department_id: department, code: "QA101", title: "Local attendance verification" }).id;
  const session = JSON.parse(value(`school_create_accountless_class('${org}','${course}',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',10,clock_timestamp()+interval '30 minutes')`)).id;
  manage("open", { class_id: session });
  const issued = JSON.parse(value(`school_issue_qr('${session}','${randomUUID()}',clock_timestamp()+interval '30 minutes')`));
  const secret = createHmac("sha256", signingSecret!).update("turnmark:attendance:signing-key:v1").digest("hex");
  const token = signAttendanceToken({ version: 1, purpose: "CLASS_ATTENDANCE", organization_id: org, session_id: session, nonce: issued.nonce, issued_at: Math.floor(new Date(issued.issued_at).getTime() / 1000), expires_at: Math.floor(new Date(issued.expires_at).getTime() / 1000) }, secret);
  const url = `${baseURL}/attend?token=${encodeURIComponent(token)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.getByLabel("Full name")).toBeVisible();
  expect(sql(`select count(*) from school_profiles where organization_id='${org}'`)).toBe("0");
  await page.getByLabel("Full name").fill("Local Test Student");
  await page.getByLabel("Matric number").fill("QA/001");
  await page.getByRole("button", { name: "Mark Attendance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attendance marked ✓" })).toBeVisible();
  expect(sql(`select count(*) from attendance_records where class_session_id='${session}' and status='PRESENT'`)).toBe("1");
  expect(sql(`select count(*) from school_profiles where organization_id='${org}' and matric_number='QA/001'`)).toBe("1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "qa-output/site-audit-20261022/10-local-student-attendance-success.png" });

  await page.reload();
  await page.getByLabel("Full name").fill("Local Test Student");
  await page.getByLabel("Matric number").fill("QA/001");
  await page.getByRole("button", { name: "Mark Attendance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attendance marked ✓" })).toBeVisible();
  expect(sql(`select count(*) from attendance_records where class_session_id='${session}'`)).toBe("1");

  manage("close_arrival", { class_id: session });
  await page.reload();
  await expect(page.getByRole("button", { name: "Mark Attendance", exact: true })).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("closed");
});
