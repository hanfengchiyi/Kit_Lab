import Link from "next/link";
import { parseTags } from "@/lib/constants";
import { DeleteToolButton } from "@/components/delete-tool-button";

/** 列表行所需的最小工具字段，/my 与 /admin 直接传入 Prisma Tool 记录即可 */
export interface ToolRowTool {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  /** 数据库中的逗号分隔标签串 */
  tags: string;
  source: string;
  icon: string | null;
  kind?: string;
  htmlBytes?: number;
}

interface ToolRowProps {
  tool: ToolRowTool;
  /** 编辑链接，如 /my/<id>/edit 或 /admin/<id>/edit */
  editHref: string;
  /** 列表序号，用于 stagger 入场动画延迟 */
  index: number;
  /** HTML 工具可传入按当前环境解析后的独立内容域名链接 */
  href?: string;
  /** 额外操作区内容（如「申请公开」按钮） */
  extra?: React.ReactNode;
}

/** /my 与 /admin 共用的工具列表行：图标、徽标、描述、编辑/删除操作 */
export function ToolRow({ tool, editHref, index, href, extra }: ToolRowProps) {
  return (
    <div
      className="flex animate-fade-up flex-wrap items-center gap-3 rounded-2xl border-2 border-sakura-100 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sakura-50 text-2xl"
        aria-hidden
      >
        {tool.icon?.startsWith("/api/icons/") ? (
              <img src={tool.icon} alt="" className="size-full rounded-xl object-cover" />
            ) : (
              tool.icon || "🔧"
            )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={href || tool.url}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-ink transition-colors hover:text-sakura-500"
          >
            {tool.name}
          </a>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              tool.source === "self"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-skyblue-50 text-skyblue-500"
            }`}
          >
            {tool.source === "self" ? "自研" : "第三方"}
          </span>
          <span className="rounded-full bg-sakura-50 px-2 py-0.5 text-xs font-bold text-sakura-500">
            {tool.category}
          </span>
          {tool.kind === "html" && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">
              HTML · {formatBytes(tool.htmlBytes || 0)}
            </span>
          )}
          {parseTags(tool.tags).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-lav-50 px-2 py-0.5 text-xs text-lav-500"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-1 truncate text-sm text-ink/45">{tool.description}</p>
      </div>
      <div className="flex items-center gap-3">
        {extra}
        <Link
          href={editHref}
          className="text-sm font-bold text-skyblue-500 transition-colors hover:text-skyblue-600"
        >
          编辑
        </Link>
        <DeleteToolButton
          id={tool.id}
          name={tool.name}
          removesLocalFiles={tool.kind === "html"}
        />
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
