import { describe, expect, it } from "vitest";
import { hc } from "hono/client";
import { Hono } from "hono";
import { ApiError, unwrap } from "./client";

const app = new Hono()
  .get("/ok", (c) => c.json({ value: 42 }))
  .put("/empty", (c) => c.body(null, 204))
  .get("/invalid", (c) => c.json({ error: { code: "VALIDATION", message: "参数无效" } }, 400))
  .get("/proxy-error", (c) => c.text("Bad Gateway", 502))
  .get("/unexpected", (c) => c.json({ message: "unexpected envelope" }, 500));

const client = hc<typeof app>("http://localhost", { fetch: app.request });

describe("RPC response unwrapping", () => {
  it("preserves the successful response type and value", async () => {
    const data: { value: number } = await unwrap(client.ok.$get());
    expect(data).toEqual({ value: 42 });
  });

  it("does not parse JSON for 204", async () => {
    expect(await unwrap(client.empty.$put())).toBeUndefined();
  });

  it("preserves structured API errors", async () => {
    await expect(unwrap(client.invalid.$get())).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "参数无效",
    });
  });

  it("handles non-JSON proxy failures", async () => {
    await expect(unwrap(client["proxy-error"].$get())).rejects.toThrow(ApiError);
    await expect(unwrap(client["proxy-error"].$get())).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("handles unexpected JSON error bodies", async () => {
    await expect(unwrap(client.unexpected.$get())).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });
});
