"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listCategoryNames } from "@/lib/categories";
import {
  purgeStagedHtmlTool,
  restoreStagedHtmlTool,
  stageHtmlToolDeletion,
} from "@/lib/html-tools";
import { generateToolIcon } from "@/lib/icon-gen";

export interface ToolFormState {
  error?: string;
}

const toolSchema = z.object({
  id: z.string().optional(),
  visibility: z.enum(["public", "private"]),
  name: z.string().trim().min(1, "请填写名称").max(50, "名称最长 50 字"),
  url: z.string().trim().min(1, "请填写链接").max(2048, "链接过长"),
  description: z.string().trim().min(1, "请填写描述").max(200, "描述最长 200 字"),
  category: z.string().trim().min(1, "请选择分类").max(20, "分类名过长"),
  tags: z.string().trim().max(100, "标签总长最长 100 字").optional().default(""),
  source: z.enum(["self", "third-party"], { message: "请选择来源" }),
  icon: z.string().trim().max(8, "图标最多 8 个字符").optional().default(""),
  order: z.coerce.number().int("排序需为整数").default(0),
});

function normalizeTags(tags: string): string {
  return tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** 判断当前用户是否有权修改指定条目：公共条目仅管理员，私有条目仅属主 */
function canManage(
  tool: { visibility: string; ownerId: string | null },
  user: { id: string; role: string },
): boolean {
  if (tool.visibility === "public") {
    return user.role === "admin";
  }
  return tool.ownerId === user.id;
}

/** 新增 / 编辑工具条目（/my 私有条目与 /admin 公共条目共用，权限在服务端强制校验） */
export async function saveTool(
  prevState: ToolFormState | undefined,
  formData: FormData,
): Promise<ToolFormState | undefined> {
  const session = await auth();
  if (!session?.user) {
    return { error: "请先登录" };
  }

  const parsed = toolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "表单数据不合法" };
  }
  const data = parsed.data;

  const knownCategories = new Set(await listCategoryNames());
  if (!knownCategories.has(data.category)) {
    return { error: "请选择有效的分类" };
  }

  if (data.visibility === "public" && session.user.role !== "admin") {
    return { error: "只有管理员可以维护公共条目" };
  }

  const existing = data.id
    ? await prisma.tool.findUnique({ where: { id: data.id } })
    : null;
  if (data.id && !existing) {
    return { error: "条目不存在" };
  }
  if (existing && !canManage(existing, session.user)) {
    return { error: "没有权限修改该条目" };
  }
  const editingHtmlTool = existing?.kind === "html";
  if (!editingHtmlTool && !isHttpUrl(data.url)) {
    return { error: "链接格式不正确，需以 http:// 或 https:// 开头" };
  }

  const values = {
    name: data.name,
    url: editingHtmlTool ? existing.url : data.url,
    description: data.description,
    category: data.category,
    tags: normalizeTags(data.tags),
    source: editingHtmlTool ? "self" : data.source,
    icon: data.icon || null,
    order: data.order,
    visibility: editingHtmlTool ? existing.visibility : data.visibility,
    ownerId: editingHtmlTool
      ? existing.ownerId
      : data.visibility === "private"
        ? session.user.id
        : null,
  };

  if (data.id) {
    await prisma.tool.update({ where: { id: data.id }, data: values });
  } else {
    // 新建条目且未手动指定图标时，尝试通过配置的图像 API 自动生成图标（失败不阻塞）
    if (!values.icon) {
      values.icon = await generateToolIcon(data.name, data.description);
    }
    await prisma.tool.create({ data: values });
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/favorites");
  redirect(
    (editingHtmlTool ? existing.visibility : data.visibility) === "public" ? "/admin" : "/my",
  );
}

/** 删除工具条目：私有条目仅属主可删，公共条目仅管理员可删 */
export async function deleteTool(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user || !id) {
    return;
  }
  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing || !canManage(existing, session.user)) {
    return;
  }
  const isHtmlTool = existing.kind === "html" && !!existing.ownerId;
  let stagedDirectory: string | null = null;
  if (isHtmlTool) {
    try {
      stagedDirectory = await stageHtmlToolDeletion(existing.ownerId!, existing.id);
    } catch (error) {
      console.error(`HTML 工具目录暂存失败（${existing.id}）：`, error);
      return;
    }
  }

  try {
    // 数据模型未配置级联删除，先清理关联收藏；HTML 工具同时归还用户额度。
    await prisma.$transaction(async (transaction) => {
      await transaction.favorite.deleteMany({ where: { toolId: id } });
      await transaction.tool.delete({ where: { id } });
      if (isHtmlTool && existing.htmlBytes > 0) {
        const owner = await transaction.user.findUnique({
          where: { id: existing.ownerId! },
          select: { htmlStorageUsedBytes: true },
        });
        if (owner) {
          await transaction.user.update({
            where: { id: existing.ownerId! },
            data: {
              htmlStorageUsedBytes: Math.max(0, owner.htmlStorageUsedBytes - existing.htmlBytes),
            },
          });
        }
      }
    });
  } catch (error) {
    if (stagedDirectory && existing.ownerId) {
      await restoreStagedHtmlTool(stagedDirectory, existing.ownerId, existing.id).catch(
        (restoreError) => {
          console.error(`HTML 工具目录恢复失败（${existing.id}）：`, restoreError);
        },
      );
    }
    throw error;
  }

  if (stagedDirectory) {
    await purgeStagedHtmlTool(stagedDirectory).catch((error) => {
      console.error(`HTML 工具暂存目录清理失败（${existing.id}）：`, error);
    });
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/favorites");
}

/** 用户申请把自己的私有工具推送为公开（进入管理员审批队列） */
export async function requestPublish(id: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || !id) {
    return { error: "请先登录" };
  }
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool || tool.ownerId !== session.user.id || tool.visibility !== "private") {
    return { error: "条目不存在或无权操作" };
  }
  if (tool.publishStatus === "pending") {
    return { error: "已在审批队列中，请耐心等待" };
  }
  // 站长（管理员）自己的工具无需审批，直接推送为公开
  if (session.user.role === "admin") {
    await prisma.tool.update({
      where: { id },
      data: { visibility: "public", publishStatus: "approved", publishNote: null },
    });
    revalidatePath("/");
    revalidatePath("/admin");
  } else {
    await prisma.tool.update({
      where: { id },
      data: { publishStatus: "pending", publishNote: null },
    });
  }
  revalidatePath("/my");
  revalidatePath("/admin/publish");
  return {};
}

/** 用户撤回未处理的推送申请 */
export async function cancelPublishRequest(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user || !id) return;
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool || tool.ownerId !== session.user.id || tool.publishStatus !== "pending") return;
  await prisma.tool.update({ where: { id }, data: { publishStatus: "none" } });
  revalidatePath("/my");
  revalidatePath("/admin/publish");
}
