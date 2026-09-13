import { zValidator } from "@hono/zod-validator";
import { jobListQuerySchema } from "../contract";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getProgress, listJobs, setApplication, setFavorite } from "../services/jobs";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const applicationBody = z.object({ status: z.enum(["APPLIED", "INTERVIEWING"]) });

export const jobRoutes = new Hono<Env>()
  .get("/", zValidator("query", jobListQuerySchema, validationHook), async (c) =>
    c.json(await listJobs(c.req.valid("query"), c.var.userId)),
  )
  .get("/progress", async (c) => c.json(await getProgress(c.var.userId)))
  .put("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, true)),
  )
  .delete("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, false)),
  )
  .put(
    "/:id/application",
    zValidator("param", idParam, validationHook),
    zValidator("json", applicationBody, validationHook),
    async (c) => c.json(await setApplication(c.req.valid("param").id, c.var.userId, c.req.valid("json").status)),
  )
  .delete("/:id/application", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, null)),
  );
