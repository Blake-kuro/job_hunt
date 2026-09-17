import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPlaySignature,
  buildUploadSignature,
  fetchMediaInfo,
  isMock,
  MOCK_CALLBACK_TOKEN,
  mediaInfoToStatus,
  safeEqual,
  signPlay,
  signUpload,
  verifyCallbackToken,
} from "./vod";

const NOW = 1_700_000_000;

describe("buildUploadSignature", () => {
  const input = {
    secretId: "AKIDtest",
    secretKey: "secret-key",
    now: NOW,
    ttlSeconds: 3600,
    random: 12345,
    procedure: "hls-encrypt",
  };

  it("固定输入的快照", () => {
    expect(buildUploadSignature(input)).toBe(
      "gQX9/d7WXUee0aTIbZHseoKB4YdzZWNyZXRJZD1BS0lEdGVzdCZjdXJyZW50VGltZVN0YW1wPTE3MDAwMDAwMDAmZXhwaXJlVGltZT0xNzAwMDAzNjAwJnJhbmRvbT0xMjM0NSZwcm9jZWR1cmU9aGxzLWVuY3J5cHQ=",
    );
  });

  it("结构：前 20 字节是 HMAC-SHA1(secretKey, query)，其后是明文 query", () => {
    const raw = Buffer.from(buildUploadSignature(input), "base64");
    const query = raw.subarray(20).toString("utf8");
    expect(query).toBe(
      "secretId=AKIDtest&currentTimeStamp=1700000000&expireTime=1700003600&random=12345&procedure=hls-encrypt",
    );
    expect(raw.subarray(0, 20)).toEqual(createHmac("sha1", "secret-key").update(query).digest());
  });

  it("可选参数缺省时不出现在 query 里；classId / sourceContext 会被编码", () => {
    const { procedure: _p, ...bare } = input;
    const query = Buffer.from(buildUploadSignature(bare), "base64").subarray(20).toString();
    expect(query).not.toContain("procedure");
    const withExtra = Buffer.from(buildUploadSignature({ ...input, classId: 7, sourceContext: "a b" }), "base64")
      .subarray(20)
      .toString();
    expect(withExtra).toContain("&classId=7&procedure=hls-encrypt&sourceContext=a%20b");
  });
});

describe("buildPlaySignature", () => {
  const input = { appId: 1250000000, fileId: "5285890781234567890", playKey: "play-key", now: NOW, ttlSeconds: 7200 };

  it("固定输入的快照", () => {
    expect(buildPlaySignature(input)).toBe(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6MTI1MDAwMDAwMCwiZmlsZUlkIjoiNTI4NTg5MDc4MTIzNDU2Nzg5MCIsImN1cnJlbnRUaW1lU3RhbXAiOjE3MDAwMDAwMDAsImV4cGlyZVRpbWVTdGFtcCI6MTcwMDAwNzIwMCwidXJsQWNjZXNzSW5mbyI6eyJ0IjoiNjU1NDBkMjAifX0.SjkPym6lwtlomRVa4-O967c6J5qu-T78W6Nt-kqTXfg",
    );
  });

  it("是 HS256 JWT：header / payload / 签名可独立验证", () => {
    const [header, payload, sig] = buildPlaySignature(input).split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      appId: 1250000000,
      fileId: "5285890781234567890",
      currentTimeStamp: NOW,
      expireTimeStamp: NOW + 7200,
      urlAccessInfo: { t: (NOW + 7200).toString(16) },
    });
    expect(sig).toBe(createHmac("sha256", "play-key").update(`${header}.${payload}`).digest("base64url"));
  });
});

