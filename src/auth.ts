import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { prisma } from "./db";
import type { Env } from "./env";
import { AppError } from "./lib/errors";
import { smsSender } from "./services/sms";
import { getCurrentUser } from "./services/users";

export const DEV_USER_EMAIL = "dev@local";
export const SESSION_COOKIE = "job_hunt_session";
const CODE_TTL_SECONDS = 5 * 60;
const SEND_COOLDOWN_SECONDS = 60;
const SEND_LIMIT_PER_HOUR = 5;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_CODE_ATTEMPTS = 5;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const codeSecret = () => {
  const secret = process.env.AUTH_CODE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("生产环境必须配置 AUTH_CODE_SECRET");
  return "job-hunt-local-development-only";
};
const hashCode = (phone: string, code: string) =>
  createHmac("sha256", codeSecret()).update(`${phone}:${code}`).digest();

export async function sendLoginCode(phone: string) {
  const latest = await prisma.smsVerification.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (latest) {
    const elapsed = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
    if (elapsed < SEND_COOLDOWN_SECONDS) {
      throw new AppError(429, "RATE_LIMITED", `请在 ${SEND_COOLDOWN_SECONDS - elapsed} 秒后重试`);
    }
  }
  const recentCount = await prisma.smsVerification.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentCount >= SEND_LIMIT_PER_HOUR) {
    throw new AppError(429, "RATE_LIMITED", "验证码请求过于频繁，请一小时后重试");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const verification = await prisma.$transaction(async (tx) => {
    await tx.smsVerification.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } });
    return tx.smsVerification.create({
      data: {
        phone,
        codeHash: hashCode(phone, code).toString("hex"),
        expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
      },
    });
  });
  try {
    await smsSender.sendLoginCode(phone, code);
  } catch (error) {
    await prisma.smsVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } });
    throw error;
  }
  return {
    expiresIn: CODE_TTL_SECONDS,
    retryAfter: SEND_COOLDOWN_SECONDS,
    ...(process.env.NODE_ENV !== "production" ? { developmentCode: code } : {}),
  };
}

export async function verifyLoginCode(phone: string, code: string) {
  const verification = await prisma.smsVerification.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!verification || verification.expiresAt <= new Date() || verification.attempts >= MAX_CODE_ATTEMPTS) {
    throw new AppError(400, "CODE_INVALID", "验证码无效或已过期，请重新获取");
  }
  const actual = Buffer.from(verification.codeHash, "hex");
  const expected = hashCode(phone, code);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    await prisma.smsVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
    throw new AppError(400, "CODE_INVALID", "验证码错误");
  }
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.smsVerification.updateMany({
      where: { id: verification.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AppError(400, "CODE_INVALID", "验证码已使用，请重新获取");
    let identity = await tx.authIdentity.findUnique({
      where: { provider_providerKey: { provider: "PHONE", providerKey: phone } },
    });
    if (!identity) {
      const user = await tx.user.create({ data: { name: `用户${phone.slice(-4)}` } });
      identity = await tx.authIdentity.create({ data: { userId: user.id, provider: "PHONE", providerKey: phone } });
    }
    const token = randomBytes(32).toString("base64url");
    await tx.session.create({
      data: {
        tokenHash: sha256(token),
        userId: identity.userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
    return { token, userId: identity.userId };
  });
}

export function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/api",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(c: Parameters<typeof deleteCookie>[0]) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  deleteCookie(c, SESSION_COOKIE, { path: "/api", secure: process.env.NODE_ENV === "production", sameSite: "Lax" });
}

export async function authenticatedUser(c: Parameters<typeof getCookie>[0]) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw new AppError(401, "UNAUTHORIZED", "请先登录");
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { tokenHash: session.tokenHash } });
    throw new AppError(401, "UNAUTHORIZED", "登录状态已过期，请重新登录");
  }
  return getCurrentUser(session.userId);
}

export const requestUser = createMiddleware<Env>(async (c, next) => {
  const user = await authenticatedUser(c);
  c.set("userId", user.id);
  await next();
});
