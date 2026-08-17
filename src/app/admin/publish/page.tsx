import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guards";
import { adminPushToPublic, adminUnpublish } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";
import { PublishReviewForm } from "@/components/publish-review-form";
import { HtmlUpdateReviewForm } from "@/components/html-update-review-form";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = {
  title: "推送审批",
};

export const dynamic = "force-dynamic";

export default async function PublishReviewPage() {
  await requireAdminPage();

  const [pending, privateTools, publishedFromUsers, htmlUpdates] = await Promise.all([
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
    prisma.tool.findMany({
      where: { visibility: "public", kind: "html", htmlUpdateStatus: "pending" },
      include: { owner: { select: { email: true, name: true } } },
      orderBy: { addedAt: "asc" },
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
                <PublishReviewForm toolId={tool.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 更新审批：公开 HTML 工具的创作者草稿 */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-ink">
          更新审批 <span className="text-sm text-ink/40">（{htmlUpdates.length}）</span>
        </h2>
        {htmlUpdates.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-sakura-200 bg-white/70 py-8 text-center text-sm text-ink/40">
            没有待审批的更新申请
          </p>
        ) : (
          <div className="space-y-3">
            {htmlUpdates.map((tool) => (
              <div key={tool.id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-ink">{tool.name}</h3>
                  <span className="rounded-full bg-lav-50 px-2.5 py-0.5 text-xs text-lav-500">
                    {tool.category}
                  </span>
                  <span className="text-xs text-ink/45">来自 {ownerLabel(tool.owner)}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink/60">{tool.description}</p>
                <p className="mt-1.5 text-xs font-bold text-ink/55">
                  公开版 {tool.htmlEntry} · {formatBytes(tool.htmlBytes)}
                  <span className="mx-1.5 text-ink/30">→</span>
                  草稿 {tool.htmlDraftEntry} · {formatBytes(tool.htmlDraftBytes)}
                </p>
                <HtmlUpdateReviewForm toolId={tool.id} />
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
        {publishedFromUsers.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-sakura-200 bg-white/70 py-8 text-center text-sm text-ink/40">
            暂无已公开的用户工具
          </p>
        ) : (
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
              {tool.kind === "html" && tool.htmlUpdateStatus === "pending" && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-600">
                  有更新待审批
                </span>
              )}
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
        )}
      </section>
    </div>
  );
}