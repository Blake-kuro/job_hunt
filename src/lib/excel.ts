import ExcelJS from "exceljs";
import { dateKey } from "./dates";

/** Excel 文件无法解析（损坏 / 非 xlsx / 无工作表） */
export class WorkbookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookParseError";
  }
}

/** 单元格文本：日期 → YYYY-MM-DD；超链接取 URL；其余取显示文本 */
export function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateKey(v);
  if (typeof v === "object" && "hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
  return cell.text ?? String(v);
}

/** 读取工作簿；解析失败或没有工作表 → WorkbookParseError */
export async function loadWorkbook(buffer: ArrayBuffer | Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const bytes = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  try {
    // exceljs 的 .d.ts 里 Buffer 是自定义的 ArrayBuffer 别名，运行时实际要 Node Buffer
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (e) {
    throw new WorkbookParseError(e instanceof Error ? e.message : String(e));
  }
  if (wb.worksheets.length === 0) throw new WorkbookParseError("文件里没有工作表");
  return wb;
}
