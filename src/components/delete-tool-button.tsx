"use client";

import { useTransition } from "react";
import { deleteTool } from "@/lib/actions/tools";

export function DeleteToolButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`确定删除「${name}」吗？该操作不可恢复。`)) {
          startTransition(() => deleteTool(id));
        }
      }}
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? "删除中…" : "删除"}
    </button>
  );
}
