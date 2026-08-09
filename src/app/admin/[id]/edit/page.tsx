import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ToolForm } from "@/components/tool-form";
import { listCategoryNames } from "@/lib/categories";

export const metadata: Metadata = {
  title: "编辑公共工具",
};

export default async function EditAdminToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const { id } = await params;
  const tool = await prisma.tool.findUnique({ where: { id } });
  // 公共条目，或已下架（私有且无属主）的条目，管理员均可编辑
  if (!tool || (tool.visibility !== "public" && tool.ownerId !== null)) {
    notFound();
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl text-ink">编辑公共工具</h1>
      <ToolForm
        visibility="public"
        cancelHref="/admin"
        categories={await listCategoryNames()}
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
