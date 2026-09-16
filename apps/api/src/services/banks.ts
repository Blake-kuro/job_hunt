import { prisma } from "../db";
import { AppError, NotFoundError } from "../lib/errors";

async function companyExists(id: string): Promise<boolean> {
  return (await prisma.company.findUnique({ where: { id }, select: { id: true } })) !== null;
}

async function categoryExists(id: string): Promise<boolean> {
  return (await prisma.questionCategory.findUnique({ where: { id }, select: { id: true } })) !== null;
}

/** 公司必须存在，否则 404（更新 / 删除公司本身） */
export async function requireCompany(id: string): Promise<void> {
  if (!(await companyExists(id))) throw new NotFoundError(`公司 ${id} 不存在`);
}

/** 分类必须存在，否则 404（更新 / 删除分类本身、导入题目） */
export async function requireCategory(id: string): Promise<void> {
  if (!(await categoryExists(id))) throw new NotFoundError(`分类 ${id} 不存在`);
}

/** 引用的公司必须存在，否则 400（创建分类时校验外键） */
export async function assertCompanyRef(id: string): Promise<void> {
  if (!(await companyExists(id))) throw new AppError(400, "VALIDATION", `公司 ${id} 不存在`);
}

/** 引用的分类必须存在，否则 400（创建 / 更新题目时校验外键） */
export async function assertCategoryRef(id: string): Promise<void> {
  if (!(await categoryExists(id))) throw new AppError(400, "VALIDATION", `分类 ${id} 不存在`);
}
