import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { jsonError, requireJsonObject } from "@/lib/http";

export const runtime="nodejs";

export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user) return jsonError("Authentication required.",401);
  try{
    const body=await requireJsonObject(await request.json());
    const reason=String(body.reason??"").trim();
    const details=String(body.details??"").trim();
    const targetUserId=body.targetUserId?String(body.targetUserId):null;
    const roomId=body.roomId?String(body.roomId):null;
    const gameId=body.gameId?String(body.gameId):null;
    if(reason.length<1||reason.length>200) return jsonError("Invalid report reason.",400);
    if(details.length>1000) return jsonError("Report details are too long.",400);

    if(targetUserId===user.id) return jsonError("Invalid report target.",400);
    const db=getDb();
    if(roomId){
      const member=await db.query("SELECT 1 FROM room_players WHERE room_id=$1 AND user_id=$2 LIMIT 1",[roomId,user.id]);
      if(!member.rowCount) return jsonError("You are not a member of this room.",403);
    }
    await db.query(
      "INSERT INTO reports(reporter_user_id,target_user_id,room_id,game_id,reason,details) VALUES($1,$2,$3,$4,$5,$6)",
      [user.id,targetUserId,roomId,gameId,reason,details]
    );
    return NextResponse.json({ok:true},{status:201});
  }catch(e){
    return jsonError(e instanceof Error?e.message:"Unable to create report.",400);
  }
}
