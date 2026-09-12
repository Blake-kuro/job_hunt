import { zValidator } from "@hono/zod-validator";
import { setMasteredSchema, submitAttemptSchema } from "@job-hunt/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import {
  getDashboard,
  getTodayQuestion,
  listCompanySets,
  listWrongBook,
  setMastered,
  submitAnswer,
} from "../services/quiz";

const questionParam = z.object({ questionId: z.string().min(1) });

export const quizRoutes = new Hono<Env>()
  .get("/today", async (c) => c.json(await getTodayQuestion(c.var.userId)))
  .post("/attempts", zValidator("json", submitAttemptSchema, validationHook), async (c) => {
    const { questionId, picked } = c.req.valid("json");
    return c.json(await submitAnswer(c.var.userId, questionId, picked));
  })
  .get("/dashboard", async (c) => c.json(await getDashboard(c.var.userId)))
  .get("/wrong-book", async (c) => c.json({ items: await listWrongBook(c.var.userId) }))
  .put(
    "/wrong-book/:questionId",
    zValidator("param", questionParam, validationHook),
    zValidator("json", setMasteredSchema, validationHook),
    async (c) => {
      await setMastered(c.var.userId, c.req.valid("param").questionId, c.req.valid("json").mastered);
      return c.body(null, 204);
    },
  )
  .get("/company-sets", async (c) => c.json({ items: await listCompanySets() }));
