import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth";
import { clientAddress, jsonError, rateLimit, requireJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!rateLimit("register:" + clientAddress(request), 8, 60_000)) return jsonError("Too many registration attempts. Try again later.", 429);
  try {
    const body = requireJsonObject(await request.json());
    const user = await createUser({
      username: String(body.username ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register.";
    if (message.includes("duplicate key")) return jsonError("Username or email already exists.", 409);
    return jsonError(message, 400);
  }
}
