import { createHmac, timingSafeEqual } from "node:crypto";

export class SelcomTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelcomTransportError";
  }
}

export type SelcomJson = Record<string, unknown>;

export type SelcomClientConfig = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs?: number;
};

function selcomString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value);
}

function eatIsoSeconds(date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const y = eat.getUTCFullYear();
  const m = String(eat.getUTCMonth() + 1).padStart(2, "0");
  const d = String(eat.getUTCDate()).padStart(2, "0");
  const hh = String(eat.getUTCHours()).padStart(2, "0");
  const mm = String(eat.getUTCMinutes()).padStart(2, "0");
  const ss = String(eat.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+03:00`;
}

export function encodeSelcomUrl(url: string): string {
  return Buffer.from(url, "utf8").toString("base64");
}

export function buildSelcomHeaders(input: {
  payload: Record<string, unknown>;
  signedFields: string[];
  apiKey: string;
  apiSecret: string;
  timestamp: string;
}): Record<string, string> {
  const missing = input.signedFields.filter((field) => !(field in input.payload));
  if (missing.length > 0) {
    throw new Error(`Missing signed fields: ${missing.join(", ")}`);
  }

  let signingString = `timestamp=${input.timestamp}`;
  for (const field of input.signedFields) {
    signingString += `&${field}=${selcomString(input.payload[field])}`;
  }

  const digest = createHmac("sha256", input.apiSecret)
    .update(signingString, "utf8")
    .digest("base64");

  const encodedKey = Buffer.from(input.apiKey, "ascii").toString("base64");

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `SELCOM ${encodedKey}`,
    "Digest-Method": "HS256",
    Digest: digest,
    Timestamp: input.timestamp,
    "Signed-Fields": input.signedFields.join(","),
  };
}

export function verifySelcomHmac(input: {
  payload: Record<string, unknown>;
  apiSecret: string;
  timestamp: string;
  digest: string;
  signedFieldsHeader: string;
  maxAgeSeconds?: number;
}): boolean {
  const fields = input.signedFieldsHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (fields.length === 0 || new Set(fields).size !== fields.length) {
    return false;
  }
  if (fields.some((field) => !(field in input.payload))) {
    return false;
  }

  try {
    const parsed = new Date(input.timestamp.replace("Z", "+00:00"));
    if (Number.isNaN(parsed.getTime())) return false;
    const age = Math.abs(Date.now() - parsed.getTime()) / 1000;
    if (age > (input.maxAgeSeconds ?? 300)) return false;
  } catch {
    return false;
  }

  const expected = buildSelcomHeaders({
    payload: input.payload,
    signedFields: fields,
    apiKey: "unused",
    apiSecret: input.apiSecret,
    timestamp: input.timestamp,
  }).Digest;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.digest, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifySelcomAuthorization(
  authorization: string,
  apiKey: string,
): boolean {
  const expected = `SELCOM ${Buffer.from(apiKey, "ascii").toString("base64")}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(authorization, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class SelcomClient {
  constructor(private readonly config: SelcomClientConfig) {}

  headers(
    payload: Record<string, unknown>,
    signedFields: string[],
    timestamp?: string,
  ): Record<string, string> {
    return buildSelcomHeaders({
      payload,
      signedFields,
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      timestamp: timestamp ?? eatIsoSeconds(),
    });
  }

  async request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    payload: Record<string, unknown>,
    signedFields?: string[],
  ): Promise<SelcomJson> {
    const fields = signedFields ?? Object.keys(payload);
    const headers = this.headers(payload, fields);
    const base = this.config.baseUrl.replace(/\/$/, "");
    let url = `${base}${path}`;
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    };

    if (method === "GET" || method === "DELETE") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        params.set(key, selcomString(value));
      }
      url = `${url}?${params.toString()}`;
    } else {
      init.body = JSON.stringify(payload);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      throw new SelcomTransportError(
        err instanceof Error ? err.message : "Selcom request outcome is unknown",
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new SelcomTransportError(
        `Selcom returned invalid JSON (HTTP ${response.status})`,
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SelcomTransportError("Unexpected Selcom response shape");
    }
    const rec = body as SelcomJson;
    if (!response.ok && rec.resultcode == null) {
      const message =
        typeof rec.message === "string" && rec.message.trim()
          ? rec.message.trim()
          : `Selcom HTTP error: ${response.status}`;
      throw new SelcomTransportError(message);
    }
    return rec;
  }

  createMinimalOrder(data: Record<string, unknown>) {
    return this.request("POST", "/v1/checkout/create-order-minimal", data, [
      "vendor",
      "order_id",
      "buyer_email",
      "buyer_name",
      "buyer_phone",
      "amount",
      "currency",
      "redirect_url",
      "cancel_url",
      "webhook",
      "buyer_remarks",
      "merchant_remarks",
      "no_of_items",
    ]);
  }

  walletPayment(input: { transid: string; orderId: string; msisdn: string }) {
    const data = {
      transid: input.transid,
      order_id: input.orderId,
      msisdn: input.msisdn,
    };
    return this.request("POST", "/v1/checkout/wallet-payment", data, [
      "transid",
      "order_id",
      "msisdn",
    ]);
  }

  orderStatus(orderId: string) {
    return this.request(
      "GET",
      "/v1/checkout/order-status",
      { order_id: orderId },
      ["order_id"],
    );
  }
}
