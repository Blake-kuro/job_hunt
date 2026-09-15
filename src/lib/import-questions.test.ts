import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { hasDb, resetDb } from "../test/db";
import { WorkbookParseError } from "./excel";
import { JUDGE_OPTIONS } from "./grade";
import { importQuestionWorkbook, parseQuestionSheet } from "./import-questions";

const HEADER = ["题号", "题型", "所属部分", "题干", "A", "B", "C", "D", "E", "F", "答案"];

function sheetWith(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("题库");
  ws.addRows([HEADER, ...rows]);
  return { wb, ws };
}

/** 6 行：单选 / 多选 AC / 判断（A、B 留空）/ 缺题干 / 多选只有 1 个答案 / 与第 1 行同题干 */
const FIXTURE: unknown[][] = [
  [1, "单选题", "第一部分", "1+1=?", "1", "2", "3", "4", "", "", "B"],
  [2, "多选题", "第一部分", "哪些是偶数？", "2", "3", "4", "5", "", "", "A、C"],
  [3, "判断题", "", "地球是圆的", "", "", "", "", "", "", "A"],
  [4, "单选题", "", "", "x", "y", "", "", "", "", "A"],
  [5, "多选题", "", "多选但只有一个答案", "x", "y", "z", "", "", "", "A"],
  [6, "单选题", "", "1+1=?", "1", "2", "", "", "", "", "a"],
];

describe("parseQuestionSheet", () => {
  it("按表头取列，判断题忽略 A/B 列，缺题干记 skipped，空行不记", () => {
    const { ws } = sheetWith([...FIXTURE, ["", "", "", "", "", "", "", "", "", "", ""]]);
    const { rows, skipped } = parseQuestionSheet(ws);
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4, 7]);
    expect(rows[0]).toMatchObject({ sortOrder: 1, type: "SINGLE", section: "第一部分", prompt: "1+1=?", answer: "B" });
    expect(rows[1]).toMatchObject({ type: "MULTI", answer: "AC" });
    expect(rows[1].options).toHaveLength(4);
    expect(rows[2]).toMatchObject({ type: "JUDGE", section: null, options: JUDGE_OPTIONS, answer: "A" });
    expect(rows[3]).toMatchObject({ row: 7, sortOrder: 6, answer: "A" });
    expect(skipped).toEqual(["第 5 行：缺少题干", "第 6 行：多选题至少 3 个选项、2 个正确答案"]);
  });

  it("缺题型时按选项 / 答案推断；题号无效时用行号", () => {
    const { ws } = sheetWith([
      ["", "", "", "判断", "正确", "错误", "", "", "", "", "B"],
      ["x", "", "", "多选", "1", "2", "3", "", "", "", "AB"],
      ["3", "", "", "单选", "1", "2", "3", "", "", "", "C"],
    ]);
    const { rows, skipped } = parseQuestionSheet(ws);
    expect(skipped).toEqual([]);
    expect(rows.map((r) => [r.type, r.sortOrder])).toEqual([
      ["JUDGE", 1],
      ["MULTI", 2],
      ["SINGLE", 3],
    ]);
  });

  it("缺少 题干 / 答案 列时抛 WorkbookParseError", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("x");
    ws.addRow(["题号", "题干"]);
    expect(() => parseQuestionSheet(ws)).toThrow(WorkbookParseError);
  });
});

describe.skipIf(!hasDb)("importQuestionWorkbook", () => {
  beforeEach(resetDb);

  it("写入合法行，跳过不合法与重复题干，再导一次全部跳过", async () => {
    const company = await prisma.company.create({ data: { name: "测试公司" } });
    const category = await prisma.questionCategory.create({ data: { companyId: company.id, name: "基础" } });
    const { wb } = sheetWith(FIXTURE);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const first = await importQuestionWorkbook(category.id, buffer);
    expect(first.created).toBe(3);
    expect(first.skipped).toHaveLength(3);
    expect(first.skipped.some((s) => s.includes("题干已存在"))).toBe(true);

    const rows = await prisma.question.findMany({ where: { categoryId: category.id }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.sortOrder)).toEqual([1, 2, 3]);
    expect(rows[1]).toMatchObject({ type: "MULTI", answer: "AC", source: "测试公司 · 基础", published: true });
    expect(rows[2]).toMatchObject({ type: "JUDGE", options: JUDGE_OPTIONS, answer: "A", difficulty: "MEDIUM" });
    expect(rows[2].explanation).toEqual([]);

    const second = await importQuestionWorkbook(category.id, buffer);
    expect(second).toMatchObject({ created: 0 });
    expect(second.skipped).toHaveLength(6);
    expect(await prisma.question.count()).toBe(3);
  });

  it("分类不存在 → NotFoundError；没有题库表头 → WorkbookParseError", async () => {
    const { wb } = sheetWith([]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(importQuestionWorkbook("nope", buffer)).rejects.toThrow("不存在");
    const company = await prisma.company.create({ data: { name: "测试公司" } });
    const category = await prisma.questionCategory.create({ data: { companyId: company.id, name: "基础" } });
    const other = new ExcelJS.Workbook();
    other.addWorksheet("x").addRow(["a", "b"]);
    await expect(importQuestionWorkbook(category.id, Buffer.from(await other.xlsx.writeBuffer()))).rejects.toThrow(
      WorkbookParseError,
    );
  });
});
