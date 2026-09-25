import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { getProfile, updateProfile } from "@/server/profile-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const body = requireJsonObject(await request.json());
    return NextResponse.json({ profile: await updateProfile(user.id, body) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to update profile.", 400);
  }
}
