import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

/**
 * 分组（分类）来源改为数据库 CategoryMeta。
 * 首次访问时若表为空，自动从常量清单播种（默认全部 defaultGrant=true，保持向后兼容）。
 */
export async function listCategories() {
  let metas = await prisma.categoryMeta.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  if (metas.length === 0) {
    try {
      await prisma.categoryMeta.createMany({
        data: CATEGORIES.map((name, index) => ({ name, order: index + 1, defaultGrant: true })),
      });
    } catch {
      // 并发首访同时播种时唯一约束冲突：忽略并重新读取即可
    }
    metas = await prisma.categoryMeta.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }
  return metas;
}

/** 全部分组名称（有序），供表单校验与分组展示使用 */
export async function listCategoryNames(): Promise<string[]> {
  return (await listCategories()).map((m) => m.name);
}

/**
 * 布局与首页共用的分类名缓存：避免每个请求都查库。
 * 管理端新增/切换/删除分组时 revalidateTag("categories") 立即失效。
 */
export const getCachedCategoryNames = unstable_cache(
  async () => listCategoryNames(),
  ["category-names"],
  { tags: ["categories"], revalidate: 60 },
);
