import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { listFriendRequests } from "@/server/social-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const url = new URL(request.url);
  const direction = url.searchParams.get("direction") === "outgoing" ? "outgoing" : "incoming";
  return NextResponse.json({ requests: await listFriendRequests(user.id, direction) });
}
