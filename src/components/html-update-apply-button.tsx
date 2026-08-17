"use client";

import { useActionState } from "react";
import { applyHtmlUpdate } from "@/lib/actions/tools";

/** 属主「申请更新公开版本」按钮：草稿存在且未在审批中时可用 */
export function ApplyHtmlUpdateButton({ toolId }: { toolId: string }) {
  const [state, formAction, pending] = useActionState(
    async () => applyHtmlUpdate(toolId),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
      >
        {pending ? "申请中…" : "申请更新公开版本"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-red-500">
          {state.error}
        </p>
      )}
    </form>
  );
}
