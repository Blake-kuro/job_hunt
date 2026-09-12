import { ZodError, type ZodType } from "zod";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => {
    throw new ZodError([{ code: "custom", path: [], message: "请求体不是合法 JSON", input: undefined }]);
  });
  return schema.parse(body);
}

export function readQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return schema.parse(params);
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: { code: "VALIDATION", message: "参数校验失败", issues: err.issues } }, { status: 400 });
    }
    if (err instanceof NotFoundError) {
      return json({ error: { code: "NOT_FOUND", message: err.message } }, { status: 404 });
    }
    console.error(err);
    return json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, { status: 500 });
  }
}
