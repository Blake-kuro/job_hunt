import { Hono } from "hono";
import createClient from "openapi-fetch";
import { describe, expect, it } from "vitest";
import { ApiError, unwrap } from "./client";

const app = new Hono()
  .get("/ok", (c) => c.json({ value: 42 }))
  .put("/empty", (c) => c.body(null, 204))
  .get("/invalid", (c) => c.json({ error: { code: "VALIDATION", message: "参数无效" } }, 400))
  .get("/proxy-error", (c) => c.text("Bad Gateway", 502))
  .get("/unexpected", (c) => c.json({ message: "unexpected envelope" }, 500));

type TestPaths = {
  "/ok": { get: { responses: { 200: { content: { "application/json": { value: number } } } } } };
  "/empty": { put: { responses: { 204: { content: never } } } };
  "/invalid": { get: { responses: { 400: { content: { "application/json": unknown } } } } };
  "/proxy-error": { get: { responses: { 502: { content: { "text/plain": string } } } } };
  "/unexpected": { get: { responses: { 500: { content: { "application/json": unknown } } } } };
};

const client = createClient<TestPaths>({
  baseUrl: "http://localhost",
  fetch: (req) => Promise.resolve(app.request(req)),
});

describe("openapi-fetch response unwrapping", () => {
  it("preserves the successful response value", async () => {
    const data: { value: number } = await unwrap(client.GET("/ok"));
    expect(data).toEqual({ value: 42 });
  });

  it("returns undefined for 204", async () => {
    expect(await unwrap(client.PUT("/empty"))).toBeUndefined();
  });

  it("preserves structured API errors", async () => {
    await expect(unwrap(client.GET("/invalid"))).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "参数无效",
    });
  });

  it("handles non-JSON proxy failures", async () => {
    await expect(unwrap(client.GET("/proxy-error"))).rejects.toThrow(ApiError);
    await expect(unwrap(client.GET("/proxy-error"))).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("handles unexpected JSON error bodies", async () => {
    await expect(unwrap(client.GET("/unexpected"))).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });
});
