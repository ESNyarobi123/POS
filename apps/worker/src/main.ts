import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadEnv } from "@gulio/config";

loadDotenv({ path: resolve(__dirname, "../../../.env") });

/**
 * BullMQ-ready worker entry.
 * Does not connect to Redis by default so local scaffold works without infra up.
 * Set WORKER_CONNECT_REDIS=true to attempt a connection.
 */
async function main() {
  const env = loadEnv();

  console.log("@gulio/worker scaffold — background jobs");
  console.log(`env=${env.NODE_ENV} redis=${env.REDIS_URL}`);

  if (process.env.WORKER_CONNECT_REDIS !== "true") {
    console.log(
      "Redis connection deferred (set WORKER_CONNECT_REDIS=true to connect).",
    );
    return;
  }

  const { Queue, Worker } = await import("bullmq");
  const IORedis = (await import("ioredis")).default;

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  try {
    await connection.connect();
    console.log("Connected to Redis");

    // Placeholder queue — real jobs land under src/jobs/*
    const queueName = "gulio-default";
    const queue = new Queue(queueName, { connection });

    const worker = new Worker(
      queueName,
      async (job) => {
        console.log(`Processing job ${job.name} (${job.id})`);
      },
      { connection },
    );

    worker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} failed`, err);
    });

    await queue.waitUntilReady();
    console.log(`BullMQ worker ready on queue "${queueName}"`);

    const shutdown = async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.warn(
      "Redis unavailable — worker stub exiting without queue workers.",
      err instanceof Error ? err.message : err,
    );
    try {
      connection.disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Failed to bootstrap @gulio/worker", err);
  process.exit(1);
});
