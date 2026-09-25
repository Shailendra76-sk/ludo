import { NextResponse } from "next/server";
import { getDb } from "@/db/client";

export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  try {
    await getDb().query("SELECT 1");
    return NextResponse.json({ ok: true, database: "ok", latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable", latencyMs: Date.now() - started }, { status: 503 });
  }
}
