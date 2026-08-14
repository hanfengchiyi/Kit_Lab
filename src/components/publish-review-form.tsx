"use client";

import { useTransition, useState } from "react";
import { reviewPublish } from "@/lib/actions/admin";

const inputClass =
  "min-w-48 flex-1 rounded-lg border-2 border-sakura-100 px-3 py-1.5 text-xs focus:border-sakura-400 focus:outline-none";

/**
 * 推送审批表单：备注 + 通过 / 拒绝。
 * 拆成客户端组件是为了让「通过/拒绝」成为显式点击动作——按 Enter 不会误触发审批。
 */
export function PublishReviewForm({ toolId }: { toolId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (decision: "approve" | "reject") => {
    setError(null);
    const form = document.getElementById(`publish-form-${toolId}`) as HTMLFormElement | null;
    const formData = form ? new FormData(form) : new FormData();
    formData.set("decision", decision);
    startTransition(async () => {
      try {
        await reviewPublish(toolId, formData);
      } catch (cause) {
        console.error("审批操作失败：", cause);
        setError("操作失败，请稍后再试");
      }
    });
  };

  return (
    <form
      id={`publish-form-${toolId}`}
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
        ✓ 通过并公开
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
