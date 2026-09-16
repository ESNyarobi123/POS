import { Prisma } from "@gulio/database";
import type { OpticEdgeChannelDto } from "@gulio/contracts";

export class OpticEdgeTransportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpticEdgeTransportError";
  }
}

export type OpticEdgeClientConfig = {
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
};

export type OpticEdgeCashInRequest = {
  reference: string;
  channelId: number;
  amount: Prisma.Decimal;
  description: string;
  saleDate: string;
  metadata: Record<string, unknown>;
};

export type OpticEdgeCashInResult = {
  id: number | null;
  reference: string;
  replayed: boolean;
  amount: string;
  netAmount: string;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOpticEdgeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function toWholeTzsAmount(amount: Prisma.Decimal): number {
  if (amount.isNaN() || !amount.isFinite() || amount.lte(0)) {
    throw new Error("Cash-in amount must be a positive TZS total");
  }
  const whole = amount.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const n = Number(whole.toFixed(0));
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error("Cash-in amount is not a safe TZS integer");
  }
  return n;
}

export function parseOpticEdgeChannel(
  raw: unknown,
): OpticEdgeChannelDto | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = Number(rec.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const name = asString(rec.name);
  if (!name) return null;
  const type = asString(rec.type).toLowerCase() || "other";
  const currency = asString(rec.currency) || "TZS";
  return { id, name, type, currency };
}

export function parseOpticEdgeChannels(payload: unknown): OpticEdgeChannelDto[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(payload)
      ? payload
      : [];
  const channels: OpticEdgeChannelDto[] = [];
  for (const item of list) {
    const channel = parseOpticEdgeChannel(item);
    if (channel) channels.push(channel);
  }
  return channels;
}

/** POS CASH maps to the OpticEdge till with type=cash (name "Cash" in the live API). */
export function pickOpticEdgeCashChannel(
  channels: OpticEdgeChannelDto[],
): OpticEdgeChannelDto | null {
  return (
    channels.find((c) => c.type === "cash") ??
    channels.find((c) => /^cash$/i.test(c.name.trim())) ??
    channels.find((c) => /cash/i.test(c.name)) ??
    null
  );
}

export function eatCalendarDate(date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const y = eat.getUTCFullYear();
  const m = String(eat.getUTCMonth() + 1).padStart(2, "0");
  const d = String(eat.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export class OpticEdgeClient {
  constructor(private readonly config: OpticEdgeClientConfig) {}

  async listChannels(): Promise<OpticEdgeChannelDto[]> {
    const json = await this.request("GET", "/api/v1/channels");
    return parseOpticEdgeChannels(json);
  }

  async createCashIn(
    input: OpticEdgeCashInRequest,
  ): Promise<OpticEdgeCashInResult> {
    const amount = toWholeTzsAmount(input.amount);
    const json = await this.request("POST", "/api/v1/cash-ins", {
      reference: input.reference,
      channel_id: input.channelId,
      amount,
      description: input.description,
      sale_date: input.saleDate,
      branch_id: null,
      metadata: input.metadata,
    });
    const data = asRecord(asRecord(json)?.data) ?? asRecord(json) ?? {};
    const idRaw = data.id;
    const id =
      typeof idRaw === "number" && Number.isInteger(idRaw) ? idRaw : null;
    return {
      id,
      reference: asString(data.reference) || input.reference,
      replayed: data.replayed === true,
      amount: asString(data.amount) || String(amount),
      netAmount: asString(data.net_amount) || String(amount),
      raw: data,
    };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const base = normalizeOpticEdgeBaseUrl(this.config.baseUrl);
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timeout = this.config.timeoutMs ?? 15_000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          parsed = { message: text.slice(0, 280) };
        }
      }
      if (!response.ok) {
        const rec = asRecord(parsed);
        const message =
          asString(rec?.message) ||
          asString(rec?.error) ||
          `OpticEdge ${method} ${path} failed (${response.status})`;
        throw new OpticEdgeTransportError(message, response.status);
      }
      return parsed;
    } catch (err) {
      if (err instanceof OpticEdgeTransportError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new OpticEdgeTransportError("OpticEdge request timed out");
      }
      throw new OpticEdgeTransportError(
        err instanceof Error ? err.message : "OpticEdge request failed",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
