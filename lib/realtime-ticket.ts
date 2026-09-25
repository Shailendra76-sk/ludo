import { createHmac, timingSafeEqual } from "node:crypto";

type TicketPayload = {
  userId: string;
  roomId: string;
  exp: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function issueRealtimeTicket(userId: string, roomId: string, ttlSeconds = 300): string {
  const payload: TicketPayload = {
    userId,
    roomId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = encode(JSON.stringify(payload));
  return body + "." + sign(body);
}

export function verifyRealtimeTicket(token: string): TicketPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  const valid = timingSafeEqual(a, b);
  if (!valid) return null;

  try {
    const payload = JSON.parse(decode(body)) as TicketPayload;
    if (!payload.userId || !payload.roomId || !Number.isInteger(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
