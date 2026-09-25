import { cookies } from "next/headers";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getDb } from "@/db/client";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "ludo_session";
const SESSION_DAYS = 30;

function hashValue(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ":" + derived.toString("hex");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createUser(input: { username: string; email: string; password: string }) {
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) throw new Error("Invalid username.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(input.password);
  const result = await getDb().query(
    "INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username,email,created_at",
    [username, email, passwordHash],
  );
  return result.rows[0];
}

export async function authenticateUser(email: string, password: string) {
  const result = await getDb().query(
    "SELECT id,username,email,password_hash FROM users WHERE email=$1 LIMIT 1",
    [email.trim().toLowerCase()],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) return null;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashValue(rawToken);
  await getDb().query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3 || ' days')::interval)",
    [user.id, tokenHash, SESSION_DAYS],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return { id: user.id, username: user.username, email: user.email };
}

export async function getCurrentUser() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const result = await getDb().query(
    "SELECT u.id,u.username,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1",
    [hashValue(rawToken)],
  );
  return result.rows[0] ?? null;
}

export async function logoutUser() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (rawToken) await getDb().query("DELETE FROM sessions WHERE token_hash=$1", [hashValue(rawToken)]);
  store.delete(SESSION_COOKIE);
}
