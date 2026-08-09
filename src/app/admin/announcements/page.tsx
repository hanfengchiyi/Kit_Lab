import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteAnnouncement, toggleAnnouncementPublished } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";
import { AnnouncementForm } from "@/components/announcement-form";

export const metadata: Metadata = {
  title: "公告与用户守则管理",
};

export default async function AdminAnnouncementsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const items = await prisma.announcement.findMany({
    orderBy: [{ kind: "asc" }, { order: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">公告与用户守则</h1>
        <p className="mt-1 text-sm text-ink/45">
          发布后的内容展示在公开的「公告 / 守则」页面，共 {items.length} 条。
        </p>
      </div>

      <details className="mb-6 rounded-2xl border-2 border-sakura-100 bg-white p-4">
        <summary className="cursor-pointer text-sm font-bold text-sakura-500">
          + 发布新内容
        </summary>
        <AnnouncementForm />
      </details>

      {items.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center font-display text-lg text-ink/70">
          暂无内容
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border-2 border-sakura-100 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    item.kind === "rule"
                      ? "bg-skyblue-50 text-skyblue-500"
                      : "bg-sakura-50 text-sakura-500"
                  }`}
                >
                  {item.kind === "rule" ? "用户守则" : "公告"}
                </span>
                <h3 className="font-bold text-ink">{item.title}</h3>
                {!item.published && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-400">
                    未发布
                  </span>
                )}
                <span className="ml-auto text-xs text-ink/35">
                  {item.updatedAt.toLocaleString("zh-CN")}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-ink/60">
                {item.content}
              </p>
              <div className="mt-3 flex gap-2">
                <details className="flex-1">
                  <summary className="inline-block cursor-pointer rounded-lg border-2 border-sakura-100 px-2.5 py-1 text-xs font-bold text-ink/50 hover:bg-sakura-50">
                    编辑
                  </summary>
                  <AnnouncementForm
                    initial={{
                      id: item.id,
                      title: item.title,
                      content: item.content,
                      kind: item.kind as "announcement" | "rule",
                      order: item.order,
                      published: item.published,
                    }}
                  />
                </details>
                <form action={toggleAnnouncementPublished.bind(null, item.id)}>
                  <button
                    type="submit"
                    className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition-colors ${
                      item.published
                        ? "border-amber-200 text-amber-500 hover:bg-amber-50"
                        : "border-emerald-200 text-emerald-500 hover:bg-emerald-50"
                    }`}
                  >
                    {item.published ? "撤回" : "重新发布"}
                  </button>
                </form>
                <form action={deleteAnnouncement.bind(null, item.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border-2 border-red-100 px-2.5 py-1 text-xs font-bold text-red-400 transition-colors hover:bg-red-50"
                  >
                    删除
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
