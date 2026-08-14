import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth-guards";
import { listCategories } from "@/lib/categories";
import { toggleCategoryDefault } from "@/lib/actions/admin";
import { AdminNav } from "@/components/admin-nav";
import { CategoryCreateForm } from "@/components/category-create-form";
import { CategoryDeleteButton } from "@/components/category-delete-button";

export const metadata: Metadata = {
  title: "分组管理",
};

export const dynamic = "force-dynamic";

export default async function CategoriesAdminPage() {
  await requireAdminPage();

  const metas = await listCategories();

  return (
    <div className="animate-fade-up">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink">分组管理</h1>
        <p className="mt-1 text-sm text-ink/45">
          新建工具分组，并设置每个分组是「默认全员可用」还是「需单独授权」。
        </p>
      </div>

      {/* 新建分组（客户端表单，展示服务端错误） */}
      <CategoryCreateForm nextOrder={metas.length + 1} />

      {/* 分组列表 */}
      <div className="space-y-2.5">
        {metas.map((meta) => (
          <div
            key={meta.name}
            className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-sakura-100 bg-white px-4 py-3"
          >
            <span className="font-bold text-ink">{meta.name}</span>
            <span className="text-xs text-ink/35">排序 {meta.order}</span>
            {meta.defaultGrant ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-500">
                默认全员可用
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                需单独授权
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <form action={toggleCategoryDefault.bind(null, meta.name)}>
                <button
                  type="submit"
                  className="rounded-lg border-2 border-sakura-100 px-3 py-1.5 text-xs font-bold text-ink/60 transition-colors hover:bg-sakura-50"
                >
                  切换为{meta.defaultGrant ? "「需单独授权」" : "「默认全员可用」"}
                </button>
              </form>
              <CategoryDeleteButton name={meta.name} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink/35">
        说明：删除分组前需先移走或删除该分组下的全部工具；「需单独授权」的分组在「分类授权」页按人分配。
      </p>
    </div>
  );
}