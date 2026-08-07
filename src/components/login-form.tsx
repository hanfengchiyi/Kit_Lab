"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authenticate } from "@/lib/actions/auth";
import { Logo } from "@/components/decorations";

const inputClass =
  "w-full rounded-xl border-2 border-sakura-100 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-ink/25 focus:border-sakura-400 focus:outline-none focus:ring-4 focus:ring-sakura-100";
const labelClass = "mb-1.5 block text-sm font-bold text-ink/70";

export function LoginForm({ registered }: { registered: boolean }) {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <div className="mx-auto max-w-sm animate-fade-up py-6">
      <div className="rounded-3xl border-2 border-sakura-100 bg-white p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo className="size-14 animate-float" />
          <h1 className="font-display text-2xl text-ink">登录 Kit Lab</h1>
          <p className="text-xs text-ink/40">欢迎回来，小屋一直为你亮着灯</p>
        </div>

        {registered && (
          <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-600">
            注册成功，请登录
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-500">
            {error}
          </p>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              邮箱
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
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              placeholder="请输入密码"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95 disabled:opacity-50"
          >
            {pending ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink/45">
          还没有账号？{" "}
          <Link
            href="/register"
            className="font-bold text-sakura-500 transition-colors hover:text-sakura-600"
          >
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
