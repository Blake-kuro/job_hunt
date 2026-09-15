import type ExcelJS from "exceljs";
import type { AdminQuestionImportResult } from "../contract";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { QuestionType } from "../generated/prisma/enums";
import { NotFoundError } from "./errors";
import { cellText, loadWorkbook, WorkbookParseError } from "./excel";
import { JUDGE_OPTIONS, LETTERS, normalizeAnswer, type OptionShape, validateQuestionShape } from "./grade";

const TYPE_MAP: Record<string, QuestionType> = {
  单选题: "SINGLE",
  单选: "SINGLE",
  多选题: "MULTI",
  多选: "MULTI",
  判断题: "JUDGE",
  判断: "JUDGE",
};

export interface ParsedRow {
  /** Excel 行号（从 1 起，表头为第 1 行） */
  row: number;
  sortOrder: number;
  type: QuestionType;
  section: string | null;
  prompt: string;
  options: OptionShape[];
  answer: string;
}

type Headers = Map<string, number>;

/** 表头行 → 列名（trim）到列号的映射 */
function readHeaders(ws: ExcelJS.Worksheet): Headers {
  const headers: Headers = new Map();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const name = cellText(cell).trim();
    if (name && !headers.has(name)) headers.set(name, col);
  });
  return headers;
}

/** 是否为题库工作表：表头同时含 题干 与 答案 */
export function isQuestionSheet(ws: ExcelJS.Worksheet): boolean {
  const headers = readHeaders(ws);
  return headers.has("题干") && headers.has("答案");
}

/** 缺题型列时的推断：正确 / 错误 两项 → JUDGE；答案 ≥ 2 字母 → MULTI；否则 SINGLE */
function inferType(options: OptionShape[], answer: string): QuestionType {
  if (options.length === 2 && options[0].text === "正确" && options[1].text === "错误") return "JUDGE";
  return answer.length >= 2 ? "MULTI" : "SINGLE";
}

/**
 * 解析一张题库工作表（第一行为表头，列按名称取）。
 * 题干为空的行：整行空白直接忽略，否则记入 skipped；形状不合法记入 skipped。
 */
export function parseQuestionSheet(ws: ExcelJS.Worksheet): { rows: ParsedRow[]; skipped: string[] } {
  const headers = readHeaders(ws);
  const promptCol = headers.get("题干");
  const answerCol = headers.get("答案");
  if (promptCol === undefined || answerCol === undefined) throw new WorkbookParseError("找不到 题干 / 答案 列");
  const col = (name: string) => headers.get(name);
  const text = (row: ExcelJS.Row, c: number | undefined) => (c === undefined ? "" : cellText(row.getCell(c)).trim());

  const rows: ParsedRow[] = [];
  const skipped: string[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const prompt = text(row, promptCol);
    const rawAnswer = text(row, answerCol);
    if (!prompt) {
      const blank = [...headers.values()].every((c) => !text(row, c));
      if (!blank) skipped.push(`第 ${n} 行：缺少题干`);
      return;
    }
    const answer = normalizeAnswer([...rawAnswer.toUpperCase().replace(/[^A-F]/g, "")]);
    const letterOptions: OptionShape[] = [];
    for (const letter of LETTERS) {
      const t = text(row, col(letter));
      if (t) letterOptions.push({ letter: LETTERS[letterOptions.length], text: t });
    }
    const type = TYPE_MAP[text(row, col("题型"))] ?? inferType(letterOptions, answer);
    const options = type === "JUDGE" ? JUDGE_OPTIONS.map((o) => ({ ...o })) : letterOptions;
    const invalid = validateQuestionShape(type, options, answer);
    if (invalid) {
      skipped.push(`第 ${n} 行：${invalid}`);
      return;
    }
    const num = Number(text(row, col("题号")));
    const sortOrder = Number.isInteger(num) && num > 0 ? num : n - 1;
    rows.push({ row: n, sortOrder, type, section: text(row, col("所属部分")) || null, prompt, options, answer });
  });
  return { rows, skipped };
}

/**
 * 把 xlsx 里第一张题库工作表导入到指定分类。
 * 同分类内题干已存在的行跳过；全部写入在一个事务里。
 * 抛 WorkbookParseError（文件坏 / 无题库表）或 NotFoundError（分类不存在）。
 */
export async function importQuestionWorkbook(
  categoryId: string,
  buffer: ArrayBuffer | Buffer,
): Promise<AdminQuestionImportResult> {
  const wb = await loadWorkbook(buffer);
  const ws = wb.worksheets.find(isQuestionSheet);
  if (!ws) throw new WorkbookParseError("找不到含 题干 / 答案 列的工作表");

  const category = await prisma.questionCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, company: { select: { name: true } } },
  });
  if (!category) throw new NotFoundError(`分类 ${categoryId} 不存在`);
  const existing = await prisma.question.findMany({ where: { categoryId }, select: { prompt: true } });
  const seen = new Set(existing.map((q) => q.prompt));

  const { rows, skipped } = parseQuestionSheet(ws);
  const source = `${category.company.name} · ${category.name}`;
  const data: Prisma.QuestionCreateManyInput[] = [];
  for (const r of rows) {
    if (seen.has(r.prompt)) {
      skipped.push(`第 ${r.row} 行：题干已存在`);
      continue;
    }
    seen.add(r.prompt);
    data.push({
      categoryId,
      type: r.type,
      section: r.section,
      sortOrder: r.sortOrder,
      prompt: r.prompt,
      options: r.options.map(({ letter, text }) => ({ letter, text })),
      answer: r.answer,
      explanation: [],
      difficulty: "MEDIUM",
      source,
      published: true,
    });
  }
  const created = data.length ? await prisma.$transaction((tx) => tx.question.createMany({ data })) : { count: 0 };
  return { created: created.count, skipped: skipped.sort(byRow) };
}

const rowNo = (s: string) => Number(/^第 (\d+) 行/.exec(s)?.[1] ?? 0);
const byRow = (a: string, b: string) => rowNo(a) - rowNo(b);
