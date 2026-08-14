import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/tool-schema";

/**
 * 可被中间件（Edge Runtime）安全使用的 Auth.js 配置：
 * 不引入 Prisma / bcrypt 等 Node 专属依赖。
 * 完整的 Credentials Provider 在 src/auth.ts 中合并进来。
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  // 自托管部署（含 Nginx 反代）下信任请求 Host 头
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // 仅在中间件中触发；配合 matcher 只保护 /favorites、/my、/admin
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (user?.role) {
        token.role = (user.role === "admin" ? "admin" : "user") as UserRole;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (typeof token.role === "string") {
        // token.role 来自 jwt 回调；收窄为已知角色
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  providers: [], // 在 auth.ts 中补充
} satisfies NextAuthConfig;