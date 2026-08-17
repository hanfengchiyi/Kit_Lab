import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guards";
import { ToolForm } from "@/components/tool-form";
import { HtmlToolUploadForm } from "@/components/html-tool-upload-form";
import { HTML_TOOL_QUOTA_BYTES } from "@/lib/html-tools";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "编辑公共工具",
};

export default async function EditAdminToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();

  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  // 公共条目，或已下架（私有且无属主）的条目，管理员均可编辑
  if (!tool || (tool.visibility !== "public" && tool.ownerId !== null)) {
    notFound();
  }

  const categories = await listCategoryNames();

  // 公共 HTML 工具的额度归属原属主，替换前先取属主的剩余额度
  let remainingBytes = HTML_TOOL_QUOTA_BYTES;
  if (tool.kind === "html" && tool.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: tool.ownerId },
      select: { htmlStorageUsedBytes: true },
    });
    remainingBytes = Math.max(0, HTML_TOOL_QUOTA_BYTES - (owner?.htmlStorageUsedBytes ?? 0));
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">编辑公共工具</h1>
      <ToolForm
        visibility="public"
        cancelHref="/admin"
        categories={categories}
        initial={{
          id: tool.id,
          name: tool.name,
          url: tool.url,
          description: tool.description,
          category: tool.category,
          tags: tool.tags,
          source: tool.source,
          icon: tool.icon,
          order: tool.order,
        }}
      />

      {tool.kind === "html" && tool.ownerId && (
        <section className="mt-10 max-w-xl" aria-labelledby="replace-html-title">
          <h2 id="replace-html-title" className="font-display text-xl text-ink">
            更新内容
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            替换 HTML / ZIP 后访问地址保持不变、立即生效；额度按属主账户的剩余空间结算。
          </p>
          <div className="mt-4">
            <HtmlToolUploadForm
              replaceToolId={tool.id}
              remainingBytes={remainingBytes}
              maxBytes={remainingBytes + tool.htmlBytes}
              quotaBytes={HTML_TOOL_QUOTA_BYTES}
              categories={categories}
            />
          </div>
        </section>
      )}
    </div>
  );
}