"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveTool } from "@/lib/actions/tools";
import { SOURCES } from "@/lib/constants";

export interface ToolFormInitial {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string;
  source: string;
  icon: string | null;
  order: number;
  kind?: string;
  htmlBytes?: number;
}

interface ToolFormProps {
  visibility: "public" | "private";
  initial?: ToolFormInitial;
  cancelHref: string;
  categories: string[];
}

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-ink/25 focus:border-sakura-400 focus:outline-none focus:ring-4 focus:ring-sakura-100";
const labelClass = "mb-1.5 block text-sm font-bold text-ink/70";
const primaryButtonClass =
  "rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50";

/** 新增 / 编辑工具条目表单，/my（私有）与 /admin（公共）共用 */
export function ToolForm({ visibility, initial, cancelHref, categories }: ToolFormProps) {
  const [state, formAction, pending] = useActionState(saveTool, undefined);

  return (
    <form
      action={formAction}
      className="max-w-xl animate-fade-up space-y-5 rounded-3xl border-2 border-sakura-100 bg-white p-6 shadow-soft sm:p-8"
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="visibility" value={visibility} />

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-500">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="name" className={labelClass}>
          名称 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={50}
          defaultValue={initial?.name}
          className={inputClass}
          placeholder="例如：JSON 格式化工具"
        />
      </div>

      {initial?.kind === "html" ? (
        <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/60 px-4 py-3">
          <input type="hidden" name="url" value={initial.url} />
          <p className="text-sm font-bold text-amber-700">本地 HTML 工具</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700/70">
            此处只修改展示信息；HTML 与资源文件由系统保管，删除工具时会一并清理。
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="url" className={labelClass}>
            链接 <span className="text-red-500">*</span>
          </label>
          <input
            id="url"
            name="url"
            type="url"
            required
            defaultValue={initial?.url}
            className={inputClass}
            placeholder="https://"
          />
        </div>
      )}

      <div>
        <label htmlFor="description" className={labelClass}>
          描述 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={200}
          rows={2}
          defaultValue={initial?.description}
          className={inputClass}
          placeholder="一句话说明这个工具是做什么的"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>
            分类 <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={initial?.category}
            className={inputClass}
          >
            <option value="" disabled>
              请选择分类
            </option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source" className={labelClass}>
            来源 <span className="text-red-500">*</span>
          </label>
          <select
            id="source"
            name="source"
            required
            defaultValue={initial?.source ?? "third-party"}
            className={inputClass}
          >
            {SOURCES.map((source) => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>
          标签
        </label>
        <input
          id="tags"
          name="tags"
          maxLength={100}
          defaultValue={initial?.tags}
          className={inputClass}
          placeholder="逗号分隔，如：json,格式化"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="icon" className={labelClass}>
            图标（emoji，可选）
          </label>
          <input
            id="icon"
            name="icon"
            maxLength={8}
            defaultValue={initial?.icon ?? ""}
            className={inputClass}
            placeholder="🔧"
          />
        </div>
        <div>
          <label htmlFor="order" className={labelClass}>
            排序（越小越靠前）
          </label>
          <input
            id="order"
            name="order"
            type="number"
            defaultValue={initial?.order ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "保存中…" : "保存"}
        </button>
        <Link
          href={cancelHref}
          className="text-sm font-bold text-ink/40 transition-colors hover:text-sakura-500"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
