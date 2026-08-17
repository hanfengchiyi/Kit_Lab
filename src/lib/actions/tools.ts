"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listCategoryNames } from "@/lib/categories";
import { normalizeTags } from "@/lib/constants";
import {
  purgeStagedHtmlToolDeletion,
  restoreStagedHtmlToolDeletion,
  stageHtmlToolDeletionWithDraft,
  type StagedHtmlToolDeletion,
} from "@/lib/html-tools";
import { invalidateHtmlToolContentAccess } from "@/lib/html-tool-access";
import { generateToolIcon } from "@/lib/icon-gen";
import { toolSchema } from "@/lib/tool-schema";

export interface ToolFormState {
  error?: string;
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
  // 已下架条目（私有且无属主）仅管理员可管理
  if (tool.ownerId === null) {
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

  // 分类 / 可见性 / 属主可能变化，影响内容分发路由的缓存视图
  invalidateHtmlToolContentAccess();
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
  let staged: StagedHtmlToolDeletion = {};
  if (isHtmlTool) {
    try {
      // 公开工具可能同时存在正式目录与草稿目录，一并暂存
      staged = await stageHtmlToolDeletionWithDraft(existing.ownerId!, existing.id);
    } catch (error) {
      console.error(`HTML 工具目录暂存失败（${existing.id}）：`, error);
      return;
    }
  }

  try {
    // 数据模型未配置级联删除，先清理关联收藏；HTML 工具同时原子归还用户额度，
    // 避免与并发上传的 increment 竞争造成账目失真。
    await prisma.$transaction(async (transaction) => {
      await transaction.favorite.deleteMany({ where: { toolId: id } });
      await transaction.tool.delete({ where: { id } });
      if (isHtmlTool && existing.ownerId) {
        const ownerId = existing.ownerId;
        const totalBytes = (existing.htmlBytes || 0) + (existing.htmlDraftBytes || 0);
        if (totalBytes > 0) {
          const decremented = await transaction.user.updateMany({
            where: { id: ownerId, htmlStorageUsedBytes: { gte: totalBytes } },
            data: { htmlStorageUsedBytes: { decrement: totalBytes } },
          });
          if (decremented.count === 0) {
            // 账目小于应还值（历史数据异常）：直接归零
            await transaction.user.update({
              where: { id: ownerId },
              data: { htmlStorageUsedBytes: 0 },
            });
          }
        }
      }
    });
  } catch (error) {
    if (existing.ownerId && (staged.live || staged.draft)) {
      await restoreStagedHtmlToolDeletion(staged, existing.ownerId, existing.id).catch(
        (restoreError) => {
          console.error(`HTML 工具目录恢复失败（${existing.id}）：`, restoreError);
        },
      );
    }
    throw error;
  }

  await purgeStagedHtmlToolDeletion(staged).catch((error) => {
    console.error(`HTML 工具暂存目录清理失败（${existing.id}）：`, error);
  });

  // 条目已删除 / 可见性可能变化，内容分发缓存立即失效
  invalidateHtmlToolContentAccess();
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
    invalidateHtmlToolContentAccess();
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

/** 属主申请把草稿更新为公开版本（进入管理员审批队列）；审批通过前公开版保持不变 */
export async function applyHtmlUpdate(id: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || !id) {
    return { error: "请先登录" };
  }
  const tool = await prisma.tool.findUnique({ where: { id } });
  if (!tool || tool.ownerId !== session.user.id || tool.visibility !== "public") {
    return { error: "条目不存在或无权操作" };
  }
  if (tool.kind !== "html" || !tool.htmlDraftEntry || tool.htmlDraftBytes <= 0) {
    return { error: "当前没有可申请的更新内容，请先替换 HTML 文件" };
  }
  if (tool.htmlUpdateStatus === "pending") {
    return { error: "更新申请已在审批队列中，请耐心等待" };
  }
  await prisma.tool.update({
    where: { id },
    data: { htmlUpdateStatus: "pending", htmlUpdateNote: null },
  });
  revalidatePath("/my");
  revalidatePath("/admin/publish");
  return {};
}