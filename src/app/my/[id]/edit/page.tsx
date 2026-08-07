import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ToolForm } from "@/components/tool-form";

export const metadata: Metadata = {
  title: "编辑工具",
};

export default async function EditMyToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  // 私有条目仅属主可编辑，其他情况一律 404
  if (!tool || tool.visibility !== "private" || tool.ownerId !== session.user.id) {
    notFound();
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">编辑私有工具</h1>
      <ToolForm
        visibility="private"
        cancelHref="/my"
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
    </div>
  );
}
