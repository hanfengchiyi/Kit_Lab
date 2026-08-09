import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

/**
 * 分组（分类）来源改为数据库 CategoryMeta。
 * 首次访问时若表为空，自动从常量清单播种（默认全部 defaultGrant=true，保持向后兼容）。
 */
export async function listCategories() {
  let metas = await prisma.categoryMeta.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  if (metas.length === 0) {
    await prisma.categoryMeta.createMany({
      data: CATEGORIES.map((name, index) => ({ name, order: index + 1, defaultGrant: true })),
    });
    metas = await prisma.categoryMeta.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }
  return metas;
}

/** 全部分组名称（有序），供表单校验与分组展示使用 */
export async function listCategoryNames(): Promise<string[]> {
  return (await listCategories()).map((m) => m.name);
}
