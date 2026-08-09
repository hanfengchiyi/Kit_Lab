import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HtmlToolUploadForm } from "@/components/html-tool-upload-form";
import { HTML_TOOL_QUOTA_BYTES } from "@/lib/html-tools";
import { listCategoryNames } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "上传 HTML 工具",
};

export default async function UploadHtmlToolPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { htmlStorageUsedBytes: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">上传 HTML 工具</h1>
        <p className="mt-1 text-sm text-ink/45">上传后会保存在服务器本地，并自动出现在“我的工具”中。</p>
      </div>
      <HtmlToolUploadForm
        quotaBytes={HTML_TOOL_QUOTA_BYTES}
        remainingBytes={Math.max(0, HTML_TOOL_QUOTA_BYTES - user.htmlStorageUsedBytes)}
        categories={await listCategoryNames()}
      />
    </div>
  );
}
