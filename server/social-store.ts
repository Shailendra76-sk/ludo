import { getDb } from "@/db/client";
import type { FriendRequest, FriendRequestStatus, FriendSummary, Notification } from "@/lib/types";

export async function searchUsers(viewerId: string, query: string, limit = 20) {
  const q = query.trim();
  if (q.length < 2) return [];
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const result = await getDb().query(
    `SELECT u.id AS user_id,u.username,p.display_name,
      EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.expires_at>now()) AS online,
      EXISTS(
        SELECT 1 FROM room_players rp
        JOIN rooms r ON r.id=rp.room_id
        JOIN games g ON g.id=r.game_id
        WHERE rp.user_id=u.id AND g.status='playing' AND r.status <> 'closed'
      ) AS in_game
     FROM users u
     JOIN profiles p ON p.user_id=u.id
     WHERE u.id<>$1
       AND (u.username ILIKE $2 OR p.display_name ILIKE $2)
       AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
     ORDER BY CASE WHEN lower(u.username)=lower($3) THEN 0 ELSE 1 END, u.username
     LIMIT $4`,
    [viewerId, "%" + q + "%", q, safeLimit],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    online: row.online,
    inGame: row.in_game,
  }));
}

export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const result = await getDb().query(
    `SELECT f.friend_id AS user_id,u.username,p.display_name,
      EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=f.friend_id AND s.expires_at>now()) AS online,
      EXISTS(
        SELECT 1 FROM room_players rp
        JOIN rooms r ON r.id=rp.room_id
        JOIN games g ON g.id=r.game_id
        WHERE rp.user_id=f.friend_id AND g.status='playing' AND r.status <> 'closed'
      ) AS in_game,
      f.created_at
     FROM friendships f
     JOIN users u ON u.id=f.friend_id
     JOIN profiles p ON p.user_id=f.friend_id
     WHERE f.user_id=$1
     ORDER BY online DESC,in_game DESC,u.username`,
    [userId],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    online: row.online,
    inGame: row.in_game,
    createdAt: row.created_at,
  }));
}

export async function listFriendRequests(userId: string, direction: "incoming" | "outgoing") {
  const column = direction === "incoming" ? "fr.addressee_id" : "fr.requester_id";
  const result = await getDb().query(
    `SELECT fr.id,fr.requester_id,req.username AS requester_username,rp.display_name AS requester_display_name,
      fr.addressee_id,fr.status,fr.created_at
     FROM friend_requests fr
     JOIN users req ON req.id=fr.requester_id
     JOIN profiles rp ON rp.user_id=fr.requester_id
     WHERE ${column}=$1
     ORDER BY fr.created_at DESC`,
    [userId],
  );
  return result.rows as FriendRequest[];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  if (!addresseeId || requesterId === addresseeId) throw new Error("Invalid friend target.");
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const target = await client.query("SELECT id FROM users WHERE id=$1 LIMIT 1", [addresseeId]);
    if (!target.rowCount) throw new Error("Player not found.");

    const blocked = await client.query(
      "SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1",
      [requesterId, addresseeId],
    );
    if (blocked.rowCount) throw new Error("Friend request is unavailable.");

    const alreadyFriends = await client.query(
      "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2 LIMIT 1",
      [requesterId, addresseeId],
    );
    if (alreadyFriends.rowCount) throw new Error("You are already friends.");

    const existing = await client.query(
      "SELECT id,requester_id,status FROM friend_requests WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1) ORDER BY created_at DESC LIMIT 1",
      [requesterId, addresseeId],
    );

    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.status === "pending") throw new Error("A friend request is already pending.");
      if (row.requester_id === addresseeId && row.status === "rejected") {
        await client.query(
          "UPDATE friend_requests SET requester_id=$1,addressee_id=$2,status='pending',updated_at=now() WHERE id=$3",
          [requesterId, addresseeId, row.id],
        );
      } else {
        await client.query(
          "INSERT INTO friend_requests(requester_id,addressee_id,status) VALUES($1,$2,'pending')",
          [requesterId, addresseeId],
        );
      }
    } else {
      await client.query(
        "INSERT INTO friend_requests(requester_id,addressee_id,status) VALUES($1,$2,'pending')",
        [requesterId, addresseeId],
      );
    }

    const sender = await client.query("SELECT username FROM users WHERE id=$1", [requesterId]);
    await client.query(
      "INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'friend_request','New friend request',$2,$3)",
      [
        addresseeId,
        (sender.rows[0]?.username ?? "A player") + " sent you a friend request.",
        JSON.stringify({ userId: requesterId }),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function respondFriendRequest(
  userId: string,
  requestId: string,
  decision: Extract<FriendRequestStatus, "accepted" | "rejected">,
) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT * FROM friend_requests WHERE id=$1 FOR UPDATE",
      [requestId],
    );
    if (!result.rowCount) throw new Error("Friend request not found.");
    const request = result.rows[0];
    if (request.addressee_id !== userId) throw new Error("You cannot respond to this request.");
    if (request.status !== "pending") throw new Error("This request is no longer pending.");

    await client.query(
      "UPDATE friend_requests SET status=$2,updated_at=now() WHERE id=$1",
      [requestId, decision],
    );

    if (decision === "accepted") {
      await client.query(
        "INSERT INTO friendships(user_id,friend_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING",
        [request.requester_id, request.addressee_id],
      );
      const accepter = await client.query("SELECT username FROM users WHERE id=$1", [userId]);
      await client.query(
        "INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'friend_accepted','Friend request accepted',$2,$3)",
        [
          request.requester_id,
          (accepter.rows[0]?.username ?? "A player") + " accepted your friend request.",
          JSON.stringify({ userId }),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function removeFriend(userId: string, friendId: string) {
  await getDb().query(
    "DELETE FROM friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)",
    [userId, friendId],
  );
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You cannot block yourself.");
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [blockerId, blockedId],
    );
    await client.query(
      "DELETE FROM friendships WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)",
      [blockerId, blockedId],
    );
    await client.query(
      "UPDATE friend_requests SET status='cancelled',updated_at=now() WHERE status='pending' AND ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1))",
      [blockerId, blockedId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listNotifications(userId: string, limit = 50): Promise<{ items: Notification[]; unread: number }> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const [items, count] = await Promise.all([
    getDb().query(
      "SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2",
      [userId, safeLimit],
    ),
    getDb().query("SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND read_at IS NULL", [userId]),
  ]);
  return { items: items.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  })), unread: count.rows[0].unread };
}

export async function markNotificationRead(userId: string, notificationId: string | "all") {
  if (notificationId === "all") {
    await getDb().query("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL", [userId]);
    return;
  }
  const id = Number(notificationId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid notification id.");
  await getDb().query(
    "UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
}
