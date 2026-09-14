import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { prisma } from "./db";
import type { Env } from "./env";
import { AppError } from "./lib/errors";
import { smsSender } from "./services/sms";
import { loadUserAccess } from "./services/users";

export const DEV_USER_EMAIL = "dev@local";
export const SESSION_COOKIE = "job_hunt_session";
export const DEVICE_COOKIE = "job_hunt_device";
const CODE_TTL_SECONDS = 5 * 60;
const SEND_COOLDOWN_SECONDS = 60;
const SEND_LIMIT_PER_HOUR = 5;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60;
const MAX_CODE_ATTEMPTS = 5;
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax" as const,
  path: "/api",
};

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

export async function verifyLoginCode(phone: string, code: string, guestUserId: string | null) {
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
      // 手机号首次登录：优先挂到当前游客（其收藏/作答原地保留），否则新建用户
      const guest = guestUserId
        ? await tx.user.findFirst({
            where: { id: guestUserId, identities: { none: { provider: "PHONE" } } },
            select: { id: true },
          })
        : null;
      const userId = guest
        ? (
            await tx.user.update({
              where: { id: guest.id },
              data: { name: `用户${phone.slice(-4)}` },
              select: { id: true },
            })
          ).id
        : (await tx.user.create({ data: { name: `用户${phone.slice(-4)}` }, select: { id: true } })).id;
      identity = await tx.authIdentity.create({ data: { userId, provider: "PHONE", providerKey: phone } });
    }
    const adminPhones = (process.env.ADMIN_PHONE_NUMBERS ?? "").split(",").map((value) => value.trim());
    if (adminPhones.includes(phone)) {
      await tx.user.update({ where: { id: identity.userId }, data: { role: "ADMIN", enabled: true } });
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
  setCookie(c, SESSION_COOKIE, token, { ...cookieOpts, maxAge: SESSION_TTL_SECONDS });
}

/** 退出：删会话；同时销毁当前游客身份（否则已挂上手机号的那行会被按 device 找回、误判 FREE） */
export async function clearSession(c: Parameters<typeof deleteCookie>[0]) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  deleteCookie(c, SESSION_COOKIE, cookieOpts);

  const device = getCookie(c, DEVICE_COOKIE);
  if (device) {
    const key = sha256(device);
    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerKey: { provider: "DEVICE", providerKey: key } },
      select: { id: true, userId: true },
    });
    if (identity) {
      await prisma.authIdentity.delete({ where: { id: identity.id } });
      // 纯游客（没有别的身份）连同数据一起删，避免孤儿行
      await prisma.user.deleteMany({ where: { id: identity.userId, identities: { none: {} } } });
    }
  }
  deleteCookie(c, DEVICE_COOKIE, cookieOpts);
}

type CookieContext = Parameters<typeof getCookie>[0];

/** 有效会话对应的 userId；过期会话顺手删掉 */
async function sessionUserId(c: CookieContext): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { tokenHash: session.tokenHash } });
    return null;
  }
  return session.userId;
}

/** device cookie 对应的游客 userId；没有或找不到 → null（不创建） */
export async function findDeviceUserId(c: CookieContext): Promise<string | null> {
  const device = getCookie(c, DEVICE_COOKIE);
  if (!device) return null;
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerKey: { provider: "DEVICE", providerKey: sha256(device) } },
    select: { userId: true },
  });
  return identity?.userId ?? null;
}

/** 新建游客 + DEVICE 身份，并写 cookie */
async function createDeviceUser(c: Parameters<typeof setCookie>[0]): Promise<string> {
  const device = randomBytes(32).toString("base64url");
  const user = await prisma.user.create({
    data: { name: "游客", identities: { create: { provider: "DEVICE", providerKey: sha256(device) } } },
    select: { id: true },
  });
  setCookie(c, DEVICE_COOKIE, device, { ...cookieOpts, maxAge: DEVICE_TTL_SECONDS });
  return user.id;
}

/** 每个请求都有用户：会话 → 游客 → 新建游客；并注入档位 */
export const requestUser = createMiddleware<Env>(async (c, next) => {
  const userId = (await sessionUserId(c)) ?? (await findDeviceUserId(c)) ?? (await createDeviceUser(c));
  const { access, enabled, role } = await loadUserAccess(userId);
  if (!enabled) throw new AppError(403, "FORBIDDEN", "账号权限已停用，请联系管理员");
  c.set("userId", userId);
  c.set("access", access);
  c.set("role", role);
  await next();
});
