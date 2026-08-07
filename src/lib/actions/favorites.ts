"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface FavoriteResult {
  favorited?: boolean;
  error?: string;
}

/** 收藏 / 取消收藏公共工具，仅本人可操作 */
export async function toggleFavorite(toolId: string): Promise<FavoriteResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "请先登录" };
  }

  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "public") {
    return { error: "只能收藏公共工具" };
  }

  const where = { userId_toolId: { userId: session.user.id, toolId } };
  const existing = await prisma.favorite.findUnique({ where });
  if (existing) {
    await prisma.favorite.delete({ where });
  } else {
    await prisma.favorite.create({
      data: { userId: session.user.id, toolId },
    });
  }

  revalidatePath("/");
  revalidatePath("/favorites");
  return { favorited: !existing };
}
