import "server-only";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserSupabaseClient } from "@/lib/db/server";
import { getManagedQueue } from "@/lib/queue/management";
import { callNextInputSchema, callNextResponseSchema, type CallNextResult } from "@/lib/validation/call-next";

/** Caller must retain requestId after ambiguous failures; fresh intents get a new ID. */
export async function callNext(input: unknown): Promise<CallNextResult> {
  const parsed = callNextInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: "Reopen the queue and try again." };
  let result: z.output<typeof callNextResponseSchema>;
  try {
    // RLS and verified membership scope this lookup to the selected business.
    // The RPC independently authorizes again under the queue transaction lock.
    await getManagedQueue(parsed.data.queueId);
    const db = await createUserSupabaseClient();
    const { data, error } = await db.rpc("call_next_ticket", { p_queue_id: parsed.data.queueId, p_request_id: parsed.data.requestId });
    if (error?.code === "42501") return { ok: false, code: "forbidden", message: "You no longer have access to operate this queue." };
    if (error?.code === "QZ002") return { ok: false, code: "queue_unavailable", message: "Open the queue at an active location before calling the next customer." };
    if (error) return retryResult();
    const response = z.array(callNextResponseSchema).length(1).safeParse(data);
    if (!response.success) return retryResult();
    result = response.data[0];
  } catch (error) {
    unstable_rethrow(error);
    return retryResult();
  }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/queues/${parsed.data.queueId}`);
  return { ok: true, result };
}
function retryResult(): CallNextResult {
  return { ok: false, code: "retry", message: "We couldn’t confirm the call. Retry the same request to safely check or finish it." };
}
