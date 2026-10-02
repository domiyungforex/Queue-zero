import { databaseTokenOptions } from "@/lib/auth/database-token";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, getToken } = await auth();
    if (userId) {
      const token = await getToken(databaseTokenOptions());
      if (token) return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    // Revoked/expired provider sessions must not leak provider details into logs.
  }
  return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
