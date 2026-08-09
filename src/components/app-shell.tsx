"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { CATEGORIES } from "@/lib/constants";
import {
  CloseIcon,
  HomeIcon,
  LoginIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
  StarIcon,
  UserPlusIcon,
  WrenchIcon,
} from "@/components/icons";
import { CloudPuff, Logo, SakuraFlower, SparkleStar } from "@/components/decorations";

interface ShellUser {
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface AppShellProps {
  user: ShellUser | null;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 取容器内全部可聚焦元素（按 DOM 顺序） */
function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** 全站外壳：桌面端左侧固定侧边栏，移动端顶栏 + 抽屉式侧边栏 */
export function AppShell({ user, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  // 路由变化后自动收起抽屉
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // 焦点管理：打开时移入抽屉内第一个可聚焦元素，关闭时还原到汉堡按钮
  useEffect(() => {
    if (drawerOpen) {
      wasOpenRef.current = true;
      getFocusable(drawerRef.current)[0]?.focus();
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [drawerOpen]);

  // 抽屉打开时：Esc 关闭 + Tab 焦点圈定在抽屉内 + 锁定背景滚动
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(drawerRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = drawerRef.current?.contains(active) ?? false;
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen">
      {/* 背景漂浮装饰（纯装饰，不拦截交互） */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
        data-decor="background"
      >
        <SakuraFlower className="absolute left-[4%] top-[12%] size-10 animate-float text-sakura-200" />
        <SakuraFlower className="absolute right-[6%] top-[8%] size-7 animate-float-slow text-sakura-100" />
        <SparkleStar className="absolute left-[10%] bottom-[18%] size-6 animate-twinkle text-lav-200" />
        <SparkleStar className="absolute right-[12%] top-[45%] size-5 animate-twinkle text-skyblue-200 [animation-delay:1.2s]" />
        <CloudPuff className="absolute right-[4%] bottom-[10%] h-10 w-16 animate-float-slow text-skyblue-100" />
        <SakuraFlower className="absolute left-[45%] top-[85%] size-6 animate-float text-sakura-100 [animation-delay:2s]" />
      </div>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-sakura-100 bg-cream/90 px-4 py-2.5 backdrop-blur md:hidden">
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setDrawerOpen(true)}
          aria-label="打开菜单"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="rounded-xl p-1.5 text-ink transition-colors hover:bg-sakura-100 active:scale-90"
        >
          <MenuIcon className="size-6" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Logo className="size-8" />
          <span className="font-display text-lg text-ink">Kit Lab</span>
        </Link>
      </header>

      {/* 桌面端固定侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 md:block">
        <SidebarBody user={user} pathname={pathname} />
      </aside>

      {/* 移动端抽屉（遮罩 + 滑入面板）；关闭时 inert 防止键盘焦点落入 */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        inert={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          ref={drawerRef}
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="站点导航菜单"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-pop transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭菜单"
            className="absolute right-3 top-3 z-10 rounded-xl p-1.5 text-ink/50 transition-colors hover:bg-sakura-100 hover:text-ink"
          >
            <CloseIcon className="size-5" />
          </button>
          <SidebarBody user={user} pathname={pathname} />
        </aside>
      </div>

      {/* 主内容区 */}
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}

/** 侧边栏主体，桌面栏与移动抽屉共用 */
function SidebarBody({ user, pathname }: { user: ShellUser | null; pathname: string }) {
  const navItems = [
    { href: "/", label: "首页", icon: HomeIcon },
    { href: "/announcements", label: "公告守则", icon: StarIcon },
    ...(user
      ? [
          { href: "/favorites", label: "我的收藏", icon: StarIcon },
          { href: "/my", label: "我的工具", icon: WrenchIcon },
          ...(user.role === "admin"
            ? [{ href: "/admin", label: "管理后台", icon: ShieldIcon }]
            : []),
        ]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col overflow-y-auto border-r-2 border-sakura-100 bg-white/85 backdrop-blur">
      {/* Logo */}
      <Link href="/" className="group flex items-center gap-2.5 px-5 pb-4 pt-5">
        <Logo className="size-11 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
        <span>
          <span className="block font-display text-xl leading-tight text-ink">Kit Lab</span>
          <span className="block text-xs text-sakura-400">个人工具库 ✦ 奇思妙想收集站</span>
        </span>
      </Link>

      {/* 主导航 */}
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
              isActive(item.href)
                ? "bg-sakura-100 text-sakura-600"
                : "text-ink/60 hover:bg-sakura-50 hover:text-ink"
            }`}
          >
            {isActive(item.href) && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sakura-400" />
            )}
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* 分类速览 */}
      <div className="mt-5 px-5">
        <p className="mb-2 text-xs font-bold tracking-widest text-ink/35">分类速览</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/#${encodeURIComponent(category)}`}
              className="rounded-full bg-lav-50 px-2.5 py-1 text-xs text-lav-500 transition-all hover:-translate-y-0.5 hover:bg-lav-100 hover:shadow-soft"
            >
              {category}
            </Link>
          ))}
        </div>
      </div>

      {/* 底部：用户卡片或登录/注册 */}
      <div className="mt-auto px-4 pb-5 pt-6">
        {user ? (
          <div className="rounded-2xl border-2 border-sakura-100 bg-sakura-50/60 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sakura-300 to-lav-300 font-display text-lg text-white">
                {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {user.name || "未命名小伙伴"}
                </p>
                <p className="truncate text-xs text-ink/45">{user.email}</p>
              </div>
            </div>
            <form action={logout} className="mt-3">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-sakura-200 bg-white px-3 py-1.5 text-sm font-bold text-sakura-500 transition-all hover:bg-sakura-100 active:scale-95"
              >
                <LogoutIcon className="size-4" />
                退出登录
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-sakura-200 bg-white px-3 py-2 text-sm font-bold text-sakura-500 transition-all hover:bg-sakura-50 active:scale-95"
            >
              <LoginIcon className="size-4" />
              登录
            </Link>
            <Link
              href="/register"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sakura-400 to-sakura-500 px-3 py-2 text-sm font-bold text-white shadow-soft transition-all hover:shadow-pop active:scale-95"
            >
              <UserPlusIcon className="size-4" />
              注册加入
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
