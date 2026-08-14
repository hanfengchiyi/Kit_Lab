"use client";

import { useState, useTransition } from "react";
import { saveIconSettings } from "@/lib/actions/admin";

interface IconSettingsFormProps {
  initial: {
    baseUrl: string;
    model: string;
    hasKey: boolean;
  };
}

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-3 py-2 text-sm focus:border-sakura-400 focus:outline-none";

/** 系统设置：图标生成 API 的 Base URL / Key / 模型 */
export function IconSettingsForm({ initial }: IconSettingsFormProps) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await saveIconSettings(formData);
        setSaved(true);
      } catch (cause) {
        console.error("保存系统设置失败：", cause);
        setError("保存失败，请稍后再试");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="baseUrl" className="mb-1 block text-xs font-bold text-ink/50">
          Base URL（留空则关闭自动生成图标）
        </label>
        <input
          id="baseUrl"
          name="baseUrl"
          defaultValue={initial.baseUrl}
          placeholder="http://192.220.24.62:8000/v1"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="apiKey" className="mb-1 block text-xs font-bold text-ink/50">
          API Key {initial.hasKey && <span className="text-emerald-500">（已配置，留空保持不变）</span>}
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder={initial.hasKey ? "••••••••（已保存，输入新值以更换）" : "g2a_..."}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="model" className="mb-1 block text-xs font-bold text-ink/50">
          模型
        </label>
        <input
          id="model"
          name="model"
          defaultValue={initial.model}
          placeholder="grok-imagine-image"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存设置"}
        </button>
        {saved && <span className="text-sm font-bold text-emerald-500">✓ 已保存，立即生效</span>}
        {error && (
          <span role="alert" className="text-sm font-bold text-red-500">
            {error}
          </span>
        )}
      </div>
      <p className="text-xs text-ink/35">
        说明：这里配置的是「创建工具时自动生成图标」所用的图像 API，保存在数据库中，优先级高于 .env 环境变量。
      </p>
    </form>
  );
}