"use client";

import { useMemo, useState } from "react";
import { ToolCard } from "@/components/tool-card";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { EmptySearchArt, SakuraFlower, SparkleStar } from "@/components/decorations";
import type { ToolDTO } from "@/lib/constants";

export interface ToolGroup {
  category: string;
  tools: ToolDTO[];
}

interface ToolBrowserProps {
  groups: ToolGroup[];
  tags: string[];
  favoriteIds: string[];
  loggedIn: boolean;
}

/** 首页公共工具库：按分类分组展示，支持实时搜索 + 标签筛选（可叠加） */
export function ToolBrowser({ groups, tags, favoriteIds, loggedIn }: ToolBrowserProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // 实时搜索：匹配名称、描述、标签、分类
  const keyword = query.trim().toLowerCase();
  const matchKeyword = (tool: ToolDTO) =>
    keyword === "" ||
    tool.name.toLowerCase().includes(keyword) ||
    tool.description.toLowerCase().includes(keyword) ||
    tool.category.toLowerCase().includes(keyword) ||
    tool.tags.some((tag) => tag.toLowerCase().includes(keyword));

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter(
        (tool) => matchKeyword(tool) && (!activeTag || tool.tags.includes(activeTag)),
      ),
    }))
    .filter((group) => group.tools.length > 0);

  const hasFilter = keyword !== "" || activeTag !== null;

  return (
    <div>
      {/* 实时搜索框 */}
      <div className="relative mb-5 animate-fade-up [animation-delay:180ms]">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-sakura-300" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称、描述、标签或分类…"
          aria-label="搜索工具"
          className="w-full rounded-full border-2 border-sakura-100 bg-white py-3 pl-11 pr-11 text-sm shadow-soft transition-all placeholder:text-ink/30 focus:border-sakura-300 focus:outline-none focus:ring-4 focus:ring-sakura-100 [&::-webkit-search-cancel-button]:hidden"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="清空搜索"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-sakura-100 p-1.5 text-sakura-500 transition-all hover:bg-sakura-200 active:scale-90"
          >
            <CloseIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* 标签筛选 */}
      {tags.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center gap-2">
          <SakuraFlower className="size-5 animate-wiggle text-sakura-300" />
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-all active:scale-95 ${
              activeTag === null
                ? "bg-sakura-400 text-white shadow-soft"
                : "bg-white text-ink/55 ring-2 ring-sakura-100 hover:-translate-y-0.5 hover:bg-sakura-50"
            }`}
          >
            全部
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-all active:scale-95 ${
                activeTag === tag
                  ? "bg-sakura-400 text-white shadow-soft"
                  : "bg-white text-ink/55 ring-2 ring-sakura-100 hover:-translate-y-0.5 hover:bg-sakura-50"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {visibleGroups.length === 0 ? (
        <div className="animate-fade-up rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center">
          <EmptySearchArt className="mx-auto w-44 animate-float" />
          <p className="mt-4 font-display text-lg text-ink/70">什么都没找到…</p>
          <p className="mt-1 text-sm text-ink/45">
            换个关键词试试，或者清除当前的筛选条件
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveTag(null);
              }}
              className="mt-5 rounded-full bg-sakura-400 px-5 py-2 text-sm font-bold text-white shadow-soft transition-all hover:bg-sakura-500 hover:shadow-pop active:scale-95"
            >
              清空筛选
            </button>
          )}
        </div>
      ) : (
        visibleGroups.map((group) => (
          <section key={group.category} id={group.category} className="mb-10 scroll-mt-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl text-ink">
              <SparkleStar className="size-4 text-sakura-400" />
              {group.category}
              <span className="rounded-full bg-lav-100 px-2 py-0.5 text-xs font-bold text-lav-500">
                {group.tools.length}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool, index) => (
                <div
                  key={tool.id}
                  className="h-full animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                >
                  <ToolCard
                    tool={tool}
                    favorited={favoriteSet.has(tool.id)}
                    loggedIn={loggedIn}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}