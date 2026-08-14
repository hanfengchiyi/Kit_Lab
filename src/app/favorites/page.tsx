import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth-guards";
import { toToolDTO, type ToolDTO } from "@/lib/constants";
import { ToolCard } from "@/components/tool-card";
import { EmptyBoxArt } from "@/components/decorations";

export const metadata: Metadata = {
  title: "我的收藏",
};

export default async function FavoritesPage() {
  const user = await requireUserPage();

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: { tool: true },
    orderBy: { createdAt: "desc" },
  });

  const tools: ToolDTO[] = favorites.map((favorite) => toToolDTO(favorite.tool));

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">我的收藏</h1>
        <p className="mt-1 text-sm text-ink/45">这里躺着每一颗你点亮的星星。</p>
      </div>
      {tools.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center">
          <EmptyBoxArt className="mx-auto w-44 animate-float" />
          <p className="mt-4 font-display text-lg text-ink/70">收藏夹还空空的</p>
          <p className="mt-1 text-sm text-ink/45">
            去{" "}
            <Link href="/" className="font-bold text-sakura-500 hover:text-sakura-600">
              首页
            </Link>{" "}
            点亮卡片上的小星星，把喜欢的工具收进来吧
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, index) => (
            <div
              key={tool.id}
              className="h-full animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
            >
              <ToolCard tool={tool} favorited loggedIn />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}