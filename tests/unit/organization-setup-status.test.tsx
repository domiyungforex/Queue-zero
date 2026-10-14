import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrganizationSetupStatus } from "@/components/organization/setup-status";

describe("OrganizationSetupStatus", () => {
  it("explains that unverified financial institution queues stay paused", () => {
    const html = renderToStaticMarkup(<OrganizationSetupStatus profile={{
      organization_type: "BANK_FINANCIAL",
      organization_subtype: "MICROFINANCE_BANK",
      legal_name: "Community Finance Limited",
      service_templates: ["ACCOUNT_OPENING", "CUSTOMER_SERVICE"],
      verification_status: "UNVERIFIED",
    }} />);

    expect(html).toContain("Verification required");
    expect(html).toContain("Public queues remain paused");
    expect(html).toContain("Configure a paused service queue");
  });

  it("gives a verified clinic an appropriate first action", () => {
    const html = renderToStaticMarkup(<OrganizationSetupStatus profile={{
      organization_type: "HOSPITAL_CLINIC",
      organization_subtype: "CLINIC",
      legal_name: "Care Clinic",
      service_templates: ["RECEPTION", "CONSULTATION"],
      verification_status: "VERIFIED",
    }} />);

    expect(html).toContain("Organization setup complete");
    expect(html).toContain("Create reception or consultation queue");
    expect(html).toContain("Reception, Consultation");
  });
});
