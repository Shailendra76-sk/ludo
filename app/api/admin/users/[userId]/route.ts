import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateUserRole, suspendUser } from "@/server/admin-store";
import { requireJsonObject } from "@/lib/http";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{userId:string}>}){
  try{
    const admin=await requireAdmin(); const {userId}=await context.params; const body=await requireJsonObject(await request.json());
    if(body.action==="role"){const role=body.role==="admin"?"admin":"player";return NextResponse.json({user:await updateUserRole(admin.id,userId,role)});}
    if(body.action==="suspend"){return NextResponse.json({user:await suspendUser(admin.id,userId)});}
    return NextResponse.json({error:"Unsupported action."},{status:400});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Admin action failed."},{status:403});}
}