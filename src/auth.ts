import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, clearFailures, failureCount, recordFailure } from "@/lib/rate-limit";
import { emailField, passwordField, type UserRole } from "@/lib/tool-schema";

const credentialsSchema = z.object({
  email: emailField,
  password: passwordField,
});

/** 同一 IP 15 分钟内最多 10 次登录失败，之后直接拒绝（内存计数，单进程） */
const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, request) {
        const ip = clientIpFromHeaders(request?.headers ?? new Headers());
        const failKey = `login:${ip}`;
        if (failureCount(failKey, LOGIN_FAIL_WINDOW_MS) >= LOGIN_FAIL_LIMIT) {
          return null;
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          recordFailure(failKey, LOGIN_FAIL_WINDOW_MS);
          return null;
        }
        // bcrypt 只处理前 72 字节；与注册时的约束保持一致，超长一律视为无效凭证
        if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
          recordFailure(failKey, LOGIN_FAIL_WINDOW_MS);
          return null;
        }
        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          recordFailure(failKey, LOGIN_FAIL_WINDOW_MS);
          return null;
        }
        const passwordValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!passwordValid) {
          recordFailure(failKey, LOGIN_FAIL_WINDOW_MS);
          return null;
        }
        clearFailures(failKey);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // 数据库 role 列是字符串；收窄为已知角色（非法值按 user 处理）
          role: (user.role === "admin" ? "admin" : "user") as UserRole,
        };
      },
    }),
  ],
});