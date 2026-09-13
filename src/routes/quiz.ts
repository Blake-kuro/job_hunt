import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CompanySetListSchema,
  QuestionIdParamSchema,
  QuizAnswerResultSchema,
  QuizDashboardSchema,
  QuizTodaySchema,
  SetMasteredSchema,
  SubmitAttemptSchema,
  WrongBookListSchema,
} from "../contract";
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

const json = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
const badRequest = json(ApiErrorSchema, "参数校验失败");
const notFound = json(ApiErrorSchema, "不存在");

const todayRoute = createRoute({
  method: "get",
  path: "/today",
  tags: ["quiz"],
  operationId: "getTodayQuestion",
  responses: { 200: json(QuizTodaySchema, "今日一题") },
});

const attemptsRoute = createRoute({
  method: "post",
  path: "/attempts",
  tags: ["quiz"],
  operationId: "submitAttempt",
  request: { body: { content: { "application/json": { schema: SubmitAttemptSchema } } } },
  responses: { 200: json(QuizAnswerResultSchema, "判题结果"), 400: badRequest, 404: notFound },
});

const dashboardRoute = createRoute({
  method: "get",
  path: "/dashboard",
  tags: ["quiz"],
  operationId: "getQuizDashboard",
  responses: { 200: json(QuizDashboardSchema, "打卡仪表盘") },
});

const wrongBookRoute = createRoute({
  method: "get",
  path: "/wrong-book",
  tags: ["quiz"],
  operationId: "listWrongBook",
  responses: { 200: json(WrongBookListSchema, "错题本") },
});

const setMasteredRoute = createRoute({
  method: "put",
  path: "/wrong-book/{questionId}",
  tags: ["quiz"],
  operationId: "setWrongBookMastered",
  request: { params: QuestionIdParamSchema, body: { content: { "application/json": { schema: SetMasteredSchema } } } },
  responses: { 204: { description: "已更新" }, 400: badRequest, 404: notFound },
});

const companySetsRoute = createRoute({
  method: "get",
  path: "/company-sets",
  tags: ["quiz"],
  operationId: "listCompanySets",
  responses: { 200: json(CompanySetListSchema, "公司题集") },
});

export const quizRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(todayRoute, async (c) => c.json(await getTodayQuestion(c.var.userId), 200))
  .openapi(attemptsRoute, async (c) => {
    const { questionId, picked } = c.req.valid("json");
    return c.json(await submitAnswer(c.var.userId, questionId, picked), 200);
  })
  .openapi(dashboardRoute, async (c) => c.json(await getDashboard(c.var.userId), 200))
  .openapi(wrongBookRoute, async (c) => c.json({ items: await listWrongBook(c.var.userId) }, 200))
  .openapi(setMasteredRoute, async (c) => {
    await setMastered(c.var.userId, c.req.valid("param").questionId, c.req.valid("json").mastered);
    return c.body(null, 204);
  })
  .openapi(companySetsRoute, async (c) => c.json({ items: await listCompanySets() }, 200));
