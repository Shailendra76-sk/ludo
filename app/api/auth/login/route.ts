import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = requireJsonObject(await request.json());
    const user = await authenticateUser(String(body.email ?? ""), String(body.password ?? ""));
    if (!user) return jsonError("Invalid email or password.", 401);
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to login.", 400);
  }
}
