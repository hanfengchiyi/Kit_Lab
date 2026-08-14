import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { emailField, PASSWORD_MAX_BYTES, passwordField } from "@/lib/tool-schema";

/** 每 IP 每小时最多 20 次注册尝试 */
const REGISTER_RATE_LIMIT = 20;
const REGISTER_RATE_WINDOW_MS = 60 * 60 * 1000;

const registerSchema = z
  .object({
    name: z.string().trim().max(30, "昵称最长 30 字").optional().default(""),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    inviteCode: z.string().trim().min(1, "请填写邀请码").max(64, "邀请码过长"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
  });

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`register:${ip}`, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "注册尝试过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec ?? 3600) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "表单数据不合法" },
      { status: 400 },
    );
  }

  // bcrypt 只使用前 72 字节；超长密码在注册时直接拒绝，避免截断导致的语义歧义
  if (Buffer.byteLength(parsed.data.password, "utf8") > PASSWORD_MAX_BYTES) {
    return NextResponse.json(
      { error: `密码过长（最多 ${PASSWORD_MAX_BYTES} 字节）` },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

  // 事务内原子消费邀请码：并发注册时只有一个能成功，防止一码多号
  try {
    await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: { code: parsed.data.inviteCode },
      });
      if (!invitation || invitation.usedById) {
        throw new RegisterBlockedError("邀请码无效或已被使用", 403);
      }
      const user = await transaction.user.create({
        data: {
          email,
          password: hashedPassword,
          name: parsed.data.name || null,
        },
      });
      const consumed = await transaction.invitation.updateMany({
        where: { id: invitation.id, usedById: null },
        data: { usedById: user.id, usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        // 理论上不会到达（事务串行化）；防御性兜底
        throw new RegisterBlockedError("邀请码已被使用，请换一个", 409);
      }
    });
  } catch (error) {
    if (error instanceof RegisterBlockedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // 并发同邮箱注册：唯一约束冲突
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

class RegisterBlockedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
