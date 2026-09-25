import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateReport } from "@/server/admin-store";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{reportId:string}>}){try{const admin=await requireAdmin();const {reportId}=await context.params;const body=await request.json().catch(()=>({}));const allowed=["open","reviewing","resolved","dismissed"] as const;const status=allowed.find(x=>x===body.status);if(!status)return NextResponse.json({error:"Invalid status."},{status:400});return NextResponse.json({report:await updateReport(admin.id,Number(reportId),status)});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Admin action failed."},{status:403});}}