import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin", label: "公共工具" },
  { href: "/admin/categories", label: "分组管理" },
  { href: "/admin/publish", label: "推送审批" },
  { href: "/admin/announcements", label: "公告与守则" },
  { href: "/admin/invitations", label: "邀请码" },
  { href: "/admin/grants", label: "分类授权" },
];

/** 管理后台各子页共用的锚点导航（服务端组件，静态渲染） */
export function AdminNav() {
  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {ADMIN_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full border-2 border-sakura-100 bg-white px-3.5 py-1.5 text-xs font-bold text-ink/60 transition-all hover:border-sakura-300 hover:text-sakura-500"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
