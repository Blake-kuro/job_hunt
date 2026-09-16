import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CategoryIdParamSchema,
  QuestionIdParamSchema,
  QuizAnswerResultSchema,
  QuizBanksSchema,
  QuizDashboardSchema,
  QuizNextSchema,
  SetMasteredSchema,
  SubmitAttemptSchema,
  WrongBookListSchema,
} from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getDashboard, listBanks, listWrongBook, nextQuestion, setMastered, submitAnswer } from "../services/quiz";

const json = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
const badRequest = json(ApiErrorSchema, "参数校验失败");
const notFound = json(ApiErrorSchema, "不存在");
const forbidden = json(ApiErrorSchema, "作答次数已用完");

const banksRoute = createRoute({
  method: "get",
  path: "/banks",
  tags: ["quiz"],
  operationId: "listQuizBanks",
  responses: { 200: json(QuizBanksSchema, "题库（公司 → 分类）与当前用户进度、配额") },
});

const nextRoute = createRoute({
  method: "get",
  path: "/categories/{categoryId}/next",
  tags: ["quiz"],
  operationId: "getNextQuestion",
  request: { params: CategoryIdParamSchema },
  responses: { 200: json(QuizNextSchema, "该分类下一道未作答题"), 404: notFound },
});

const attemptsRoute = createRoute({
  method: "post",
  path: "/attempts",
  tags: ["quiz"],
  operationId: "submitAttempt",
  request: { body: { required: true, content: { "application/json": { schema: SubmitAttemptSchema } } } },
  responses: { 200: json(QuizAnswerResultSchema, "判题结果"), 400: badRequest, 403: forbidden, 404: notFound },
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
  request: {
    params: QuestionIdParamSchema,
    body: { required: true, content: { "application/json": { schema: SetMasteredSchema } } },
  },
  responses: { 204: { description: "已更新" }, 400: badRequest, 404: notFound },
});

export const quizRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(banksRoute, async (c) => c.json(await listBanks(c.var.userId, c.var.access, c.var.role), 200))
  .openapi(nextRoute, async (c) =>
    c.json(await nextQuestion(c.var.userId, c.req.valid("param").categoryId, c.var.access, c.var.role), 200),
  )
  .openapi(attemptsRoute, async (c) => {
    const { questionId, picked } = c.req.valid("json");
    return c.json(await submitAnswer(c.var.userId, questionId, picked, c.var.access, c.var.role), 200);
  })
  .openapi(dashboardRoute, async (c) => c.json(await getDashboard(c.var.userId, c.var.access, c.var.role), 200))
  .openapi(wrongBookRoute, async (c) => c.json({ items: await listWrongBook(c.var.userId) }, 200))
  .openapi(setMasteredRoute, async (c) => {
    await setMastered(c.var.userId, c.req.valid("param").questionId, c.req.valid("json").mastered);
    return c.body(null, 204);
  });
