import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { dashboardStats } from "@/server/admin-store";
export const runtime="nodejs";
export async function GET(){try{await requireAdmin();return NextResponse.json(await dashboardStats());}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Forbidden"},{status:403});}}