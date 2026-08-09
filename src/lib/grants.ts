import { prisma } from "@/lib/prisma";

/**
 * 取用户可使用的分类集合：
 * - null 表示不限分类（访客、管理员、没有任何授权记录的用户）
 * - Set 表示仅可使用其中的分类
 */
export async function getAllowedCategories(
  user: { id: string; role?: string } | undefined | null,
): Promise<Set<string> | null> {
  if (!user || user.role === "admin") return null;
  const grants = await prisma.categoryGrant.findMany({
    where: { userId: user.id },
    select: { category: true },
  });
  if (grants.length === 0) return null;
  return new Set(grants.map((g) => g.category));
}

/** 判断某分类是否允许使用 */
export function categoryAllowed(allowed: Set<string> | null, category: string): boolean {
  return allowed === null || allowed.has(category);
}
