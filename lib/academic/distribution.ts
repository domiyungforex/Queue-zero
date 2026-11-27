import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const assignmentTokenSchema = z.object({
  v: z.literal(1),
  purpose: z.literal("ASSIGNMENT_GUEST_SUBMIT"),
  orgId: z.uuid(),
  assignmentId: z.uuid(),
  exp: z.number().int().positive(),
});

export type AssignmentGuestToken = z.infer<typeof assignmentTokenSchema>;

function signingSecret(): string {
  const secret =
    process.env.ATTENDANCE_QR_SECRET?.trim() ||
    process.env.QUEUE_JOIN_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "turnmark-dev-assignment-signing-secret-32chars";
  return secret;
}

export function signAssignmentGuestToken(
  orgId: string,
  assignmentId: string,
  expiresAtUnix: number,
  secret = signingSecret(),
): string {
  const payload = assignmentTokenSchema.parse({
    v: 1,
    purpose: "ASSIGNMENT_GUEST_SUBMIT",
    orgId,
    assignmentId,
    exp: expiresAtUnix,
  });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret)
    .update(`turnmark:assignment:v1:${encoded}`)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAssignmentGuestToken(
  token: string,
  secret = signingSecret(),
  nowUnix = Math.floor(Date.now() / 1000),
): AssignmentGuestToken {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid assignment submission link.");
  const [encoded, suppliedSig] = parts;
  const expectedSig = createHmac("sha256", secret)
    .update(`turnmark:assignment:v1:${encoded}`)
    .digest();
  const receivedSig = Buffer.from(suppliedSig, "base64url");
  if (receivedSig.length !== expectedSig.length || !timingSafeEqual(receivedSig, expectedSig)) {
    throw new Error("Invalid assignment submission link.");
  }
  const decoded = assignmentTokenSchema.parse(
    JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
  );
  if (decoded.exp <= nowUnix) {
    throw new Error("This assignment submission link has expired.");
  }
  return decoded;
}

export function deduplicateRecipientIds(groups: string[][]): string[] {
  const unique = new Set<string>();
  for (const group of groups) {
    for (const id of group) {
      if (id) unique.add(id);
    }
  }
  return Array.from(unique);
}
