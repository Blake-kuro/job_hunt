import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestUser } from "./auth";
import type { Env } from "./env";
import { errorHandler, validationHook } from "./lib/errors";
import { jobRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";
import { quizRoutes } from "./routes/quiz";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { contentRoutes } from "./routes/content";
import { courseRoutes } from "./routes/courses";
import { vodCallbackRoutes } from "./routes/vod-callback";

export const OPENAPI_INFO = {
  openapi: "3.1.0",
  info: { title: "job_hunt_back", version: "0.1.0", description: "职寻 · 校园招聘岗位与刷题 API" },
} as const;

function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 注意：不能像 `new OpenAPIHono().use(...).route(...)` 那样链式调用——
// 基类 `Hono` 的 `.use()` 返回类型是 `Hono<...>`（丢失 OpenAPIHono 子类信息），
// 之后再调用的 `.route()/.doc31()` 就会解析成基类签名，`doc31`/`getOpenAPI31Document`
// 在类型层面“消失”。分成独立语句、不重新赋值给 `api`/`app`，保持它们的静态类型为 OpenAPIHono。
const api = new OpenAPIHono<Env>({ defaultHook: validationHook });
api.route("/auth", authRoutes);
// VOD 事件回调由腾讯云服务端发起，没有 cookie，放在 requestUser 之前（靠 ?token= 校验）
api.route("/vod", vodCallbackRoutes);
api.use(requestUser);
api.route("/admin", adminRoutes);
api.route("/content", contentRoutes);
api.route("/courses", courseRoutes);
api.route("/me", meRoutes);
api.route("/jobs", jobRoutes);
api.route("/quiz", quizRoutes);

const app = new OpenAPIHono<Env>({ defaultHook: validationHook });
app.use(cors({ origin: corsOrigins(), credentials: true }));
app.use(process.env.NODE_ENV === "test" ? async (_c, next) => next() : logger());
// doc31/docs 必须在 `app.route("/api", api)` 之前注册：Hono 按注册顺序匹配路由，
// 更早注册且直接返回响应（不调用 next()）的 handler 会短路，
// 不会再走到之后才注册的 `/api/*` 通配中间件（api 上的 requestUser）——
// 这样 /api/openapi.json 与 /api/docs 就不依赖数据库/登录态。
app.doc31("/api/openapi.json", OPENAPI_INFO);
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));
app.route("/api", api);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404));
app.onError(errorHandler);

export default app;
