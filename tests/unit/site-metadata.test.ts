import { describe, expect, it } from "vitest";
import { pageMetadata, jsonLd, publicPaths } from "@/lib/site/metadata";
import { inquirySchema } from "@/lib/contact/validation";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
describe("public discoverability and inquiry boundaries", () => {
  it("uses a distinct canonical and social title", () => { const meta = pageMetadata("Plans", "Real plan details", "/pricing"); expect(meta.title).toBe("Plans"); expect(meta.alternates?.canonical).toBe("/pricing"); expect(meta.openGraph).toMatchObject({ title: "Plans", description: "Real plan details", url: "/pricing" }); });
  it("excludes operational routes from the sitemap", () => { expect(sitemap()).toHaveLength(publicPaths.length); expect(sitemap().every(entry => !/dashboard|attend|token|thank-you/.test(entry.url))).toBe(true); });
  it("disallows indexing token and operational paths", () => { expect(robots().rules).toMatchObject({ disallow: expect.arrayContaining(["/attend", "/t/", "/api/", "/dashboard"]) }); });
  it("cannot break out of structured data script elements", () => { expect(jsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<"); });
  it("bounds inquiries and validates email and idempotency key", () => { const valid = { name: "Ada", email: "ADA@example.com", message: "Please help our organization", requestId: "c5f15eb8-08b5-431e-a19a-278d5143fe74" }; expect(inquirySchema.parse(valid).email).toBe("ada@example.com"); expect(inquirySchema.safeParse({ ...valid, email: "invalid" }).success).toBe(false); expect(inquirySchema.safeParse({ ...valid, message: "a".repeat(4001) }).success).toBe(false); expect(inquirySchema.safeParse({ ...valid, requestId: "123" }).success).toBe(false); });
});
