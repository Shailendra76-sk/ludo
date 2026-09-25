import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, updateSetting } from "@/server/admin-store";
import { requireJsonObject } from "@/lib/http";
export const runtime="nodejs";
export async function GET(){try{await requireAdmin();return NextResponse.json({settings:await getSettings()});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Forbidden"},{status:403});}}
export async function PATCH(request:Request){try{const admin=await requireAdmin();const body=await requireJsonObject(await request.json());const key=String(body.key??"");const value=body.value;if(!value||typeof value!=="object"||Array.isArray(value))return NextResponse.json({error:"Invalid setting value."},{status:400});await updateSetting(admin.id,key,value as Record<string,unknown>);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Unable to update setting."},{status:400});}}