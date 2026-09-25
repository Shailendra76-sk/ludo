import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await logoutUser();
  return NextResponse.json({ ok: true });
}
