import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { clearSession, sendLoginCode, setSessionCookie, verifyLoginCode } from "../auth";
import {
  ApiErrorSchema,
  AuthResultSchema,
  SendSmsBodySchema,
  SendSmsResultSchema,
  VerifySmsBodySchema,
} from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getCurrentUser } from "../services/users";

const jsonContent = (schema: typeof ApiErrorSchema) => ({ "application/json": { schema } });

const sendSms = createRoute({
  method: "post",
  path: "/sms/send",
  tags: ["auth"],
  operationId: "sendLoginSms",
  request: { body: { required: true, content: { "application/json": { schema: SendSmsBodySchema } } } },
  responses: {
    200: { description: "验证码已发送", content: { "application/json": { schema: SendSmsResultSchema } } },
    400: { description: "手机号格式无效", content: jsonContent(ApiErrorSchema) },
    429: { description: "发送过于频繁", content: jsonContent(ApiErrorSchema) },
  },
});

const verifySms = createRoute({
  method: "post",
  path: "/sms/verify",
  tags: ["auth"],
  operationId: "verifyLoginSms",
  request: { body: { required: true, content: { "application/json": { schema: VerifySmsBodySchema } } } },
  responses: {
    200: { description: "登录成功", content: { "application/json": { schema: AuthResultSchema } } },
    400: { description: "验证码无效", content: jsonContent(ApiErrorSchema) },
  },
});

const logout = createRoute({
  method: "post",
  path: "/logout",
  tags: ["auth"],
  operationId: "logout",
  responses: { 204: { description: "已退出登录" } },
});

export const authRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(sendSms, async (c) => c.json(await sendLoginCode(c.req.valid("json").phone), 200))
  .openapi(verifySms, async (c) => {
    const { phone, code } = c.req.valid("json");
    const { token, userId } = await verifyLoginCode(phone, code);
    setSessionCookie(c, token);
    return c.json({ user: await getCurrentUser(userId) }, 200);
  })
  .openapi(logout, async (c) => {
    await clearSession(c);
    return c.body(null, 204);
  });
