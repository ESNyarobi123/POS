import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, Logger } from "@nestjs/common";
import { getEnv } from "@gulio/config";
import sharp from "sharp";
import {
  isDataImageUrl,
  isManagedCatalogImageUrl,
  parseDataImage,
} from "./catalog-image";

const WEBP_TYPE = "image/webp";
const MAX_EDGE = 480;
const FETCH_TIMEOUT_MS = 12_000;
const S3_TIMEOUT_MS = 2_000;
const REMOTE_SLOTS = 3;

export type PreparedImage = {
  buffer: Buffer;
  contentType: string;
};

@Injectable()
export class MediaService {
  private readonly log = new Logger(MediaService.name);
  private s3: S3Client | null = null;
  private bucketReady = false;
  private s3Disabled = false;
  private bucketPromise: Promise<void> | null = null;
  private remoteActive = 0;
  private readonly remoteWait: Array<() => void> = [];
  private readonly inflight = new Map<string, Promise<PreparedImage>>();
  private readonly diskDir = join(tmpdir(), "guliosmart-media");

  private client(): S3Client {
    if (this.s3) return this.s3;
    const env = getEnv();
    this.s3 = new S3Client({
      region: env.S3_REGION || "us-east-1",
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
    return this.s3;
  }

  async toWebp(input: Buffer): Promise<Buffer> {
    return sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();
  }

  async loadSource(raw: string): Promise<Buffer> {
    const trimmed = raw.trim();
    if (isDataImageUrl(trimmed)) {
      return parseDataImage(trimmed).buffer;
    }
    if (isManagedCatalogImageUrl(trimmed)) {
      throw new Error("Refusing to fetch a proxied catalog image URL");
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error("Unsupported image source");
    }
    return this.withRemoteSlot(() => this.fetchRemote(trimmed));
  }

  cacheKeyFor(kind: string, id: string, raw: string): string {
    const hash = createHash("sha1").update(raw).digest("hex").slice(0, 16);
    return `${kind}/${id}-${hash}.webp`;
  }

  async getCached(key: string): Promise<Buffer | null> {
    const diskPath = join(this.diskDir, key.split("/").join("_"));
    try {
      return await readFile(diskPath);
    } catch {
      /* miss */
    }
    if (this.s3Disabled) return null;
    try {
      await this.ensureBucket();
      const env = getEnv();
      const out = await this.withTimeout(
        this.client().send(
          new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
        ),
        S3_TIMEOUT_MS,
        "s3 get",
      );
      const bytes = await out.Body?.transformToByteArray();
      if (!bytes) return null;
      const buffer = Buffer.from(bytes);
      await this.writeDisk(key, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  async putCached(key: string, buffer: Buffer): Promise<void> {
    await this.writeDisk(key, buffer);
    if (this.s3Disabled) return;
    try {
      await this.ensureBucket();
      const env = getEnv();
      await this.withTimeout(
        this.client().send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: WEBP_TYPE,
            CacheControl: "public, max-age=604800",
          }),
        ),
        S3_TIMEOUT_MS,
        "s3 put",
      );
    } catch (err) {
      this.log.warn(
        `MinIO cache skip: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  async prepareFromRaw(raw: string, cacheKey: string): Promise<PreparedImage> {
    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;
    const job = this.prepareUncached(raw, cacheKey).finally(() => {
      this.inflight.delete(cacheKey);
    });
    this.inflight.set(cacheKey, job);
    return job;
  }

  private async prepareUncached(
    raw: string,
    cacheKey: string,
  ): Promise<PreparedImage> {
    const cached = await this.getCached(cacheKey);
    if (cached) {
      return { buffer: cached, contentType: WEBP_TYPE };
    }
    const source = await this.loadSource(raw);
    const webp = await this.toWebp(source);
    await this.putCached(cacheKey, webp);
    return { buffer: webp, contentType: WEBP_TYPE };
  }

  private async fetchRemote(url: string): Promise<Buffer> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          "User-Agent": "GulioSmartPOS/1.0",
        },
      });
      if (!res.ok) {
        throw new Error(`Image fetch failed (${res.status})`);
      }
      const mime = (res.headers.get("content-type") ?? "").toLowerCase();
      if (mime && !mime.startsWith("image/") && !mime.includes("octet-stream")) {
        throw new Error(`Not an image (${mime})`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > 8 * 1024 * 1024) {
        throw new Error("Image too large");
      }
      return bytes;
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRemoteSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.remoteActive >= REMOTE_SLOTS) {
      await new Promise<void>((resolve) => this.remoteWait.push(resolve));
    }
    this.remoteActive += 1;
    try {
      return await fn();
    } finally {
      this.remoteActive -= 1;
      this.remoteWait.shift()?.();
    }
  }

  private async writeDisk(key: string, buffer: Buffer): Promise<void> {
    await mkdir(this.diskDir, { recursive: true });
    await writeFile(join(this.diskDir, key.split("/").join("_")), buffer);
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady || this.s3Disabled) return;
    if (!this.bucketPromise) {
      this.bucketPromise = this.connectBucket().finally(() => {
        this.bucketPromise = null;
      });
    }
    await this.bucketPromise;
  }

  private async connectBucket(): Promise<void> {
    if (this.bucketReady || this.s3Disabled) return;
    const env = getEnv();
    if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
      this.s3Disabled = true;
      return;
    }
    try {
      const s3 = this.client();
      try {
        await this.withTimeout(
          s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET })),
          S3_TIMEOUT_MS,
          "s3 head",
        );
      } catch {
        await this.withTimeout(
          s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })),
          S3_TIMEOUT_MS,
          "s3 create",
        );
      }
      this.bucketReady = true;
    } catch (err) {
      this.s3Disabled = true;
      this.log.warn(
        `MinIO unavailable, using disk cache only: ${
          err instanceof Error ? err.message : "error"
        }`,
      );
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
