import { getDb } from "@/db/client";

export async function ensureProfile(user: { id: string; username: string }) {
  const db = getDb();
  await db.query(
    "INSERT INTO profiles(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",
    [user.id, user.username],
  );
  await db.query(
    "INSERT INTO user_stats(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",
    [user.id],
  );
}

export async function getProfile(userId: string) {
  await ensureProfile({ id: userId, username: "Player" });
  const result = await getDb().query(
    "SELECT u.id,u.username,u.email,p.display_name,p.avatar_url,p.bio,p.language,p.theme,p.sound_enabled,p.music_enabled,p.voice_enabled,p.notifications_enabled,p.reduced_motion,s.games_played,s.wins,s.losses,s.draws,s.tokens_captured,s.tokens_finished,s.current_streak,s.best_streak,s.rating,s.xp FROM users u JOIN profiles p ON p.user_id=u.id JOIN user_stats s ON s.user_id=u.id WHERE u.id=$1 LIMIT 1",
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(userId: string, input: Record<string, unknown>) {
  const displayName = typeof input.display_name === "string" ? input.display_name.trim() : undefined;
  const bio = typeof input.bio === "string" ? input.bio.slice(0, 280) : undefined;
  const language = input.language === "hi" ? "hi" : input.language === "en" ? "en" : undefined;
  const theme = input.theme === "light" ? "light" : input.theme === "dark" ? "dark" : undefined;
  const values: unknown[] = [];
  const sets: string[] = [];
  if (displayName !== undefined) {
    if (!/^[A-Za-z0-9 _.-]{3,32}$/.test(displayName)) throw new Error("Invalid display name.");
    values.push(displayName); sets.push("display_name=$" + values.length);
  }
  if (bio !== undefined) { values.push(bio); sets.push("bio=$" + values.length); }
  if (language !== undefined) { values.push(language); sets.push("language=$" + values.length); }
  if (theme !== undefined) { values.push(theme); sets.push("theme=$" + values.length); }
  for (const key of ["sound_enabled","music_enabled","voice_enabled","notifications_enabled","reduced_motion"]) {
    if (typeof input[key] === "boolean") {
      values.push(input[key]); sets.push(key + "=$" + values.length);
    }
  }
  if (sets.length === 0) return getProfile(userId);
  values.push(userId);
  await getDb().query(
    "UPDATE profiles SET " + sets.join(",") + ",updated_at=now() WHERE user_id=$" + values.length,
    values,
  );
  return getProfile(userId);
}
