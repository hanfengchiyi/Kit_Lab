import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { GrantEditor } from "@/components/grant-editor";

export const metadata: Metadata = {
  title: "分类授权",
};

export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { categoryGrants: true },
  });

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">分类授权</h1>
        <p className="mt-1 text-sm text-ink/45">
          控制每个用户能使用哪些工具分类。不做任何勾选表示「不限分类」；勾选后该用户首页只显示所选分类的工具。
        </p>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-2xl border-2 border-sakura-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">{user.name || user.email}</span>
              <span className="text-xs text-ink/40">{user.email}</span>
              {user.role === "admin" && (
                <span className="rounded-full bg-sakura-50 px-2.5 py-0.5 text-xs font-bold text-sakura-500">
                  管理员
                </span>
              )}
              {user.categoryGrants.length > 0 ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                  受限 · {user.categoryGrants.length} 个分类
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                  不限分类
                </span>
              )}
            </div>
            {user.role === "admin" ? (
              <p className="mt-2 text-xs text-ink/35">管理员不受分类授权限制。</p>
            ) : (
              <GrantEditor
                userId={user.id}
                initialGrants={user.categoryGrants.map((g) => g.category)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
