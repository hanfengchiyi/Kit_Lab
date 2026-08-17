"use client";

import { useTransition, useState } from "react";
import { reviewHtmlUpdate } from "@/lib/actions/admin";

const inputClass =
  "min-w-48 flex-1 rounded-lg border-2 border-sakura-100 px-3 py-1.5 text-xs focus:border-sakura-400 focus:outline-none";

/**
 * 更新审批表单：备注 + 通过（草稿晋升为公开版）/ 拒绝（草稿保留，可修改后重新申请）。
 * 拆成客户端组件是为了让「通过/拒绝」成为显式点击动作——按 Enter 不会误触发审批。
 */
export function HtmlUpdateReviewForm({ toolId }: { toolId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (decision: "approve" | "reject") => {
    setError(null);
    const form = document.getElementById(`html-update-form-${toolId}`) as HTMLFormElement | null;
    const formData = form ? new FormData(form) : new FormData();
    formData.set("decision", decision);
    startTransition(async () => {
      try {
        await reviewHtmlUpdate(toolId, formData);
      } catch (cause) {
        console.error("更新审批操作失败：", cause);
        setError("操作失败，请稍后再试");
      }
    });
  };

  return (
    <form
      id={`html-update-form-${toolId}`}
      onSubmit={(event) => event.preventDefault()}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input name="note" maxLength={200} placeholder="审批备注（可选）" className={inputClass} />
      <button
        type="button"
        disabled={pending}
        onClick={() => run("approve")}
        className="rounded-lg bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
      >
        ✓ 通过并公开新版本
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("reject")}
        className="rounded-lg bg-red-400 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-red-500 active:scale-95 disabled:opacity-50"
      >
        ✕ 拒绝
      </button>
      {error && (
        <p role="alert" className="text-xs font-bold text-red-500">
          {error}
        </p>
      )}
    </form>
  );
}
