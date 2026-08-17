import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * 内容分发路由（/api/html-tools/content/[token]）的访问视图缓存。
 *
 * 背景：一个 HTML 工具页会并发请求几十个静态资源，每个请求原来都要
 * 按 token 查一次 Tool。这里按 token 缓存最小字段集：
 * - 60 秒 TTL 兜底；
 * - 所有影响内容分发的 Tool 写入口径（上传/替换/删除/上下架/审批/
 *   草稿晋升）都会调用 invalidateHtmlToolContentAccess() 立即失效。
 *
 * 注意：htmlUpdateStatus / publishStatus 等不影响分发决策的字段不在
 * 缓存内，单独变更这些字段无需失效。
 */
const CONTENT_ACCESS_SELECT = {
  id: true,
  ownerId: true,
  kind: true,
  category: true,
  visibility: true,
  htmlEntry: true,
  htmlDraftEntry: true,
  htmlDraftBytes: true,
} as const;

export const HTML_TOOL_CONTENT_TAG = "html-tool-content";

export const getCachedHtmlToolContentAccess = unstable_cache(
  async (token: string) =>
    prisma.tool.findUnique({
      where: { htmlAccessToken: token },
      select: CONTENT_ACCESS_SELECT,
    }),
  ["html-tool-content-access"],
  { tags: [HTML_TOOL_CONTENT_TAG], revalidate: 60 },
);

/** Tool 的内容 / 可见性 / 分类 / 属主变化后调用，内容路由立即看到最新状态 */
export function invalidateHtmlToolContentAccess(): void {
  revalidateTag(HTML_TOOL_CONTENT_TAG);
}
