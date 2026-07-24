/** Browser fetch wrapper for NestJS API — Bearer token from localStorage. */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4010";

export const TOKEN_STORAGE_KEY = "gulio_access_token";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredToken(): string | null {
  return readToken();
}

function nestMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const msg = (body as { message?: unknown }).message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map(String).join(", ");
  if (msg && typeof msg === "object") {
    const nested = msg as { message?: unknown; code?: unknown };
    if (typeof nested.message === "string") return nested.message;
    if (typeof nested.code === "string") return nested.code;
  }
  return "Request failed";
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Skip Authorization header (e.g. login). */
  auth?: boolean;
  /** Extra headers (Idempotency-Key, etc.). */
  headers?: HeadersInit;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = true, headers: extraHeaders, ...init } = options;
  const headers = new Headers(extraHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = readToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, `Cannot reach API at ${API_BASE_URL}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, nestMessage(parsed), parsed);
  }

  return parsed as T;
}
