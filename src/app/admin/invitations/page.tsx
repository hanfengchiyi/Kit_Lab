import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guards";
import { createInvitation, deleteInvitation } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";

export const metadata: Metadata = {
  title: "邀请码管理",
};

export default async function InvitationsPage() {
  await requireAdminPage();

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    include: { usedBy: { select: { email: true, name: true } } },
  });

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">邀请码管理</h1>
          <p className="mt-1 text-sm text-ink/45">
            注册必须凭邀请码。已使用 {invitations.filter((i) => i.usedById).length} / {invitations.length} 个。
          </p>
        </div>
      </div>

      <form
        action={createInvitation}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border-2 border-sakura-100 bg-white p-4"
      >
        <div className="min-w-48 flex-1">
          <label htmlFor="note" className="mb-1 block text-xs font-bold text-ink/50">
            备注（可选，如：给某某）
          </label>
          <input
            id="note"
            name="note"
            maxLength={100}
            className="w-full rounded-xl border-2 border-sakura-100 px-3 py-2 text-sm focus:border-sakura-400 focus:outline-none"
            placeholder="这个邀请码给谁用"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95"
        >
          + 生成邀请码
        </button>
      </form>

      {invitations.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center font-display text-lg text-ink/70">
          还没有邀请码，点上方按钮生成一个
        </p>
      ) : (
        <div className="space-y-2.5">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-sakura-100 bg-white px-4 py-3"
            >
              <code className="rounded-lg bg-lav-50 px-3 py-1 font-mono text-sm font-bold text-lav-600 select-all">
                {inv.code}
              </code>
              {inv.usedById ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                  已使用 · {inv.usedBy?.name || inv.usedBy?.email}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                  未使用
                </span>
              )}
              {inv.note && <span className="text-xs text-ink/45">{inv.note}</span>}
              <span className="ml-auto text-xs text-ink/35">
                {inv.createdAt.toLocaleString("zh-CN")}
              </span>
              {!inv.usedById && (
                <form action={deleteInvitation.bind(null, inv.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border-2 border-red-100 px-2.5 py-1 text-xs font-bold text-red-400 transition-colors hover:bg-red-50"
                  >
                    删除
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ink/35">
        把邀请码发给要注册的人，每个码只能注册一个账号。
        <Link href="/admin" className="ml-2 text-sakura-400 hover:underline">返回管理后台</Link>
      </p>
    </div>
  );
}