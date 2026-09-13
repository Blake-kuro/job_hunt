import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestUser } from "./auth";
import type { Env } from "./env";
import { errorHandler } from "./lib/errors";
import { jobRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";

import { quizRoutes } from "./routes/quiz";

const app = new Hono<Env>()
  .basePath("/api")
  .use(process.env.NODE_ENV === "test" ? async (_c, next) => next() : logger())
  .use(requestUser)
  .route("/me", meRoutes)
  .route("/jobs", jobRoutes)
  .route("/quiz", quizRoutes)
  .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404))
  .onError(errorHandler);

export default app;
export type AppType = typeof app;
