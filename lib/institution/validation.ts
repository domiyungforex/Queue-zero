import { z } from "zod";
import { INSTITUTION_TYPES, UNIT_TYPES, PERMISSIONS } from "./contracts";
const name = z.string().trim().min(1).max(160);
export const institutionActionSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("setup"), type: z.enum(INSTITUTION_TYPES) }),
 z.object({ action: z.literal("create_unit"), name, type: z.enum(UNIT_TYPES), parent_unit_id: z.uuid().nullable() }),
 z.object({ action: z.literal("update_unit"), unit_id: z.uuid(), name, status: z.enum(["active", "archived"]), parent_unit_id: z.uuid().nullable() }),
 z.object({ action: z.literal("assign_member"), unit_id: z.uuid(), member_id: z.uuid(), role: z.enum(["UNIT_ADMIN", "STAFF", "LECTURER"]), staff_title: z.string().trim().max(100), permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length) }),
 z.object({ action: z.literal("remove_assignment"), unit_id: z.uuid(), member_id: z.uuid() }),
 z.object({ action: z.literal("remove_member"), member_id: z.uuid() }),
]);
export type InstitutionActionState = { status: "idle" | "success" | "error"; message?: string };
