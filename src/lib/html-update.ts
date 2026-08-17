import { prisma } from "@/lib/prisma";
import {
  promoteHtmlDraftToLive,
  purgeStagedHtmlTool,
  removeHtmlToolDirectory,
  restoreStagedHtmlTool,
} from "@/lib/html-tools";

/**
 * 把草稿晋升为正式内容（更新审批通过 / 下架合并草稿共用）：
 * 磁盘原子替换（旧正式目录入回收站、草稿就位），额度按新旧差额结算，
 * 草稿字段清零。数据库失败时回滚磁盘。
 * 纯 lib 模块（不依赖 next/cache），便于单元测试与复用。
 */
export async function promoteDraftForTool(tool: {
  id: string;
  ownerId: string | null;
  htmlEntry: string | null;
  htmlBytes: number;
  htmlDraftEntry: string | null;
  htmlDraftBytes: number;
  htmlAccessToken: string | null;
}): Promise<void> {
  const ownerId = tool.ownerId!;
  const staged = await promoteHtmlDraftToLive(ownerId, tool.id);
  if (staged === null) {
    throw new Error("正式目录缺失，无法晋升草稿");
  }
  try {
    await prisma.$transaction(async (transaction) => {
      // 还旧正式版额度；草稿额度已在账上，晋升后自然转为正式版占用
      if (tool.htmlBytes > 0) {
        const decremented = await transaction.user.updateMany({
          where: { id: ownerId, htmlStorageUsedBytes: { gte: tool.htmlBytes } },
          data: { htmlStorageUsedBytes: { decrement: tool.htmlBytes } },
        });
        if (decremented.count === 0) {
          await transaction.user.update({
            where: { id: ownerId },
            data: { htmlStorageUsedBytes: 0 },
          });
        }
      }
      const relativeUrl = `/api/html-tools/content/${tool.htmlAccessToken}/${tool.htmlDraftEntry!
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      await transaction.tool.update({
        where: { id: tool.id },
        data: {
          htmlEntry: tool.htmlDraftEntry,
          htmlBytes: tool.htmlDraftBytes,
          url: relativeUrl,
          htmlDraftEntry: null,
          htmlDraftBytes: 0,
          htmlUpdateStatus: "none",
          htmlUpdateNote: null,
        },
      });
    });
  } catch (error) {
    // 回滚磁盘：移除已就位的草稿、恢复旧正式目录（尽力而为）
    await removeHtmlToolDirectory(ownerId, tool.id).catch(console.error);
    await restoreStagedHtmlTool(staged, ownerId, tool.id).catch(console.error);
    throw error;
  }
  await purgeStagedHtmlTool(staged).catch((error) => {
    console.error(`草稿晋升后的旧目录清理失败（${tool.id}）：`, error);
  });
}
