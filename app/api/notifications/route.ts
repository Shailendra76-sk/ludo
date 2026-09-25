import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { listNotifications, markNotificationRead } from "@/server/social-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const url = new URL(request.url);
  return NextResponse.json(await listNotifications(user.id, Number(url.searchParams.get("limit") ?? 50)));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const body = await request.json().catch(() => ({}));
    await markNotificationRead(user.id, String(body.id ?? "all"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to update notification.", 400);
  }
}
