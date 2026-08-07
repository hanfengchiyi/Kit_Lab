import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EMAIL_REGEX } from "@/lib/constants";

const registerSchema = z
  .object({
    name: z.string().trim().max(30, "昵称最长 30 字").optional().default(""),
    email: z.string().trim().regex(EMAIL_REGEX, "邮箱格式不正确"),
    password: z.string().min(8, "密码至少 8 位"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
  });

export async function POST(request: Request) {
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

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: parsed.data.name || null,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
