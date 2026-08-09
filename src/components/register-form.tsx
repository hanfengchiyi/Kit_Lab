"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SakuraFlower } from "@/components/decorations";

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-ink/25 focus:border-sakura-400 focus:outline-none focus:ring-4 focus:ring-sakura-100";
const labelClass = "mb-1.5 block text-sm font-bold text-ink/70";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password,
          confirmPassword,
          inviteCode: formData.get("inviteCode"),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "注册失败，请稍后再试");
        return;
      }
      router.push("/login?registered=1");
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm animate-fade-up py-6">
      <div className="rounded-3xl border-2 border-sakura-100 bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center gap-2">
          <SakuraFlower className="size-12 animate-float text-sakura-300" />
          <h1 className="font-display text-2xl text-ink">加入 Kit Lab</h1>
          <p className="text-xs text-ink/40">注册一个账号，开始收集你的宝藏工具</p>
        </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-500">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>
            昵称（可选）
          </label>
          <input id="name" name="name" maxLength={30} className={inputClass} placeholder="怎么称呼你" />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            邮箱 <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            密码 <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            placeholder="至少 8 位"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            确认密码 <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            placeholder="再输入一次密码"
          />
        </div>
        <div>
          <label htmlFor="inviteCode" className={labelClass}>
            邀请码 <span className="text-red-500">*</span>
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            required
            className={inputClass}
            placeholder="向管理员索取邀请码"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
        >
          {pending ? "注册中…" : "注册"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink/45">
        已有账号？{" "}
        <Link
          href="/login"
          className="font-bold text-sakura-500 transition-colors hover:text-sakura-600"
        >
          去登录
        </Link>
      </p>
      </div>
    </div>
  );
}
