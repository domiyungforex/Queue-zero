import { expect, test } from "@playwright/test";
const unknownClass = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

for (const width of [320, 768]) {
 test(`invalid classroom QR is safe and usable at ${width}px`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto("/attend?token=invalid-attendance-token");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Class attendance" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or unavailable");
  await expect(page.getByRole("button", { name: /record|confirm/i })).toHaveCount(0);
  const signIn = page.getByRole("link", { name: "Sign in before scanning again" });
  await expect(signIn).toBeVisible();
  const destination = new URL((await signIn.getAttribute("href"))!, page.url());
  expect(destination.pathname).toBe("/sign-in");
  expect(destination.searchParams.get("redirect_url")).toBe("/attend?token=invalid-attendance-token");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 });
}

test("school pages and register endpoints cannot disclose attendance anonymously", async ({ request, page }) => {
 for (const format of ["csv", "pdf", "xlsx"]) {
  const response = await request.get(`/api/school/classes/${unknownClass}/export?format=${format}`);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ error: "Sign in required" });
 }
 const qr = await request.get(`/api/school/classes/${unknownClass}/qr`);
 expect(qr.status()).toBe(401);
 expect(qr.headers()["cache-control"]).toContain("no-store");
 await page.goto(`/dashboard/attendance/${unknownClass}`);
 await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
 await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
 await expect(page.getByRole("table")).toHaveCount(0);
});

test("public queue and ticket URLs remain account-free after school authentication is added", async ({ page }) => {
 // The DB-backed customer-journey test separately proves successful anonymous joining.
 // Unknown links here ensure routing never imposes the school authentication requirement.
 for (const route of ["/q/nonexistent-school-regression", "/ticket/not-a-token"]) {
  await page.goto(route);
  expect(new URL(page.url()).pathname).toBe(route);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email|password/i })).toHaveCount(0);
 }
});
