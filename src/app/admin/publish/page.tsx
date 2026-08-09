import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPushToPublic, adminUnpublish, reviewPublish } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";

export const metadata: Metadata = {
  title: "推送审批",
};

export const dynamic = "force-dynamic";

export default async function PublishReviewPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const [pending, privateTools, publishedFromUsers] = await Promise.all([
    prisma.tool.findMany({
      where: { publishStatus: "pending" },
      include: { owner: { select: { email: true, name: true } } },
      orderBy: { addedAt: "asc" },
    }),
    prisma.tool.findMany({
      where: { visibility: "private", publishStatus: { in: ["none", "rejected"] } },
      include: { owner: { select: { email: true, name: true } } },
      orderBy: { addedAt: "desc" },
    }),
    prisma.tool.findMany({
      where: { visibility: "public", ownerId: { not: null } },
      include: { owner: { select: { email: true, name: true } } },
      orderBy: { addedAt: "desc" },
    }),
  ]);

  const ownerLabel = (o: { email: string; name: string | null } | null) =>
    o ? o.name || o.email : "未知";

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">推送审批</h1>
        <p className="mt-1 text-sm text-ink/45">
          处理用户推送公开的申请，或直接把用户的个人工具推送为公开。
        </p>
      </div>

      {/* 待审批 */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-ink">
          待审批 <span className="text-sm text-ink/40">（{pending.length}）</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-sakura-200 bg-white/70 py-8 text-center text-sm text-ink/40">
            没有待审批的申请
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((tool) => (
              <div key={tool.id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink">{tool.name}</h3>
                  <span className="rounded-full bg-lav-50 px-2.5 py-0.5 text-xs text-lav-500">
                    {tool.category}
                  </span>
                  <span className="text-xs text-ink/45">来自 {ownerLabel(tool.owner)}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink/60">{tool.description}</p>
                {tool.kind !== "html" && (
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-sakura-400 hover:underline"
                  >
                    {tool.url}
                  </a>
                )}
                <form action={reviewPublish.bind(null, tool.id)} className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    name="note"
                    maxLength={200}
                    placeholder="审批备注（可选）"
                    className="min-w-48 flex-1 rounded-lg border-2 border-sakura-100 px-3 py-1.5 text-xs focus:border-sakura-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    name="decision"
                    value="approve"
                    className="rounded-lg bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-500 active:scale-95"
                  >
                    ✓ 通过并公开
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="reject"
                    className="rounded-lg bg-red-400 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-red-500 active:scale-95"
                  >
                    ✕ 拒绝
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 管理员直推：全部用户的私有工具 */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-ink">
          用户个人工具 <span className="text-sm text-ink/40">（{privateTools.length}，可直接推送公开）</span>
        </h2>
        {privateTools.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-sakura-200 bg-white/70 py-8 text-center text-sm text-ink/40">
            暂无用户个人工具
          </p>
        ) : (
          <div className="space-y-2.5">
            {privateTools.map((tool) => (
              <div
                key={tool.id}
                className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-sakura-100 bg-white px-4 py-3"
              >
                <span className="font-bold text-ink">{tool.name}</span>
                <span className="rounded-full bg-lav-50 px-2.5 py-0.5 text-xs text-lav-500">
                  {tool.category}
                </span>
                {tool.publishStatus === "rejected" && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-400">
                    曾被拒绝
                  </span>
                )}
                <span className="text-xs text-ink/45">{ownerLabel(tool.owner)}</span>
                <form action={adminPushToPublic.bind(null, tool.id)} className="ml-auto">
                  <button
                    type="submit"
                    className="rounded-lg bg-gradient-to-r from-sakura-400 to-sakura-500 px-3 py-1.5 text-xs font-bold text-white transition-all hover:shadow-pop active:scale-95"
                  >
                    ↑ 推送为公开
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 已推送公开的用户工具（可下架） */}
      <section>
        <h2 className="mb-3 font-display text-lg text-ink">
          已公开的用户工具 <span className="text-sm text-ink/40">（{publishedFromUsers.length}）</span>
        </h2>
        <div className="space-y-2.5">
          {publishedFromUsers.map((tool) => (
            <div
              key={tool.id}
              className="flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 px-4 py-3"
            >
              <span className="font-bold text-ink">{tool.name}</span>
              <span className="rounded-full bg-lav-50 px-2.5 py-0.5 text-xs text-lav-500">
                {tool.category}
              </span>
              <span className="text-xs text-ink/45">{ownerLabel(tool.owner)}</span>
              <form action={adminUnpublish.bind(null, tool.id)} className="ml-auto">
                <button
                  type="submit"
                  className="rounded-lg border-2 border-red-100 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-50"
                >
                  ↓ 下架回私有
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
