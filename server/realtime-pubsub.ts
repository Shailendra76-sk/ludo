import { createClient, type RedisClientType } from "redis";

const CHANNEL = "ludo:realtime";

type Client = RedisClientType;

let publisher: Client | null = null;

async function getPublisher(): Promise<Client | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!publisher) {
    publisher = createClient({ url });
    publisher.on("error", () => undefined);
    await publisher.connect();
  }

  return publisher;
}

export async function publishRealtimeEvent(event: Record<string, unknown>) {
  const client = await getPublisher();
  if (!client) return;
  await client.publish(CHANNEL, JSON.stringify(event));
}

export { CHANNEL };
