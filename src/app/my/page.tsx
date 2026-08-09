import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ToolRow } from "@/components/tool-row";
import { EmptyBoxArt } from "@/components/decorations";
import { getToolHref, HTML_TOOL_QUOTA_BYTES } from "@/lib/html-tools";

export const metadata: Metadata = {
  title: "我的工具",
};

export default async function MyToolsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [tools, user] = await Promise.all([
    prisma.tool.findMany({
      where: { ownerId: session.user.id, visibility: "private" },
      orderBy: [{ order: "asc" }, { addedAt: "desc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { htmlStorageUsedBytes: true },
    }),
  ]);
  const usedBytes = user?.htmlStorageUsedBytes || 0;
  const usagePercent = Math.min(100, (usedBytes / HTML_TOOL_QUOTA_BYTES) * 100);

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">我的工具</h1>
          <p className="mt-1 text-sm text-ink/45">
            私有条目仅自己可见，是你的秘密道具袋。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/my/new"
            className="rounded-xl border-2 border-sakura-200 bg-white px-4 py-2 text-sm font-bold text-sakura-500 transition-all hover:bg-sakura-50 active:scale-95"
          >
            + 添加链接
          </Link>
          <Link
            href="/my/upload"
            className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95"
          >
            ↑ 上传 HTML
          </Link>
        </div>
      </div>

      <section
        aria-labelledby="html-storage-title"
        className="mb-6 rounded-2xl border-2 border-skyblue-100 bg-white/80 p-4 shadow-soft"
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="html-storage-title" className="text-sm font-bold text-ink/70">
              HTML 本地存储
            </h2>
            <p className="mt-1 text-xs text-ink/45">每位用户最多可保存 1 GB，ZIP 按解压后大小计算</p>
          </div>
          <p className="shrink-0 text-sm font-bold text-skyblue-600">
            {formatBytes(usedBytes)} / 1 GB
          </p>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-skyblue-50"
          role="progressbar"
          aria-label="HTML 本地存储用量"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usagePercent)}
        >
          <div
            className={`h-full rounded-full transition-all ${
              usagePercent >= 90 ? "bg-red-400" : "bg-gradient-to-r from-skyblue-300 to-lav-300"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </section>

      {tools.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center">
          <EmptyBoxArt className="mx-auto w-44 animate-float" />
          <p className="mt-4 font-display text-lg text-ink/70">道具袋还空空的</p>
          <p className="mt-1 text-sm text-ink/45">
            点击右上角「添加链接」或「上传 HTML」，藏入只有你自己能看到的工具
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool, index) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              editHref={`/my/${tool.id}/edit`}
              index={index}
              href={getToolHref(tool)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
