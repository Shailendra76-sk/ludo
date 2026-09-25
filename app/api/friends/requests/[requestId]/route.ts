import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { respondFriendRequest } from "@/server/social-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const body = requireJsonObject(await request.json());
    const decision = body.decision === "rejected" ? "rejected" : body.decision === "accepted" ? "accepted" : null;
    if (!decision) return jsonError("decision must be accepted or rejected.", 400);
    const { requestId } = await context.params;
    await respondFriendRequest(user.id, requestId, decision);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to respond to request.", 400);
  }
}
