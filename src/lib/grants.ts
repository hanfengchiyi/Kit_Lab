import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { listCategories } from "@/lib/categories";

/**
 * 取用户可使用的分类集合：
 * - 管理员返回 null（不限分类）；
 * - 其他人（含访客）：defaultGrant=true 的分组 ∪ 个人被单独授权的分组。
 *
 * 两个来源都带缓存（内容分发路由每个静态资源请求都会走到这里）：
 * - 默认授权清单复用 "categories" tag，分组管理后台变更时立即失效；
 * - 个人授权清单用 "category-grants" tag，授权变更 / 分组删除时立即失效；
 * - 均带 60 秒 TTL 兜底。
 */
const getCachedDefaultGrantCategories = unstable_cache(
  async (): Promise<string[]> =>
    (await listCategories()).filter((m) => m.defaultGrant).map((m) => m.name),
  ["default-grant-categories"],
  { tags: ["categories"], revalidate: 60 },
);

const getCachedUserGrantedCategories = unstable_cache(
  async (userId: string): Promise<string[]> =>
    (
      await prisma.categoryGrant.findMany({
        where: { userId },
        select: { category: true },
      })
    ).map((grant) => grant.category),
  ["user-granted-categories"],
  { tags: ["category-grants"], revalidate: 60 },
);

export async function getAllowedCategories(
  user: { id: string; role?: string } | undefined | null,
): Promise<Set<string> | null> {
  if (user?.role === "admin") return null;

  const allowed = new Set(await getCachedDefaultGrantCategories());
  if (user) {
    for (const category of await getCachedUserGrantedCategories(user.id)) {
      allowed.add(category);
    }
  }
  return allowed;
}

/** 判断某分类是否允许使用 */
export function categoryAllowed(allowed: Set<string> | null, category: string): boolean {
  return allowed === null || allowed.has(category);
}
