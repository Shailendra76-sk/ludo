import { getDb } from "@/db/client";

export async function dashboardStats() {
  const db = getDb();
  const [users, active, gamesToday, activeGames, completed, reports] = await Promise.all([
    db.query("SELECT COUNT(*)::int AS count FROM users"),
    db.query("SELECT COUNT(DISTINCT user_id)::int AS count FROM sessions WHERE expires_at>now()"),
    db.query("SELECT COUNT(*)::int AS count FROM games WHERE created_at>=CURRENT_DATE"),
    db.query("SELECT COUNT(*)::int AS count FROM games WHERE status='playing'"),
    db.query("SELECT COUNT(*)::int AS count FROM games WHERE status='finished'"),
    db.query("SELECT COUNT(*)::int AS count FROM reports WHERE status IN ('open','reviewing')"),
  ]);
  return {
    totalUsers: users.rows[0].count,
    activeUsers: active.rows[0].count,
    gamesToday: gamesToday.rows[0].count,
    activeGames: activeGames.rows[0].count,
    completedGames: completed.rows[0].count,
    openReports: reports.rows[0].count,
  };
}

export async function listUsers(limit=100) {
  const safeLimit=Math.max(1,Math.min(200,Math.floor(limit)));
  const result=await getDb().query(
    `SELECT u.id,u.username,u.email,u.role,u.created_at,
      COALESCE(s.games_played,0) games_played,
      COALESCE(s.wins,0) wins,
      COALESCE(s.rating,1000) rating
     FROM users u LEFT JOIN user_stats s ON s.user_id=u.id
     ORDER BY u.created_at DESC LIMIT $1`,
    [safeLimit]
  );
  return result.rows.map(r=>({
    id:r.id,username:r.username,email:r.email,role:r.role,createdAt:r.created_at,
    gamesPlayed:r.games_played,wins:r.wins,rating:r.rating
  }));
}

export async function listGames(limit=100) {
  const safeLimit=Math.max(1,Math.min(200,Math.floor(limit)));
  const result=await getDb().query(
    `SELECT id,status,config,state_version,updated_at
     FROM games ORDER BY updated_at DESC LIMIT $1`,
    [safeLimit]
  );
  return result.rows.map(r=>({
    id:r.id,status:r.status,playerCount:Number(r.config?.playerCount ?? 0),
    mode:String(r.config?.mode ?? "classic"),stateVersion:r.state_version,updatedAt:r.updated_at
  }));
}

export async function audit(
  adminUserId:string,
  action:string,
  targetType:string|null=null,
  targetId:string|null=null,
  metadata:Record<string,unknown>={}
){
  await getDb().query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)",
    [adminUserId,action,targetType,targetId,JSON.stringify(metadata)]
  );
}

export async function updateUserRole(adminUserId:string,targetId:string,role:"player"|"admin") {
  if(adminUserId===targetId && role!=="admin") throw new Error("You cannot remove your own admin role.");
  const result=await getDb().query("UPDATE users SET role=$2,updated_at=now() WHERE id=$1 RETURNING id,username,role",[targetId,role]);
  if(!result.rowCount) throw new Error("User not found.");
  await audit(adminUserId,"CHANGE_USER_ROLE","user",targetId,{role});
  return result.rows[0];
}

export async function suspendUser(adminUserId:string,targetId:string) {
  if(adminUserId===targetId) throw new Error("You cannot suspend yourself.");
  const deleted=await getDb().query("DELETE FROM sessions WHERE user_id=$1 RETURNING user_id",[targetId]);
  const result=await getDb().query("UPDATE users SET updated_at=now() WHERE id=$1 RETURNING id,username,role",[targetId]);
  if(!result.rowCount) throw new Error("User not found.");
  await audit(adminUserId,"REVOKE_USER_SESSIONS","user",targetId,{sessionsRevoked:deleted.rowCount});
  return result.rows[0];
}

export async function listReports(limit=100) {
  const safeLimit=Math.max(1,Math.min(200,Math.floor(limit)));
  const result=await getDb().query(
    `SELECT r.id,r.reason,r.details,r.status,r.created_at,
      reporter.username reporter_username,
      target.username target_username,
      r.room_id,r.game_id
     FROM reports r
     JOIN users reporter ON reporter.id=r.reporter_user_id
     LEFT JOIN users target ON target.id=r.target_user_id
     ORDER BY r.created_at DESC LIMIT $1`,
    [safeLimit]
  );
  return result.rows;
}

export async function updateReport(adminUserId:string,reportId:number,status:"open"|"reviewing"|"resolved"|"dismissed") {
  const result=await getDb().query("UPDATE reports SET status=$2,updated_at=now() WHERE id=$1 RETURNING *",[reportId,status]);
  if(!result.rowCount) throw new Error("Report not found.");
  await audit(adminUserId,"UPDATE_REPORT","report",String(reportId),{status});
  return result.rows[0];
}

export async function getSettings() {
  const result=await getDb().query("SELECT key,value,updated_at FROM app_settings ORDER BY key");
  return result.rows;
}

export async function updateSetting(adminUserId:string,key:string,value:Record<string,unknown>) {
  if(!["branding","game"].includes(key)) throw new Error("Unsupported setting.");
  await getDb().query(
    "INSERT INTO app_settings(key,value,updated_by,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT(key) DO UPDATE SET value=$2,updated_by=$3,updated_at=now()",
    [key,JSON.stringify(value),adminUserId]
  );
  await audit(adminUserId,"UPDATE_SETTING","setting",key,value);
}
