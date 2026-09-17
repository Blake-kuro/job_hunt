import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type { ApiErrorBody, ApiErrorCode } from "./types";

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

/** 由 ApiErrorCode 类型驱动：数组里写错 code 或（见下方 Missing 检查）漏写 code 都会编译报错 */
const CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CODE_INVALID",
  "RATE_LIMITED",
  "NOT_FOUND",
  "INTERNAL",
] as const satisfies readonly ApiErrorCode[];
// 穷尽性检查：ApiErrorCode 里有而 CODES 漏掉的成员会让 Missing 非 never，下面的赋值随即报错
type Missing = Exclude<ApiErrorCode, (typeof CODES)[number]>;
const _exhaustive: [Missing] extends [never] ? true : never = true;
void _exhaustive;

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
    (CODES as readonly string[]).includes(String(value.error.code))
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
