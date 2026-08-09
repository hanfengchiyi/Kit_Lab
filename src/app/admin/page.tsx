import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ToolRow } from "@/components/tool-row";
import { AdminNav } from "@/components/admin-nav";
import { adminRepublish, adminUnpublish } from "@/lib/actions/admin";
import { EmptyBoxArt } from "@/components/decorations";

export const metadata: Metadata = {
  title: "管理后台",
};

export default async function AdminPage() {
  const session = await auth();
  // 非管理员无权访问管理后台
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const tools = await prisma.tool.findMany({
    where: { visibility: "public" },
    orderBy: [{ category: "asc" }, { order: "asc" }, { addedAt: "asc" }],
  });
  // 已下架：私有且无属主的条目（用户工具下架后仍归原属主，不在此列）
  const takenDown = await prisma.tool.findMany({
    where: { visibility: "private", ownerId: null },
    orderBy: { addedAt: "desc" },
  });

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">管理后台</h1>
          <p className="mt-1 text-sm text-ink/45">
            维护全站公开的公共工具条目，共 {tools.length} 条。
          </p>
        </div>
        <Link
          href="/admin/new"
          className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95"
        >
          + 新增公共工具
        </Link>
      </div>

      {tools.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center">
          <EmptyBoxArt className="mx-auto w-44 animate-float" />
          <p className="mt-4 font-display text-lg text-ink/70">暂无公共工具条目</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool, index) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              editHref={`/admin/${tool.id}/edit`}
              index={index}
              extra={
                <form action={adminUnpublish.bind(null, tool.id)}>
                  <button
                    type="submit"
                    className="text-sm font-bold text-amber-500 transition-colors hover:text-amber-600"
                    title="下架后从首页消失，仅管理员可见，可随时恢复上架"
                  >
                    下架
                  </button>
                </form>
              }
            />
          ))}
        </div>
      )}

      {takenDown.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg text-ink">
            已下架 <span className="text-sm text-ink/40">（{takenDown.length}，仅管理员可见）</span>
          </h2>
          <div className="space-y-3">
            {takenDown.map((tool, index) => (
              <ToolRow
                key={tool.id}
                tool={tool}
                editHref={`/admin/${tool.id}/edit`}
                index={index}
                extra={
                  <form action={adminRepublish.bind(null, tool.id)}>
                    <button
                      type="submit"
                      className="text-sm font-bold text-emerald-500 transition-colors hover:text-emerald-600"
                    >
                      ↑ 恢复上架
                    </button>
                  </form>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
