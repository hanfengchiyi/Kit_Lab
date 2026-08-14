"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "公共工具" },
  { href: "/admin/categories", label: "分组管理" },
  { href: "/admin/publish", label: "推送审批" },
  { href: "/admin/announcements", label: "公告与守则" },
  { href: "/admin/invitations", label: "邀请码" },
  { href: "/admin/grants", label: "分类授权" },
  { href: "/admin/settings", label: "系统设置" },
];

/** 管理后台各子页共用的锚点导航；当前页高亮 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {ADMIN_LINKS.map((link) => {
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? "border-sakura-400 bg-sakura-400 text-white shadow-soft"
                : "border-sakura-100 bg-white text-ink/60 hover:border-sakura-300 hover:text-sakura-500"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
