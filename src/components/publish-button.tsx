"use client";

import { useState, useTransition } from "react";
import { cancelPublishRequest, requestPublish } from "@/lib/actions/tools";

interface PublishButtonProps {
  toolId: string;
  status: string; // "none" | "pending" | "rejected"
  note?: string | null;
}

/** 「我的工具」里的推送公开按钮：申请 / 撤回，并显示审批状态 */
export function PublishButton({ toolId, status, note }: PublishButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string } | void>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  };

  if (status === "pending") {
    return (
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-500">
          审批中
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => cancelPublishRequest(toolId))}
          className="text-sm font-bold text-ink/40 transition-colors hover:text-red-400 disabled:opacity-50"
        >
          撤回
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {status === "rejected" && (
        <span
          className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-400"
          title={note || undefined}
        >
          已被拒绝{note ? `：${note}` : ""}
        </span>
      )}
      {error && <span className="text-xs font-bold text-red-400">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => requestPublish(toolId))}
        className="text-sm font-bold text-sakura-400 transition-colors hover:text-sakura-500 disabled:opacity-50"
      >
        {pending ? "提交中…" : "↑ 申请公开"}
      </button>
    </span>
  );
}
