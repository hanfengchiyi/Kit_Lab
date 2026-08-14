import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toToolDTO, type ToolDTO } from "@/lib/constants";
import { getCachedCategoryNames } from "@/lib/categories";
import { getAllowedCategories } from "@/lib/grants";
import { ToolBrowser, type ToolGroup } from "@/components/tool-browser";
import { CloudPuff, SakuraFlower, SparkleStar, WaveDivider } from "@/components/decorations";

export const metadata: Metadata = {
  title: "Kit Lab — 个人工具库",
};

export default async function HomePage() {
  const session = await auth();

  const tools = await prisma.tool.findMany({
    where: { visibility: "public" },
    orderBy: [{ order: "asc" }, { addedAt: "asc" }],
  });

  // 分类授权：受限用户只看到被授权的分类
  const allowedCategories = await getAllowedCategories(session?.user);
  const visibleTools = allowedCategories
    ? tools.filter((tool) => allowedCategories.has(tool.category))
    : tools;

  const favoriteIds = session?.user
    ? (
        await prisma.favorite.findMany({
          where: { userId: session.user.id },
          select: { toolId: true },
        })
      ).map((favorite) => favorite.toolId)
    : [];

  // 按分类清单顺序分组；不在清单内的分类归入「其他」。
  // 一次遍历分组，避免对每个分类做全量 filter（O(分类数 × 工具数)）。
  const categoryNames = await getCachedCategoryNames();
  const knownCategories = new Set<string>(categoryNames);
  const byCategory = new Map<string, ToolDTO[]>();
  for (const tool of visibleTools) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(toToolDTO(tool));
    byCategory.set(tool.category, list);
  }
  const groups: ToolGroup[] = categoryNames.map((category) => ({
    category,
    tools: byCategory.get(category) ?? [],
  }));
  const unknownTools = [...byCategory.entries()]
    .filter(([category]) => !knownCategories.has(category))
    .flatMap(([, tools]) => tools);
  if (unknownTools.length > 0) {
    const fallback = groups.find((group) => group.category === "其他");
    if (fallback) {
      fallback.tools.push(...unknownTools);
    } else {
      groups.push({ category: "其他", tools: unknownTools });
    }
  }
  const nonEmptyGroups = groups.filter((group) => group.tools.length > 0);

  // 全部标签（按出现顺序去重），供客户端筛选
  const allTags = [
    ...new Set(nonEmptyGroups.flatMap((group) => group.tools.flatMap((tool) => tool.tags))),
  ];

  return (
    <div>
      {/* Hero 横幅：渐变底 + 漂浮装饰 + 波浪 */}
      <section
        className="relative mb-8 overflow-hidden rounded-3xl border-2 border-sakura-100 bg-gradient-to-br from-sakura-50 via-cream to-skyblue-50 px-6 py-8 shadow-soft sm:px-10 sm:py-10"
        data-decor="hero"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <SakuraFlower className="absolute right-[8%] top-[14%] size-12 animate-float text-sakura-200" />
          <SakuraFlower className="absolute right-[22%] bottom-[18%] size-7 animate-float-slow text-sakura-300" />
          <SparkleStar className="absolute right-[16%] top-[55%] size-6 animate-twinkle text-lav-300" />
          <SparkleStar className="absolute left-[42%] top-[12%] size-5 animate-twinkle text-skyblue-300 [animation-delay:1.4s]" />
          <CloudPuff className="absolute left-[55%] bottom-[8%] h-9 w-14 animate-float-slow text-white" />
          <WaveDivider className="absolute bottom-0 left-0 h-8 w-full text-white/50" />
        </div>
        <div className="relative">
          <h1 className="animate-fade-up font-display text-3xl text-ink sm:text-4xl">
            欢迎来到{" "}
            <span className="bg-gradient-to-r from-sakura-500 via-lav-400 to-skyblue-500 bg-clip-text text-transparent">
              Kit Lab
            </span>{" "}
            工具屋
          </h1>
          <p className="mt-3 max-w-xl animate-fade-up text-sm text-ink/55 [animation-delay:120ms]">
            把分散在各处的工具链接都收进这间小屋：即搜即用，登录后还能收藏心头好、
            藏起只属于自己的秘密道具。
          </p>
        </div>
      </section>
      <ToolBrowser
        groups={nonEmptyGroups}
        tags={allTags}
        favoriteIds={favoriteIds}
        loggedIn={!!session?.user}
      />
    </div>
  );
}