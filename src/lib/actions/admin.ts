"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

/** 校验当前会话是管理员，否则抛错（服务端二次校验，页面层另有重定向） */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("需要管理员权限");
  }
  return session.user;
}

/* ================= 邀请码 ================= */

export async function createInvitation(formData: FormData): Promise<void> {
  await requireAdmin();
  const note = String(formData.get("note") ?? "").trim().slice(0, 100) || null;
  // 8 字节随机数转 base62 风格的短码，便于口头传递
  const code = randomBytes(6).toString("base64url").replace(/[-_]/g, "").slice(0, 10)
    + randomBytes(2).toString("hex");
  await prisma.invitation.create({ data: { code, note } });
  revalidatePath("/admin/invitations");
}

export async function deleteInvitation(id: string): Promise<void> {
  await requireAdmin();
  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation || invitation.usedById) return; // 已使用的保留记录，不删除
  await prisma.invitation.delete({ where: { id } });
  revalidatePath("/admin/invitations");
}

/* ================= 公告与用户守则 ================= */

const announcementSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "请填写标题").max(80, "标题最长 80 字"),
  content: z.string().trim().min(1, "请填写内容").max(5000, "内容最长 5000 字"),
  kind: z.enum(["announcement", "rule"]),
  order: z.coerce.number().int().default(0),
  published: z.coerce.boolean().default(false),
});

export async function saveAnnouncement(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = announcementSchema.safeParse({
    ...Object.fromEntries(formData),
    published: formData.get("published") === "on" || formData.get("published") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "表单数据不合法" };
  }
  const { id, ...values } = parsed.data;
  if (id) {
    await prisma.announcement.update({ where: { id }, data: values });
  } else {
    await prisma.announcement.create({ data: values });
  }
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  return {};
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await requireAdmin();
  await prisma.announcement.delete({ where: { id } }).catch(() => {});
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
}

/* ================= 推送公开审批 ================= */

/** 审批用户提交的推送申请（表单：decision=approve|reject，note 可选） */
export async function reviewPublish(toolId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.publishStatus !== "pending") return;
  if (approve) {
    await prisma.tool.update({
      where: { id: toolId },
      data: { visibility: "public", publishStatus: "approved", publishNote: note || null },
    });
  } else {
    await prisma.tool.update({
      where: { id: toolId },
      data: { publishStatus: "rejected", publishNote: note || null },
    });
  }
  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/admin/publish");
}

/** 管理员直接把某个用户的个人工具推送为公开 */
export async function adminPushToPublic(toolId: string): Promise<void> {
  await requireAdmin();
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "private") return;
  await prisma.tool.update({
    where: { id: toolId },
    data: { visibility: "public", publishStatus: "approved" },
  });
  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/admin/publish");
}

/** 管理员把公共工具下架回个人（回到原属主私有） */
export async function adminUnpublish(toolId: string): Promise<void> {
  await requireAdmin();
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "public" || !tool.ownerId) return;
  await prisma.tool.update({
    where: { id: toolId },
    data: { visibility: "private", publishStatus: "none" },
  });
  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
}

/* ================= 分类授权 ================= */

/** 设置某用户的分类授权；granted 为空数组表示"不限分类"（删除全部授权记录） */
export async function setCategoryGrants(userId: string, granted: string[]): Promise<void> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const valid = granted.filter((c) => (CATEGORIES as readonly string[]).includes(c));
  await prisma.$transaction([
    prisma.categoryGrant.deleteMany({ where: { userId } }),
    ...valid.map((category) =>
      prisma.categoryGrant.create({ data: { userId, category } }),
    ),
  ]);
  revalidatePath("/admin/grants");
  revalidatePath("/");
}
