"use client";

import { useState, useTransition } from "react";
import { saveAnnouncement } from "@/lib/actions/admin";

interface AnnouncementFormProps {
  initial?: {
    id: string;
    title: string;
    content: string;
    kind: "announcement" | "rule";
    order: number;
    published: boolean;
  };
}

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-3 py-2 text-sm focus:border-sakura-400 focus:outline-none";

export function AnnouncementForm({ initial }: AnnouncementFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveAnnouncement(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-500">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs font-bold text-ink/50">标题 *</label>
          <input
            name="title"
            required
            maxLength={80}
            defaultValue={initial?.title}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-ink/50">类型 *</label>
          <select name="kind" defaultValue={initial?.kind ?? "announcement"} className={inputClass}>
            <option value="announcement">公告</option>
            <option value="rule">用户守则</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-ink/50">排序</label>
          <input
            name="order"
            type="number"
            defaultValue={initial?.order ?? 0}
            className={`${inputClass} w-24`}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-ink/50">内容 *</label>
        <textarea
          name="content"
          required
          maxLength={5000}
          rows={5}
          defaultValue={initial?.content}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-ink/60">
        <input
          type="checkbox"
          name="published"
          defaultChecked={initial?.published ?? true}
          className="size-4 accent-sakura-400"
        />
        发布（勾选后公开可见）
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
      >
        {pending ? "保存中…" : initial ? "保存修改" : "发布"}
      </button>
    </form>
  );
}
