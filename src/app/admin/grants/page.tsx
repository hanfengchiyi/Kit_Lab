import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guards";
import { AdminNav } from "@/components/admin-nav";
import { GrantEditor } from "@/components/grant-editor";
import { listCategories } from "@/lib/categories";

export const metadata: Metadata = {
  title: "分类授权",
};

export const dynamic = "force-dynamic";

export default async function GrantsPage() {
  await requireAdminPage();

  const metas = await listCategories();
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
          用户可用分组 = 「分组管理」中默认全员授权的分组 ∪ 此处为个人勾选的分组。绿色为默认分组，无需勾选。
        </p>
      </div>

      {users.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-sakura-200 bg-white/70 py-14 text-center font-display text-lg text-ink/70">
          暂无注册用户
        </p>
      ) : (
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
              {user.categoryGrants.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                  额外授权 {user.categoryGrants.length} 个分组
                </span>
              )}
            </div>
            {user.role === "admin" ? (
              <p className="mt-2 text-xs text-ink/35">管理员不受分类授权限制。</p>
            ) : (
              <GrantEditor
                userId={user.id}
                initialGrants={user.categoryGrants.map((g) => g.category)}
                categories={metas.map((m) => m.name)}
                defaultCategories={metas.filter((m) => m.defaultGrant).map((m) => m.name)}
              />
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}