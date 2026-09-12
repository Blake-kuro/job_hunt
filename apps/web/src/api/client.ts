import type { AppType } from "@job-hunt/api";
import type { ApiErrorBody } from "@job-hunt/shared";
import { type ClientResponse, hc } from "hono/client";

export const api = hc<AppType>("/");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

/** 解包 RPC 响应：非 2xx 抛 ApiError；204 返回 undefined */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S>
    ? S extends import("hono/utils/http-status").SuccessStatusCode
      ? T
      : never
    : never;

export async function unwrap<R extends ClientResponse<unknown>>(req: Promise<R>): Promise<SuccessBody<R>> {
  const res = await req;
  if (!res.ok) {
    const value: unknown = await res.json().catch(() => null);
    const body =
      value &&
      typeof value === "object" &&
      "error" in value &&
      value.error &&
      typeof value.error === "object" &&
      "message" in value.error &&
      typeof value.error.message === "string" &&
      "code" in value.error &&
      ["VALIDATION", "NOT_FOUND", "INTERNAL"].includes(String(value.error.code))
        ? (value as ApiErrorBody)
        : { error: { code: "INTERNAL" as const, message: `HTTP ${res.status}` } };
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as SuccessBody<R>;
  return (await res.json()) as SuccessBody<R>;
}
