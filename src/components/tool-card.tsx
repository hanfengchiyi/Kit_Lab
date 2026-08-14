import { FavoriteButton } from "@/components/favorite-button";
import { ToolIcon } from "@/components/tool-icon";
import type { ToolDTO } from "@/lib/constants";

interface ToolCardProps {
  tool: ToolDTO;
  favorited: boolean;
  loggedIn: boolean;
}

export function ToolCard({ tool, favorited, loggedIn }: ToolCardProps) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border-2 border-sakura-100 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-sakura-200 hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <ToolIcon icon={tool.icon} />
          <a
            href={tool.url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-bold text-ink transition-colors hover:text-sakura-500"
            title={tool.name}
          >
            {tool.name}
          </a>
        </div>
        <FavoriteButton toolId={tool.id} initialFavorited={favorited} loggedIn={loggedIn} />
      </div>
      <p className="mt-2.5 line-clamp-2 flex-1 text-sm leading-relaxed text-ink/55">
        {tool.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            tool.source === "self"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-skyblue-50 text-skyblue-500"
          }`}
        >
          {tool.source === "self" ? "自研" : "第三方"}
        </span>
        {tool.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-lav-50 px-2 py-0.5 text-xs text-lav-500"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
