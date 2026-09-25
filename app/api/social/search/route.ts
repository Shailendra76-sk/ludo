import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { searchUsers } from "@/server/social-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const url = new URL(request.url);
  return NextResponse.json({ users: await searchUsers(user.id, url.searchParams.get("q") ?? "", Number(url.searchParams.get("limit") ?? 20)) });
}