describe("mediaInfoToStatus", () => {
  it("只有非原片转码或自适应码流才算 READY；原片（Definition 0）不算", () => {
    expect(mediaInfoToStatus(undefined)).toEqual({ status: "FAILED", durationSeconds: null, coverUrl: null });
    const base = { MetaData: { Duration: 61.4 }, BasicInfo: { CoverUrl: "" } };
    expect(mediaInfoToStatus(base)).toMatchObject({ status: "PROCESSING", durationSeconds: 61, coverUrl: null });
    expect(mediaInfoToStatus({ ...base, TranscodeInfo: { TranscodeSet: [{ Definition: 0 }] } }).status).toBe(
      "PROCESSING",
    );
    expect(
      mediaInfoToStatus({ ...base, TranscodeInfo: { TranscodeSet: [{ Definition: 0 }, { Definition: 100210 }] } })
        .status,
    ).toBe("READY");
    expect(
      mediaInfoToStatus({
        ...base,
        BasicInfo: { CoverUrl: "https://cdn/c.jpg" },
        AdaptiveDynamicStreamingInfo: { AdaptiveDynamicStreamingSet: [{}] },
      }),
    ).toEqual({ status: "READY", durationSeconds: 61, coverUrl: "https://cdn/c.jpg" });
  });
});

describe("mock 与环境变量", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  it("VOD_MOCK=1 → 假签名与 READY 媒体信息", async () => {
    process.env.VOD_MOCK = "1";
    expect(isMock()).toBe(true);
    expect(signUpload()).toMatchObject({ signature: "mock-upload" });
    expect(signPlay("f1")).toMatchObject({ fileId: "f1", psign: "mock-play" });
    expect(new Date(signPlay("f1").expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(await fetchMediaInfo("f1")).toEqual({ status: "READY", durationSeconds: 600, coverUrl: null });
  });

  it("缺少 VOD_SECRET_ID 也走 mock；配齐后出真实签名", () => {
    delete process.env.VOD_MOCK;
    delete process.env.VOD_SECRET_ID;
    expect(isMock()).toBe(true);
    process.env.VOD_SECRET_ID = "AKIDtest";
    process.env.VOD_SECRET_KEY = "secret-key";
    process.env.VOD_APP_ID = "1250000000";
    process.env.VOD_PLAY_KEY = "play-key";
    expect(isMock()).toBe(false);
    expect(Buffer.from(signUpload().signature, "base64").subarray(20).toString()).toMatch(/^secretId=AKIDtest&/);
    const play = signPlay("f1");
    expect(play.appId).toBe("1250000000");
    expect(play.psign.split(".")).toHaveLength(3);
  });

  it("生产环境：缺 VOD_SECRET_ID 抛错而不是隐式 mock；显式 VOD_MOCK=1 也不接受 mock 回调 token", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VOD_MOCK;
    delete process.env.VOD_SECRET_ID;
    expect(() => isMock()).toThrow(/VOD_SECRET_ID/);
    expect(() => signPlay("f1")).toThrow(/VOD_SECRET_ID/);
    process.env.VOD_MOCK = "1";
    delete process.env.VOD_CALLBACK_TOKEN;
    expect(isMock()).toBe(true);
    expect(verifyCallbackToken(MOCK_CALLBACK_TOKEN)).toBe(false);
    process.env.VOD_CALLBACK_TOKEN = "real-token";
    expect(verifyCallbackToken("real-token")).toBe(true);
  });

  it("回调 token：常量时间比较；mock 且未配置时接受 MOCK_CALLBACK_TOKEN", () => {
    process.env.VOD_MOCK = "1";
    delete process.env.VOD_CALLBACK_TOKEN;
    expect(verifyCallbackToken(MOCK_CALLBACK_TOKEN)).toBe(true);
    expect(verifyCallbackToken("nope")).toBe(false);
    expect(verifyCallbackToken(undefined)).toBe(false);
    process.env.VOD_CALLBACK_TOKEN = "real-token";
    expect(verifyCallbackToken("real-token")).toBe(true);
    expect(verifyCallbackToken(MOCK_CALLBACK_TOKEN)).toBe(false);
    delete process.env.VOD_MOCK;
    process.env.VOD_SECRET_ID = "AKIDtest";
    delete process.env.VOD_CALLBACK_TOKEN;
    expect(verifyCallbackToken(MOCK_CALLBACK_TOKEN)).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
