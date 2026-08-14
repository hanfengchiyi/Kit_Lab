"use client";

import { useRef, useState, useTransition } from "react";
import { deleteCategory } from "@/lib/actions/admin";

/** 删除分组按钮：两步确认 + 展示服务端错误（如分组下仍有工具） */
export function CategoryDeleteButton({ name }: { name: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setConfirming(false);
    setError(null);
  };

  const handleConfirm = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startTransition(async () => {
      try {
        const result = await deleteCategory(name);
        if (result?.error) {
          setError(result.error);
        }
      } catch (cause) {
        console.error("删除分组失败：", cause);
        setError("删除失败，请稍后再试");
      } finally {
        setConfirming(false);
      }
    });
  };

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={handleConfirm}
          className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white transition-all hover:bg-red-600 active:scale-95 disabled:opacity-50"
        >
          {pending ? "删除中…" : "确认删除"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={reset}
          className="rounded-lg border-2 border-sakura-100 px-2.5 py-1 text-xs font-bold text-ink/50 hover:bg-sakura-50"
        >
          取消
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(reset, 5000);
        }}
        className="rounded-lg border-2 border-red-100 px-2.5 py-1 text-xs font-bold text-red-400 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        删除
      </button>
      {error && (
        <span role="alert" className="text-xs font-bold text-red-500">
          {error}
        </span>
      )}
    </span>
  );
}
