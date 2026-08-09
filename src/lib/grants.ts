import { prisma } from "@/lib/prisma";
import { listCategories } from "@/lib/categories";

/**
 * 取用户可使用的分类集合：
 * - 管理员返回 null（不限分类）；
 * - 其他人（含访客）：defaultGrant=true 的分组 ∪ 个人被单独授权的分组。
 */
export async function getAllowedCategories(
  user: { id: string; role?: string } | undefined | null,
): Promise<Set<string> | null> {
  if (user?.role === "admin") return null;

  const metas = await listCategories();
  const allowed = new Set(metas.filter((m) => m.defaultGrant).map((m) => m.name));

  if (user) {
    const grants = await prisma.categoryGrant.findMany({
      where: { userId: user.id },
      select: { category: true },
    });
    for (const grant of grants) allowed.add(grant.category);
  }
  return allowed;
}

/** 判断某分类是否允许使用 */
export function categoryAllowed(allowed: Set<string> | null, category: string): boolean {
  return allowed === null || allowed.has(category);
}
