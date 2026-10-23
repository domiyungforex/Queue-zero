import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";
import { institutionSnapshotSchema } from "./contracts";
// Request-local deduplication: the shell and page share the same authorized
// result without caching one user's data across sessions or requests.
export const getInstitutionSnapshot = cache(async (unitId?: string) => {
 const membership = await requireBusinessMembership();
 if (unitId && !z.uuid().safeParse(unitId).success) notFound();
 const db = await createUserSupabaseClient();
 const { data, error } = await db.rpc("institution_snapshot", { p_organization_id: membership.businessId, p_unit_id: unitId });
 if (error?.code === "42501" || error?.code === "P0002") notFound();
 if (error) throw new Error("Institution services could not be loaded. Please try again.");
 const result = institutionSnapshotSchema.safeParse(data);
 if (!result.success) throw new Error("Institution services are temporarily unavailable.");
 if (result.data.organization.id !== membership.businessId || (unitId && !result.data.units.some(unit => unit.id === unitId))) notFound();
 return { snapshot: result.data, manager: membership.role === "owner" || membership.role === "admin" };
});
