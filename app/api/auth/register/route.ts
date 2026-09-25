import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
