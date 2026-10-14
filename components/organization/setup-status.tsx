import Link from "next/link";
import type { Database } from "@/lib/db/database.types";

type Profile = Pick<Database["public"]["Tables"]["organization_workspace_profiles"]["Row"],
  "organization_type" | "organization_subtype" | "legal_name" | "service_templates" | "verification_status">;

const nextActions: Record<Profile["organization_type"], { href: string; label: string }> = {
  UNIVERSITY_SCHOOL: { href: "/dashboard/units", label: "Set up departments and units" },
  HOSPITAL_CLINIC: { href: "/dashboard/queues/new", label: "Create reception or consultation queue" },
  BANK_FINANCIAL: { href: "/dashboard/queues/new", label: "Configure a paused service queue" },
  SALON_BARBERSHOP: { href: "/dashboard/queues/new", label: "Create a walk-in queue" },
  GOVERNMENT_OFFICE: { href: "/dashboard/queues/new", label: "Create a public service queue" },
  COMPANY_OTHER: { href: "/dashboard/queues/new", label: "Create a custom service queue" },
};

function display(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function OrganizationSetupStatus({ profile }: { profile: Profile }) {
  const bankPending = profile.organization_type === "BANK_FINANCIAL" && profile.verification_status !== "VERIFIED";
  const action = nextActions[profile.organization_type];
  return <section className={`mb-6 rounded-2xl border p-5 ${bankPending ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`} aria-label="Organization setup status">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{bankPending ? "Verification required" : "Organization setup complete"}</p>
        <h2 className="mt-2 text-lg font-semibold">{profile.legal_name}</h2>
        <p className="mt-1 text-sm">{display(profile.organization_subtype)} · {profile.service_templates.map(display).join(", ")}</p>
        {bankPending && <p className="mt-3 text-sm">Your service configuration is saved. Public queues remain paused until TuRnMaRk verifies the institution.</p>}
      </div>
      <Link href={action.href} className="button-secondary shrink-0">{action.label}</Link>
    </div>
  </section>;
}
