"use client";

import { useActionState } from "react";
import { createCategory } from "@/lib/actions/admin";

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 px-3 py-2 text-sm focus:border-sakura-400 focus:outline-none";

/** 新建分组的客户端表单：展示服务端返回的错误（如重名），与其它表单风格一致 */
export function CategoryCreateForm({ nextOrder }: { nextOrder: number }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => createCategory(formData),
    undefined,
  );

  return (
    <form
      action={formAction}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border-2 border-sakura-100 bg-white p-4"
    >
      <div className="min-w-44 flex-1">
        <label htmlFor="name" className="mb-1 block text-xs font-bold text-ink/50">
          分组名称 *
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={20}
          className={inputClass}
          placeholder="如：AI 工具"
        />
      </div>
      <div>
        <label htmlFor="order" className="mb-1 block text-xs font-bold text-ink/50">
          排序（小在前）
        </label>
        <input
          id="order"
          name="order"
          type="number"
          defaultValue={nextOrder}
          className={`${inputClass} w-24`}
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm font-bold text-ink/60">
        <input
          type="checkbox"
          name="defaultGrant"
          defaultChecked
          className="size-4 accent-sakura-400"
        />
        默认全员可用
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
      >
        {pending ? "创建中…" : "+ 新建分组"}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-xs font-bold text-red-500">
          {state.error}
        </p>
      )}
    </form>
  );
}
