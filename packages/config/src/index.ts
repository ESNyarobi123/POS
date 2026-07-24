/**
 * Shared env loader stub — reads process.env only.
 * Keys mirror root `.env.example`. Do not invent production secrets.
 */

export type AppEnv = {
  NODE_ENV: string;
  WEB_URL: string;
  API_URL: string;
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_BUCKET: string;
  S3_REGION: string;
  GULIOSMART_API_URL: string;
  GULIOSMART_WEBHOOK_SECRET: string;
  FISCAL_PROVIDER: string;
};

function required(env: NodeJS.ProcessEnv, key: string, fallback?: string): string {
  const value = env[key] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, key: string, fallback = ""): string {
  return env[key] ?? fallback;
}

/**
 * Load application environment from `process.env` (or an injected map).
 * In development, callers typically load `.env` into the process before this runs.
 */
export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = optional(env, "NODE_ENV", "development");
  const isProd = nodeEnv === "production";

  return {
    NODE_ENV: nodeEnv,
    WEB_URL: optional(env, "WEB_URL", "http://localhost:3000"),
    API_URL: optional(env, "API_URL", "http://localhost:4000"),
    API_PORT: Number(optional(env, "API_PORT", "4000")),
    DATABASE_URL: isProd
      ? required(env, "DATABASE_URL")
      : optional(
          env,
          "DATABASE_URL",
          "postgresql://gulio:gulio@localhost:5432/guliosmart_pos?schema=public",
        ),
    REDIS_URL: optional(env, "REDIS_URL", "redis://localhost:6379"),
    JWT_SECRET: isProd
      ? required(env, "JWT_SECRET")
      : optional(env, "JWT_SECRET", "change-me-in-production"),
    JWT_EXPIRES_IN: optional(env, "JWT_EXPIRES_IN", "8h"),
    S3_ENDPOINT: optional(env, "S3_ENDPOINT", "http://localhost:9000"),
    S3_ACCESS_KEY: optional(env, "S3_ACCESS_KEY", "minioadmin"),
    S3_SECRET_KEY: optional(env, "S3_SECRET_KEY", "minioadmin"),
    S3_BUCKET: optional(env, "S3_BUCKET", "guliosmart-pos"),
    S3_REGION: optional(env, "S3_REGION", "us-east-1"),
    GULIOSMART_API_URL: optional(env, "GULIOSMART_API_URL"),
    GULIOSMART_WEBHOOK_SECRET: optional(env, "GULIOSMART_WEBHOOK_SECRET"),
    FISCAL_PROVIDER: optional(env, "FISCAL_PROVIDER", "mock"),
  };
}

export function getEnv(): AppEnv {
  return loadEnv();
}
