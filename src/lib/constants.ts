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

/** 把数据库里的逗号分隔 tags 拆成数组，供页面展示与筛选 */
export function parseTags(tags: string): string[] {
  return tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
