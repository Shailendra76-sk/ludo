import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { listChatMessages, sendChatMessage } from "@/server/chat-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const { roomId } = await context.params;
    return NextResponse.json({ messages: await listChatMessages(roomId, user.id) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load chat.", 403);
  }
}

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const body = requireJsonObject(await request.json());
    const { roomId } = await context.params;
    const message = await sendChatMessage(roomId, user.id, String(body.body ?? ""));
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send chat message.", 400);
  }
}
