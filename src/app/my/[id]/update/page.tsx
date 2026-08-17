import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserPage } from "@/lib/auth-guards";
import { HtmlToolUploadForm } from "@/components/html-tool-upload-form";
import { ApplyHtmlUpdateButton } from "@/components/html-update-apply-button";
import { HTML_TOOL_QUOTA_BYTES } from "@/lib/html-tools";
import { listCategoryNames } from "@/lib/categories";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = {
  title: "更新公开版本",
};

export default async function UpdateMyToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUserPage();

  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  // 仅属主可更新自己已公开的 HTML 工具
  if (!tool || tool.ownerId !== user.id || tool.visibility !== "public" || tool.kind !== "html") {
    notFound();
  }

  const [storage, categories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { htmlStorageUsedBytes: true },
    }),
    listCategoryNames(),
  ]);
  const remainingBytes = Math.max(0, HTML_TOOL_QUOTA_BYTES - (storage?.htmlStorageUsedBytes ?? 0));

  const hasDraft = !!tool.htmlDraftEntry && tool.htmlDraftBytes > 0;
  const status = tool.htmlUpdateStatus as "none" | "pending" | "rejected";

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl text-ink">更新公开版本</h1>
      <p className="mt-1 text-sm text-ink/45">
        你打开工具时看到的是最新草稿；公开访客看到的仍是已审批的公开版，直到更新申请通过。
      </p>

      <div className="mt-6 max-w-xl space-y-3">
        <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 p-4 text-sm">
          <p className="font-bold text-emerald-600">公开版（所有人可见）</p>
          <p className="mt-1 text-xs text-ink/55">
            入口 {tool.htmlEntry} · {formatBytes(tool.htmlBytes)}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-skyblue-100 bg-skyblue-50/40 p-4 text-sm">
          <p className="font-bold text-skyblue-600">你的草稿（仅你和管理员可见）</p>
          {hasDraft ? (
            <>
              <p className="mt-1 text-xs text-ink/55">
                入口 {tool.htmlDraftEntry} · {formatBytes(tool.htmlDraftBytes)}
              </p>
              {status === "pending" && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-600">
                  更新申请已提交，等待管理员审批
                </p>
              )}
              {status === "rejected" && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500">
                  更新申请被拒绝{tool.htmlUpdateNote ? `：${tool.htmlUpdateNote}` : ""}，可修改草稿后重新申请
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-ink/45">暂无草稿，替换下方文件后即可使用最新版并申请公开</p>
          )}
          {hasDraft && status !== "pending" && (
            <div className="mt-3">
              <ApplyHtmlUpdateButton toolId={tool.id} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <HtmlToolUploadForm
          replaceToolId={tool.id}
          remainingBytes={remainingBytes}
          maxBytes={remainingBytes + tool.htmlDraftBytes}
          quotaBytes={HTML_TOOL_QUOTA_BYTES}
          categories={categories}
        />
      </div>
    </div>
  );
}
