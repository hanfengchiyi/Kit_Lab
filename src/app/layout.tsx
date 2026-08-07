import type { Metadata } from "next";
import { Baloo_2, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

// 活泼字体：Baloo 2（英数）+ ZCOOL KuaiLe（中文），经 CSS 变量注入 globals.css 的字体栈
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
});

const kuaile = ZCOOL_KuaiLe({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-kuaile",
});

export const metadata: Metadata = {
  title: {
    default: "Kit Lab — 个人工具库",
    template: "%s — Kit Lab",
  },
  description: "把分散在各处的工具链接集中到一个站点统一管理",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="zh-CN" className={`${baloo.variable} ${kuaile.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        <AppShell user={session?.user ?? null}>{children}</AppShell>
      </body>
    </html>
  );
}
