"use client";

import { useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/constants";
import { setCategoryGrants } from "@/lib/actions/admin";

interface GrantEditorProps {
  userId: string;
  initialGrants: string[]; // 空数组 = 不限分类
}

/** 单个用户的分类授权编辑器：全不勾 = 不限分类；勾选后仅可用所选分类 */
export function GrantEditor({ userId, initialGrants }: GrantEditorProps) {
  const [selected, setSelected] = useState<string[]>(initialGrants);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (category: string) => {
    setSaved(false);
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      await setCategoryGrants(userId, selected);
      setSaved(true);
    });
  };

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((category) => {
          const active = selected.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggle(category)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                active
                  ? "bg-sakura-400 text-white shadow-soft"
                  : "border-2 border-sakura-100 bg-white text-ink/50 hover:border-sakura-300"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-gradient-to-r from-sakura-400 to-sakura-500 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存授权"}
        </button>
        {saved && <span className="text-xs font-bold text-emerald-500">✓ 已保存</span>}
        <span className="text-xs text-ink/35">
          {selected.length === 0 ? "当前：不限分类" : `当前：仅可用 ${selected.length} 个分类`}
        </span>
      </div>
    </div>
  );
}
