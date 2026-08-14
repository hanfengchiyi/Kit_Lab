/** 分类清单，新增分类前先确认现有清单里没有合适的（见 README 第 4 节） */
export const CATEGORIES = [
  "开发工具",
  "文本处理",
  "图片处理",
  "效率办公",
  "设计资源",
  "其他",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SOURCES = [
  { value: "self", label: "自研" },
  { value: "third-party", label: "第三方" },
] as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 供客户端组件使用的可序列化工具数据 */
export interface ToolDTO {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  source: "self" | "third-party";
  icon: string | null;
}

/** Prisma Tool 记录中可参与 DTO 映射的字段（结构子集，宽松匹配） */
export interface ToolRecordLike {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string;
  source: string;
  icon: string | null;
}

/** 把数据库里的逗号分隔 tags 拆成数组，供页面展示与筛选 */
export function parseTags(tags: string): string[] {
  return tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** 把用户输入的标签串规范化为逗号分隔（兼容中英文逗号） */
export function normalizeTags(tags: string): string {
  return tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");
}

/** 数据库记录 → 页面可序列化 DTO（首页与收藏页共用） */
export function toToolDTO(tool: ToolRecordLike): ToolDTO {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    tags: parseTags(tool.tags),
    source: tool.source === "self" ? "self" : "third-party",
    icon: tool.icon,
  };
}
