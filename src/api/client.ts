import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type { ApiErrorBody } from "./types";

export const client = createClient<paths>({ baseUrl: "/" });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

const CODES = ["VALIDATION", "UNAUTHORIZED", "CODE_INVALID", "RATE_LIMITED", "NOT_FOUND", "INTERNAL"];

function toErrorBody(value: unknown, status: number): ApiErrorBody {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error &&
    typeof value.error.message === "string" &&
    "code" in value.error &&
    CODES.includes(String(value.error.code))
  ) {
    return value as ApiErrorBody;
  }
  return { error: { code: "INTERNAL", message: `HTTP ${status}` } };
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** 解包 openapi-fetch 结果：非 2xx 抛 ApiError；204 返回 undefined */
export async function unwrap<T>(p: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok || error !== undefined) throw new ApiError(response.status, toErrorBody(error, response.status));
  return data as T;
}
