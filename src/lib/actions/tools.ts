"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

export interface ToolFormState {
  error?: string;
}

const toolSchema = z.object({
  id: z.string().optional(),
  visibility: z.enum(["public", "private"]),
  name: z.string().trim().min(1, "请填写名称").max(50, "名称最长 50 字"),
  url: z.string().trim().url("链接格式不正确，需以 http:// 或 https:// 开头"),
  description: z.string().trim().min(1, "请填写描述").max(200, "描述最长 200 字"),
  category: z.enum(CATEGORIES, { message: "请选择有效的分类" }),
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

  if (data.visibility === "public" && session.user.role !== "admin") {
    return { error: "只有管理员可以维护公共条目" };
  }

  const values = {
    name: data.name,
    url: data.url,
    description: data.description,
    category: data.category,
    tags: normalizeTags(data.tags),
    source: data.source,
    icon: data.icon || null,
    order: data.order,
    visibility: data.visibility,
    ownerId: data.visibility === "private" ? session.user.id : null,
  };

  if (data.id) {
    const existing = await prisma.tool.findUnique({ where: { id: data.id } });
    if (!existing) {
      return { error: "条目不存在" };
    }
    if (!canManage(existing, session.user)) {
      return { error: "没有权限修改该条目" };
    }
    await prisma.tool.update({ where: { id: data.id }, data: values });
  } else {
    await prisma.tool.create({ data: values });
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/favorites");
  redirect(data.visibility === "public" ? "/admin" : "/my");
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
  // 数据模型未配置级联删除，先清理关联收藏
  await prisma.favorite.deleteMany({ where: { toolId: id } });
  await prisma.tool.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/admin");
  revalidatePath("/favorites");
}
