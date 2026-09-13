export type ApiErrorCode = "VALIDATION" | "NOT_FOUND" | "INTERNAL";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; issues?: unknown[] };
}
