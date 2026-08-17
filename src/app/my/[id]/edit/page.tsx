import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth-guards";
import { ToolForm } from "@/components/tool-form";
import { HtmlToolUploadForm } from "@/components/html-tool-upload-form";
import { HTML_TOOL_QUOTA_BYTES } from "@/lib/html-tools";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "编辑工具",
};

export default async function EditMyToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUserPage();

  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  // 私有条目仅属主可编辑，其他情况一律 404
  if (!tool || tool.visibility !== "private" || tool.ownerId !== user.id) {
    notFound();
  }

  const categories = await listCategoryNames();
  const storage = await prisma.user.findUnique({
    where: { id: user.id },
    select: { htmlStorageUsedBytes: true },
  });
  const remainingBytes = Math.max(0, HTML_TOOL_QUOTA_BYTES - (storage?.htmlStorageUsedBytes ?? 0));

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">编辑私有工具</h1>
      <ToolForm
        visibility="private"
        cancelHref="/my"
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
          kind: tool.kind,
          htmlBytes: tool.htmlBytes,
        }}
      />

      {tool.kind === "html" && (
        <section className="mt-10 max-w-xl" aria-labelledby="replace-html-title">
          <h2 id="replace-html-title" className="font-display text-xl text-ink">
            更新内容
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            替换 HTML / ZIP 后访问地址保持不变、立即生效；名称、描述等展示信息请在下方表单中修改。
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