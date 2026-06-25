"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getUserId(): number | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem("kvp.userId");
  return id ? Number(id) : null;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const userId = getUserId();
  if (userId !== null) headers["X-User-Id"] = String(userId);

  const init: RequestInit = {
    ...options,
    headers,
    body:
      options.body !== undefined && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : (options.body as BodyInit | undefined),
  };
  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
    init.body = options.body;
  }

  const res = await fetch(`${API_BASE}${path}`, init);
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "detail" in data
        ? (data as { detail: string }).detail
        : null) ||
      (typeof data === "string" ? data : `HTTP ${res.status}`);
    throw new ApiError(res.status, String(message), data);
  }
  return data as T;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  return api<T>(path, { method: "POST", body: fd });
}
