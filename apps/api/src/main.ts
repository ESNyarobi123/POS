import "reflect-metadata";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { loadEnv } from "@gulio/config";
import { AppModule } from "./app.module";

// Load monorepo root `.env` when present (secrets stay out of Git).
loadDotenv({ path: resolve(__dirname, "../../../.env") });

async function bootstrap() {
  const env = loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: env.NODE_ENV === "development" }),
  );

  // Comma-separated WEB_URL / CORS_ORIGINS — local web often runs on 3000 or 3010
  const corsOrigins = [
    ...env.WEB_URL.split(",").map((o) => o.trim()).filter(Boolean),
    ...(process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ??
      []),
    "http://localhost:3000",
    "http://localhost:3010",
  ];
  const allowedOrigins = [...new Set(corsOrigins)];

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser / same-origin tools (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });

  app.enableShutdownHooks();

  const port = env.API_PORT;
  await app.listen(port, "0.0.0.0");
  console.log(`@gulio/api listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap @gulio/api", err);
  process.exit(1);
});
