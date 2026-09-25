import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { clientAddress, jsonError, rateLimit, requireJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!rateLimit("login:" + clientAddress(request), 12, 60_000)) return jsonError("Too many login attempts. Try again later.", 429);
  try {
    const body = requireJsonObject(await request.json());
    const user = await authenticateUser(String(body.email ?? ""), String(body.password ?? ""));
    if (!user) return jsonError("Invalid email or password.", 401);
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to login.", 400);
  }
}
