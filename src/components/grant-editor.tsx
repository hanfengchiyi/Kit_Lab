"use client";

import { useState, useTransition } from "react";
import { setCategoryGrants } from "@/lib/actions/admin";

interface GrantEditorProps {
  userId: string;
  initialGrants: string[]; // 个人单独授权的分组
  categories: string[]; // 全部分组
  defaultCategories: string[]; // 默认全员授权的分组（无需单独授权）
}

/** 单个用户的分类授权编辑器：全不勾 = 不限分类；勾选后仅可用所选分类 */
export function GrantEditor({ userId, initialGrants, categories, defaultCategories }: GrantEditorProps) {
  const [selected, setSelected] = useState<string[]>(initialGrants);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (category: string) => {
    setSaved(false);
    setError(null);
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setCategoryGrants(userId, selected);
        setSaved(true);
      } catch (cause) {
        console.error("保存分类授权失败：", cause);
        setError("保存失败，请稍后再试");
      }
    });
  };

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => {
          const isDefault = defaultCategories.includes(category);
          const active = isDefault || selected.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => !isDefault && toggle(category)}
              disabled={isDefault}
              title={isDefault ? "该分组默认全员可用，无需单独授权" : undefined}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                isDefault
                  ? "cursor-not-allowed bg-emerald-100 text-emerald-600"
                  : active
                    ? "bg-sakura-400 text-white shadow-soft"
                    : "border-2 border-sakura-100 bg-white text-ink/50 hover:border-sakura-300"
              }`}
            >
              {category}
              {isDefault ? " · 默认" : ""}
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
        {error && (
          <span role="alert" className="text-xs font-bold text-red-500">
            {error}
          </span>
        )}
        <span className="text-xs text-ink/35">
          可用 = 默认分组（绿色）+ 勾选分组
          {selected.length > 0 ? `（额外授权 ${selected.length} 个）` : ""}
        </span>
      </div>
    </div>
  );
}