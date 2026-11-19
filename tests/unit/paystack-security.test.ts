import { describe,it,expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaystackSignature } from "@/lib/paystack/signature";
import { operationSchema } from "@/lib/validation/operations";
import { PLAN_LIMITS } from "@/lib/paystack/plans";
describe('provider signatures',()=>{
 const raw='{"event":"charge.success","data":{"reference":"example"}}',secret='fixture-only';
 it('verifies the exact raw body',()=>{const signature=createHmac('sha512',secret).update(raw).digest('hex');expect(verifyPaystackSignature(raw,signature,secret)).toBe(true);expect(verifyPaystackSignature(raw+' ',signature,secret)).toBe(false)});
 it.each([null,'','abc','0'.repeat(128),'a'.repeat(129)])('rejects invalid signatures without throwing',signature=>expect(verifyPaystackSignature(raw,signature,secret)).toBe(false));
});
it('validates operation boundaries and rejects ownership injection',()=>{const input={queueId:crypto.randomUUID(),requestId:crypto.randomUUID(),operation:'complete',ticketId:crypto.randomUUID()};expect(operationSchema.safeParse(input).success).toBe(true);expect(operationSchema.safeParse({...input,businessId:crypto.randomUUID()}).success).toBe(false);expect(operationSchema.safeParse({...input,operation:'delete'}).success).toBe(false)});
it('publishes bounded queue entitlements',()=>{
 expect(PLAN_LIMITS.FREE.queues).toBe(1);
 expect(PLAN_LIMITS.STARTER.queues).toBe(3);
 expect(PLAN_LIMITS.BUSINESS.queues).toBe(10);
 expect(PLAN_LIMITS.ENTERPRISE.queues).toBeNull();
});
