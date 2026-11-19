import { describe, expect, it } from "vitest";
import { assertIsolatedLoadTarget } from "@/lib/scale/load-target";

describe("load-test target guard", () => {
  it("refuses production and the hosted database", () => {
    expect(() => assertIsolatedLoadTarget(undefined)).toThrow(/LOAD_TARGET/);
    expect(() => assertIsolatedLoadTarget("https://turnmark.conchportal.com/attend")).toThrow(/production/i);
    expect(() => assertIsolatedLoadTarget("https://wbvgorahtkiiwplsbnga.supabase.co")).toThrow(/production/i);
    expect(() => assertIsolatedLoadTarget("http://staging.example.test")).toThrow(/HTTPS/);
  });

  it("allows localhost and a non-production HTTPS host", () => {
    expect(assertIsolatedLoadTarget("http://127.0.0.1:3000/attend").hostname).toBe("127.0.0.1");
    expect(assertIsolatedLoadTarget("https://staging.example.test/attend").hostname).toBe("staging.example.test");
  });
});
