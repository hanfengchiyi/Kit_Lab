"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listCategoryNames } from "@/lib/categories";
import { getSetting, setSetting } from "@/lib/settings";
import { promoteDraftForTool } from "@/lib/html-update";
import { invalidateHtmlToolContentAccess } from "@/lib/html-tool-access";

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
  try {
    await prisma.announcement.delete({ where: { id } });
  } catch (error) {
    // 删除失败要留痕，而不是静默吞掉
    console.error(`公告删除失败（${id}）：`, error);
    throw error;
  }
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
}

/* ================= 推送公开审批 ================= */

/** 审批用户的推送申请（表单：decision=approve|reject，note 可选） */
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
    invalidateHtmlToolContentAccess();
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

/** 审批属主的「更新公开版本」申请（表单：decision=approve|reject，note 可选） */
export async function reviewHtmlUpdate(toolId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "public" || tool.kind !== "html" || !tool.ownerId) return;
  if (tool.htmlUpdateStatus !== "pending" || !tool.htmlDraftEntry || tool.htmlDraftBytes <= 0) return;
  if (approve) {
    await promoteDraftForTool(tool);
    invalidateHtmlToolContentAccess();
  } else {
    await prisma.tool.update({
      where: { id: toolId },
      data: { htmlUpdateStatus: "rejected", htmlUpdateNote: note || null },
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
  invalidateHtmlToolContentAccess();
  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/admin/publish");
}

/** 管理员下架公共工具：从首页消失，转为私有（保留原属主；无属主的成为"已下架"条目，仅管理员可见可恢复） */
export async function adminUnpublish(toolId: string): Promise<void> {
  await requireAdmin();
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "public") return;
  // 公开 HTML 工具存在草稿时先晋升：属主最新版成为私有内容，避免丢失草稿工作
  if (tool.kind === "html" && tool.ownerId && tool.htmlDraftEntry && tool.htmlDraftBytes > 0) {
    await promoteDraftForTool(tool);
  }
  await prisma.tool.update({
    where: { id: toolId },
    data: { visibility: "private", publishStatus: "none" },
  });
  invalidateHtmlToolContentAccess();
  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
}

/** 管理员把已下架（私有且无属主）的条目重新上架为公开 */
export async function adminRepublish(toolId: string): Promise<void> {
  await requireAdmin();
  const tool = await prisma.tool.findUnique({ where: { id: toolId } });
  if (!tool || tool.visibility !== "private" || tool.ownerId !== null) return;
  await prisma.tool.update({
    where: { id: toolId },
    data: { visibility: "public" },
  });
  invalidateHtmlToolContentAccess();
  revalidatePath("/");
  revalidatePath("/admin");
}

/* ================= 分类授权 ================= */

/** 设置某用户的分类授权；granted 为空数组表示"不限分类"（删除全部授权记录） */
export async function setCategoryGrants(userId: string, granted: string[]): Promise<void> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const known = new Set(await listCategoryNames());
  const valid = granted.filter((c) => known.has(c));
  await prisma.$transaction([
    prisma.categoryGrant.deleteMany({ where: { userId } }),
    ...valid.map((category) =>
      prisma.categoryGrant.create({ data: { userId, category } }),
    ),
  ]);
  revalidateTag("category-grants");
  revalidatePath("/admin/grants");
  revalidatePath("/");
}

/* ================= 分组（分类）管理 ================= */

const categorySchema = z.object({
  name: z.string().trim().min(1, "请填写分组名称").max(20, "分组名称最长 20 字"),
  order: z.coerce.number().int().default(0),
});

/** 新建分组；默认勾选"全员默认可用" */
export async function createCategory(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "表单数据不合法" };
  }
  const existing = await prisma.categoryMeta.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { error: "已存在同名分组" };
  }
  await prisma.categoryMeta.create({
    data: {
      name: parsed.data.name,
      order: parsed.data.order,
      defaultGrant: formData.get("defaultGrant") === "on",
    },
  });
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag("categories");
  return {};
}

/** 切换分组的"默认全员授权"开关 */
export async function toggleCategoryDefault(name: string): Promise<void> {
  await requireAdmin();
  const meta = await prisma.categoryMeta.findUnique({ where: { name } });
  if (!meta) return;
  await prisma.categoryMeta.update({
    where: { name },
    data: { defaultGrant: !meta.defaultGrant },
  });
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag("categories");
}

/** 删除分组：仅当没有任何工具使用该分组时允许；同时清理相关授权记录 */
export async function deleteCategory(name: string): Promise<{ error?: string }> {
  await requireAdmin();
  const used = await prisma.tool.count({ where: { category: name } });
  if (used > 0) {
    return { error: `该分组下还有 ${used} 个工具，请先移走或删除这些工具` };
  }
  await prisma.$transaction([
    prisma.categoryGrant.deleteMany({ where: { category: name } }),
    prisma.categoryMeta.delete({ where: { name } }),
  ]);
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag("categories");
  // 授权记录被一并清理，个人授权缓存同步失效
  revalidateTag("category-grants");
  return {};
}

/* ================= 系统设置 ================= */

/** 读取图标生成 API 的当前配置（Key 打码返回，留空表示未修改） */
export async function getIconSettings() {
  await requireAdmin();
  const baseUrl = (await getSetting("ICON_GEN_API_BASE_URL")) || "";
  const model = (await getSetting("ICON_GEN_MODEL")) || "grok-imagine-image";
  const hasKey = !!(await getSetting("ICON_GEN_API_KEY"));
  return { baseUrl, model, hasKey };
}

/** 保存图标生成 API 配置；apiKey 留空表示保持原值不变 */
export async function saveIconSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim().slice(0, 500);
  const model = String(formData.get("model") ?? "").trim().slice(0, 100);
  const apiKey = String(formData.get("apiKey") ?? "").trim().slice(0, 500);
  await setSetting("ICON_GEN_API_BASE_URL", baseUrl);
  await setSetting("ICON_GEN_MODEL", model || "grok-imagine-image");
  if (apiKey) {
    await setSetting("ICON_GEN_API_KEY", apiKey);
  }
  revalidatePath("/admin/settings");
}

/* ================= 公告发布状态 ================= */

/** 撤回 / 重新发布公告或守则 */
export async function toggleAnnouncementPublished(id: string): Promise<void> {
  await requireAdmin();
  const item = await prisma.announcement.findUnique({ where: { id } });
  if (!item) return;
  await prisma.announcement.update({
    where: { id },
    data: { published: !item.published },
  });
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
}