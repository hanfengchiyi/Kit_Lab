import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// 仅使用 Edge 安全配置，未登录访问受保护路由时由 authorized 回调重定向到 /login
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/favorites/:path*", "/my/:path*", "/admin/:path*"],
};
