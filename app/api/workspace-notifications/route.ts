import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceNotificationSnapshot, markWorkspaceNotificationsRead } from "@/lib/notifications/workspace";
import { readLimitedBody } from "@/lib/security/request-body";

const markReadSchema = z.object({ notificationId: z.uuid().optional() }).strict();

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    return NextResponse.json(await getWorkspaceNotificationSnapshot(), { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  try {
    const raw = await readLimitedBody(request, 1024);
    const input = markReadSchema.parse(JSON.parse(raw));
    await markWorkspaceNotificationsRead(input.notificationId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({ error: status === 400 ? "Invalid notification request." : "Notifications could not be updated." }, { status, headers: noStore });
  }
}
