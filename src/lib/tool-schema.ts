import { z } from "zod";

/**
 * 工具条目的共享校验规则：/my、/admin 表单（Server Action）与 HTML 上传路由共用，
 * 避免两处规则漂移。枚举取值与 prisma/schema.prisma 中的字符串字段保持一致。
 */

export const TOOL_VISIBILITIES = ["public", "private"] as const;
export const TOOL_SOURCES = ["self", "third-party"] as const;
export const TOOL_KINDS = ["link", "html"] as const;
export const PUBLISH_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export const USER_ROLES = ["admin", "user"] as const;

export type ToolVisibility = (typeof TOOL_VISIBILITIES)[number];
export type ToolSource = (typeof TOOL_SOURCES)[number];
export type ToolKind = (typeof TOOL_KINDS)[number];
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];

/** 名称 / 描述 / 分类 / 标签 / 图标 / 排序：表单与上传共用部分 */
export const toolCoreSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(50, "名称最长 50 字"),
  description: z.string().trim().min(1, "请填写描述").max(200, "描述最长 200 字"),
  category: z.string().trim().min(1, "请选择分类").max(20, "分类名过长"),
  tags: z.string().trim().max(100, "标签总长最长 100 字").optional().default(""),
  icon: z.string().trim().max(64, "图标长度超出限制").optional().default(""),
  order: z.coerce.number().int("排序需为整数").min(-9999, "排序超出范围").max(9999, "排序超出范围").default(0),
});

/** 新增 / 编辑工具条目（/my 私有与 /admin 公共共用） */
export const toolSchema = toolCoreSchema.extend({
  id: z.string().optional(),
  visibility: z.enum(TOOL_VISIBILITIES),
  url: z.string().trim().min(1, "请填写链接").max(2048, "链接过长"),
  source: z.enum(TOOL_SOURCES, { message: "请选择来源" }),
});

/** HTML 上传接口的元数据（无链接与来源，由系统决定） */
export const uploadMetadataSchema = toolCoreSchema;

/** 邮箱 + 密码：登录 / 注册共用；bcrypt 只处理前 72 字节，超长输入会拖慢校验 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MAX_BYTES = 72;

export const emailField = z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "邮箱格式不正确");
export const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `密码至少 ${PASSWORD_MIN_LENGTH} 位`)
  .max(PASSWORD_MAX_LENGTH, `密码最长 ${PASSWORD_MAX_LENGTH} 位`);
