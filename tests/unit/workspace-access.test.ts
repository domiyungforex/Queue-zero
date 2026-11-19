import { describe, expect, it } from "vitest";
import { workspaceAccessDecision } from "@/lib/business/workspace-access";

describe("workspace access", () => {
  it("does not send a database failure to onboarding", () => {
    expect(workspaceAccessDecision({ signedIn: true, membershipCount: null })).toBe("retry");
    expect(workspaceAccessDecision({ signedIn: true, membershipCount: 0 })).toBe("onboarding");
    expect(workspaceAccessDecision({ signedIn: true, membershipCount: 1 })).toBe("dashboard");
    expect(workspaceAccessDecision({ signedIn: false, membershipCount: 1 })).toBe("sign-in");
  });
});
