import { z } from "@hono/zod-openapi";
import { UserSchema } from "./user";

export const PhoneSchema = z
  .string()
  .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号")
  .openapi({ example: "13800138000" });

export const SendSmsBodySchema = z.object({ phone: PhoneSchema }).openapi("SendSmsBody");
export const SendSmsResultSchema = z
  .object({
    expiresIn: z.number().int(),
    retryAfter: z.number().int(),
    developmentCode: z.string().optional(),
  })
  .openapi("SendSmsResult");

export const VerifySmsBodySchema = z
  .object({ phone: PhoneSchema, code: z.string().regex(/^\d{6}$/, "验证码为 6 位数字") })
  .openapi("VerifySmsBody");

export const AuthResultSchema = z.object({ user: UserSchema }).openapi("AuthResult");
