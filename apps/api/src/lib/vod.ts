import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * 腾讯云 VOD：上传签名 / 播放签名 / 媒体信息 / 回调 token。
 *
 * - `VOD_MOCK=1` 或缺少 `VOD_SECRET_ID` 时走 mock：签名是固定假值，`fetchMediaInfo` 直接返回 READY。
 * - 真实签名算法见 https://cloud.tencent.com/document/product/266/9221（上传）与
 *   https://cloud.tencent.com/document/product/266/45554（超级播放器签名）；纯函数 `buildUploadSignature`
 *   / `buildPlaySignature` 不读环境变量，便于用固定输入做快照测试。
 * - SDK `tencentcloud-sdk-nodejs-vod` 只在 `fetchMediaInfo` 里按需加载，mock 下不会 import。
 */

export type VodMediaStatus = "PROCESSING" | "READY" | "FAILED";
export interface VodMediaInfo {
  status: VodMediaStatus;
  durationSeconds: number | null;
  coverUrl: string | null;
}

const UPLOAD_TTL_SECONDS = 60 * 60;
const PLAY_TTL_SECONDS = 2 * 60 * 60;
/** mock 下 `VOD_CALLBACK_TOKEN` 未配置时接受的回调 token */
export const MOCK_CALLBACK_TOKEN = "mock-callback";

export function isMock(): boolean {
  return process.env.VOD_MOCK === "1" || !process.env.VOD_SECRET_ID;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}（或设置 VOD_MOCK=1 走 mock）`);
  return value;
}

// ── 纯函数 ──

export interface UploadSignatureInput {
  secretId: string;
  secretKey: string;
  /** Unix 秒 */
  now: number;
  /** 有效期，秒 */
  ttlSeconds: number;
  random: number;
  procedure?: string;
  classId?: number;
  sourceContext?: string;
}

/** 客户端上传签名：`base64(HMAC-SHA1(secretKey, query) + query)` */
export function buildUploadSignature(input: UploadSignatureInput): string {
  const params: [string, string | number][] = [
    ["secretId", input.secretId],
    ["currentTimeStamp", input.now],
    ["expireTime", input.now + input.ttlSeconds],
    ["random", input.random],
  ];
  if (input.classId !== undefined) params.push(["classId", input.classId]);
  if (input.procedure) params.push(["procedure", input.procedure]);
  if (input.sourceContext) params.push(["sourceContext", input.sourceContext]);
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  const hmac = createHmac("sha1", input.secretKey).update(query).digest();
  return Buffer.concat([hmac, Buffer.from(query, "utf8")]).toString("base64");
}

export interface PlaySignatureInput {
  appId: number;
  fileId: string;
  playKey: string;
  /** Unix 秒 */
  now: number;
  ttlSeconds: number;
}

const base64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

/** 超级播放器签名：HS256 JWT，payload `{ appId, fileId, currentTimeStamp, expireTimeStamp, urlAccessInfo: { t } }` */
export function buildPlaySignature(input: PlaySignatureInput): string {
  const expire = input.now + input.ttlSeconds;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      appId: input.appId,
      fileId: input.fileId,
      currentTimeStamp: input.now,
      expireTimeStamp: expire,
      urlAccessInfo: { t: expire.toString(16) },
    }),
  );
  const signature = base64url(createHmac("sha256", input.playKey).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

/** 常量时间比较（长度不同直接 false） */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

// ── 对外接口（读环境变量） ──

const nowSeconds = () => Math.floor(Date.now() / 1000);
const isoAfter = (now: number, ttl: number) => new Date((now + ttl) * 1000).toISOString();

export function signUpload(): { signature: string; expiresAt: string } {
  const now = nowSeconds();
  const expiresAt = isoAfter(now, UPLOAD_TTL_SECONDS);
  if (isMock()) return { signature: "mock-upload", expiresAt };
  const signature = buildUploadSignature({
    secretId: requireEnv("VOD_SECRET_ID"),
    secretKey: requireEnv("VOD_SECRET_KEY"),
    now,
    ttlSeconds: UPLOAD_TTL_SECONDS,
    random: randomInt(0, 2 ** 31),
    procedure: process.env.VOD_PROCEDURE || undefined,
  });
  return { signature, expiresAt };
}

export function signPlay(fileId: string): { appId: string; fileId: string; psign: string; expiresAt: string } {
  const now = nowSeconds();
  const expiresAt = isoAfter(now, PLAY_TTL_SECONDS);
  if (isMock()) return { appId: process.env.VOD_APP_ID || "0", fileId, psign: "mock-play", expiresAt };
  const appId = requireEnv("VOD_APP_ID");
  const psign = buildPlaySignature({
    appId: Number(appId),
    fileId,
    playKey: requireEnv("VOD_PLAY_KEY"),
    now,
    ttlSeconds: PLAY_TTL_SECONDS,
  });
  return { appId, fileId, psign, expiresAt };
}

/** 回调 `?token=` 校验；mock 且未配置 `VOD_CALLBACK_TOKEN` 时接受 `MOCK_CALLBACK_TOKEN` */
export function verifyCallbackToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = process.env.VOD_CALLBACK_TOKEN || (isMock() ? MOCK_CALLBACK_TOKEN : undefined);
  return expected !== undefined && safeEqual(token, expected);
}

/** 查 VOD 媒体信息（`DescribeMediaInfos`），用于回调不通时手动刷新 */
export async function fetchMediaInfo(fileId: string): Promise<VodMediaInfo> {
  if (isMock()) return { status: "READY", durationSeconds: 600, coverUrl: null };
  const { vod } = await import("tencentcloud-sdk-nodejs-vod");
  const client = new vod.v20180717.Client({
    credential: { secretId: requireEnv("VOD_SECRET_ID"), secretKey: requireEnv("VOD_SECRET_KEY") },
    region: "",
    profile: { httpProfile: { endpoint: "vod.tencentcloudapi.com" } },
  });
  const subAppId = process.env.VOD_SUB_APP_ID ? Number(process.env.VOD_SUB_APP_ID) : undefined;
  const res = await client.DescribeMediaInfos({ FileIds: [fileId], ...(subAppId && { SubAppId: subAppId }) });
  const media = res.MediaInfoSet?.[0];
  if (!media) return { status: "FAILED", durationSeconds: null, coverUrl: null };
  const duration = media.MetaData?.Duration;
  const hasStream =
    (media.AdaptiveDynamicStreamingInfo?.AdaptiveDynamicStreamingSet?.length ?? 0) > 0 ||
    (media.TranscodeInfo?.TranscodeSet?.length ?? 0) > 0;
  return {
    status: hasStream ? "READY" : "PROCESSING",
    durationSeconds: typeof duration === "number" ? Math.round(duration) : null,
    coverUrl: media.BasicInfo?.CoverUrl || null,
  };
}
