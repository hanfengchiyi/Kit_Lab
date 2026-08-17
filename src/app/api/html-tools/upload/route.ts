import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createHtmlToolStagingDir,
  finalizeHtmlToolDirectory,
  HTML_TOOL_QUOTA_BYTES,
  PackageRejectedError,
  prepareHtmlToolPackage,
  removeHtmlToolDirectory,
  removeHtmlToolDraft,
  removeUploadStaging,
  replaceHtmlToolDirectory,
  replaceHtmlToolDraft,
  restoreStagedHtmlTool,
  restoreStagedHtmlToolTo,
  htmlToolDraftDirectory,
  purgeStagedHtmlTool,
} from "@/lib/html-tools";
import { listCategoryNames } from "@/lib/categories";
import { normalizeTags } from "@/lib/constants";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { uploadMetadataSchema } from "@/lib/tool-schema";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 每 IP 每小时最多 10 次 HTML 上传（上传体量大、落盘重） */
const UPLOAD_RATE_LIMIT = 10;
const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1000;

class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function readEncodedHeader(request: Request, name: string): string {
  const raw = request.headers.get(name);
  if (!raw) throw new UploadError(`缺少请求字段：${name}`);
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new UploadError(`请求字段格式错误：${name}`);
  }
}

/** 解析新建模式的元数据头（替换模式元数据来自数据库，不调用） */
function parseUploadMetadata(request: Request) {
  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(readEncodedHeader(request, "x-html-tool-metadata"));
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("工具信息格式错误");
  }
  const parsed = uploadMetadataSchema.safeParse(rawMetadata);
  if (!parsed.success) {
    throw new UploadError(parsed.error.issues[0]?.message || "工具信息不完整");
  }
  return parsed.data;
}

async function saveRequestBody(
  body: ReadableStream<Uint8Array> | null,
  filePath: string,
  maxBytes: number,
): Promise<number> {
  if (!body) throw new UploadError("没有收到上传文件");
  const reader = body.getReader();
  const handle = await open(filePath, "wx");
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new UploadError("上传文件超过剩余存储额度", 413);
      }
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await handle.write(
          value,
          offset,
          value.byteLength - offset,
        );
        if (bytesWritten === 0) throw new UploadError("上传文件写入失败", 500);
        offset += bytesWritten;
      }
    }
  } finally {
    await handle.close();
  }
  if (total === 0) throw new UploadError("上传文件是空的");
  return total;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`upload:${ip}`, UPLOAD_RATE_LIMIT, UPLOAD_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "上传过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec ?? 3600) },
      },
    );
  }

  let stagingDirectory: string | null = null;
  let replaceStaged: string | null = null;
  let finalized = false;
  let committed = false;
  let toolId: string | null = null;
  let replaceMode = false;

  try {
    const fileName = path.basename(readEncodedHeader(request, "x-html-tool-file-name"));
    const extension = path.extname(fileName).toLowerCase();
    if (![".html", ".htm", ".zip"].includes(extension)) {
      throw new UploadError("仅支持 .html、.htm 或 .zip 文件");
    }

    // 替换模式：可选 x-html-tool-id 指向现有 HTML 工具。
    // 沿用原访问令牌与工具 id；按工具状态决定替换哪个版本：
    //   私有工具             → 属主替换正式目录（现状行为）
    //   公开工具 + 属主      → 替换草稿目录（自己立即可用，公开版不变）
    //   公开工具 + 管理员    → 替换正式目录（直接更新公开版）
    const rawReplaceId = request.headers.get("x-html-tool-id");
    let replaceTool: {
      id: string;
      ownerId: string | null;
      visibility: string;
      kind: string;
      htmlEntry: string | null;
      htmlBytes: number;
      htmlAccessToken: string | null;
      htmlDraftEntry: string | null;
      htmlDraftBytes: number;
      htmlUpdateStatus: string;
    } | null = null;
    if (rawReplaceId && rawReplaceId.trim() !== "") {
      let replaceId: string;
      try {
        replaceId = decodeURIComponent(rawReplaceId);
      } catch {
        throw new UploadError("工具编号格式错误");
      }
      replaceTool = await prisma.tool.findUnique({
        where: { id: replaceId },
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          kind: true,
          htmlEntry: true,
          htmlBytes: true,
          htmlAccessToken: true,
          htmlDraftEntry: true,
          htmlDraftBytes: true,
          htmlUpdateStatus: true,
        },
      });
      if (!replaceTool || replaceTool.kind !== "html" || !replaceTool.ownerId) {
        throw new UploadError("要替换的 HTML 工具不存在", 404);
      }
      const isOwner = replaceTool.ownerId === session.user.id;
      const isAdmin = session.user.role === "admin";
      // 公开条目属主（草稿版）或管理员（公开版）可替换；私有条目仅属主
      const canReplace = replaceTool.visibility === "public" ? isOwner || isAdmin : isOwner;
      if (!canReplace) {
        throw new UploadError("没有权限替换该工具", 403);
      }
      replaceMode = true;
    }

    let parsed: Awaited<ReturnType<typeof parseUploadMetadata>> | null = null;
    if (!replaceMode) {
      parsed = parseUploadMetadata(request);

      // 分类必须在当前分组清单内（与保存表单行为一致，不做静默降级）
      const knownCategories = new Set(await listCategoryNames());
      if (!knownCategories.has(parsed.category)) {
        throw new UploadError("请选择有效的分类");
      }
    }

    // 额度归属：替换模式归原工具属主，新建模式归当前用户。
    // 替换时目标版本旧文件占用的额度先视为可再使用，按「剩余 + 旧文件大小」允许新包体。
    const quotaOwnerId = replaceTool?.ownerId ?? session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: quotaOwnerId },
      select: { htmlStorageUsedBytes: true },
    });
    if (!user) throw new UploadError("用户不存在", 404);
    // 公开工具 + 属主替换草稿；其余替换正式目录
    const replaceDraft =
      replaceMode &&
      replaceTool!.visibility === "public" &&
      replaceTool!.ownerId === session.user.id;
    const oldBytes = replaceTool ? (replaceDraft ? replaceTool.htmlDraftBytes : replaceTool.htmlBytes) : 0;
    const remainingBytes = Math.max(0, HTML_TOOL_QUOTA_BYTES - user.htmlStorageUsedBytes + oldBytes);
    if (remainingBytes === 0) throw new UploadError("HTML 工具存储额度已用完", 413);

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > remainingBytes) {
      throw new UploadError("上传文件超过剩余存储额度", 413);
    }

    stagingDirectory = await createHtmlToolStagingDir();
    const packagePath = path.join(stagingDirectory, "package.bin");
    await saveRequestBody(request.body, packagePath, remainingBytes);

    const preparedDirectory = path.join(stagingDirectory, "content");
    await mkdir(preparedDirectory, { recursive: true });
    const prepared = await prepareHtmlToolPackage(
      packagePath,
      fileName,
      preparedDirectory,
      remainingBytes,
    );

    if (replaceMode) {
      toolId = replaceTool!.id;
      // 目标目录原子替换；正式目录缺失视为并发冲突，草稿首次创建无旧目录属正常
      if (replaceDraft) {
        replaceStaged = await replaceHtmlToolDraft(quotaOwnerId, toolId, preparedDirectory);
      } else {
        replaceStaged = await replaceHtmlToolDirectory(quotaOwnerId, toolId, preparedDirectory);
        if (replaceStaged === null) {
          throw new UploadError("工具内容刚刚被修改，请刷新页面重试", 409);
        }
      }
      finalized = true;
      try {
        await prisma.$transaction(async (transaction) => {
          // 先归还旧额度（带下限保护，账目异常时归零），再按新文件扣取
          if (oldBytes > 0) {
            const decremented = await transaction.user.updateMany({
              where: { id: quotaOwnerId, htmlStorageUsedBytes: { gte: oldBytes } },
              data: { htmlStorageUsedBytes: { decrement: oldBytes } },
            });
            if (decremented.count === 0) {
              await transaction.user.update({
                where: { id: quotaOwnerId },
                data: { htmlStorageUsedBytes: 0 },
              });
            }
          }
          const quotaAvailable = HTML_TOOL_QUOTA_BYTES - prepared.totalBytes;
          const reserved = await transaction.user.updateMany({
            where: { id: quotaOwnerId, htmlStorageUsedBytes: { lte: quotaAvailable } },
            data: { htmlStorageUsedBytes: { increment: prepared.totalBytes } },
          });
          if (reserved.count !== 1) {
            throw new UploadError("并发上传后剩余额度不足，请刷新页面再试", 409);
          }
          if (replaceDraft) {
            // 草稿替换：访问令牌与公开版保持不变；审批通过前公开访客仍看到旧公开版
            await transaction.tool.update({
              where: { id: toolId! },
              data: {
                htmlDraftEntry: prepared.entryFile,
                htmlDraftBytes: prepared.totalBytes,
              },
            });
          } else {
            // 正式版替换：访问令牌保持不变，旧链接继续有效并立即指向新内容；入口文件可能变化，同步更新 url
            const relativeUrl = `/api/html-tools/content/${replaceTool!.htmlAccessToken}/${prepared.entryFile
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`;
            await transaction.tool.update({
              where: { id: toolId! },
              data: {
                htmlEntry: prepared.entryFile,
                htmlBytes: prepared.totalBytes,
                url: relativeUrl,
              },
            });
          }
        });
      } catch (error) {
        // 数据库失败则回滚磁盘：移除新目录、恢复旧目录（尽力而为）
        if (replaceDraft) {
          await removeHtmlToolDraft(quotaOwnerId, toolId).catch(console.error);
        } else {
          await removeHtmlToolDirectory(quotaOwnerId, toolId).catch(console.error);
        }
        if (replaceStaged) {
          if (replaceDraft) {
            await restoreStagedHtmlToolTo(replaceStaged, htmlToolDraftDirectory(quotaOwnerId, toolId)).catch(console.error);
          } else {
            await restoreStagedHtmlTool(replaceStaged, quotaOwnerId, toolId).catch(console.error);
          }
        }
        throw error;
      }
      committed = true;
    } else {
      toolId = randomUUID();
      const accessToken = randomBytes(32).toString("base64url");
      await finalizeHtmlToolDirectory(preparedDirectory, session.user.id, toolId);
      finalized = true;

      const quotaAvailable = HTML_TOOL_QUOTA_BYTES - prepared.totalBytes;
      await prisma.$transaction(async (transaction) => {
        const reserved = await transaction.user.updateMany({
          where: {
            id: session.user.id,
            htmlStorageUsedBytes: { lte: quotaAvailable },
          },
          data: { htmlStorageUsedBytes: { increment: prepared.totalBytes } },
        });
        if (reserved.count !== 1) {
          throw new UploadError("并发上传后剩余额度不足，请刷新页面再试", 409);
        }

        const relativeUrl = `/api/html-tools/content/${accessToken}/${prepared.entryFile
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;
        await transaction.tool.create({
          data: {
            id: toolId!,
            name: parsed!.name,
            url: relativeUrl,
            description: parsed!.description,
            category: parsed!.category,
            tags: normalizeTags(parsed!.tags),
            source: "self",
            icon: parsed!.icon || null,
            order: parsed!.order,
            visibility: "private",
            ownerId: session.user.id,
            kind: "html",
            htmlEntry: prepared.entryFile,
            htmlBytes: prepared.totalBytes,
            htmlAccessToken: accessToken,
          },
        });
      });
      committed = true;
    }

    if (replaceStaged) {
      await purgeStagedHtmlTool(replaceStaged).catch((error) => {
        console.error(`替换后的旧工具目录清理失败（${toolId}）：`, error);
      });
    }

    try {
      revalidatePath("/my");
      revalidatePath("/admin");
      revalidatePath("/");
    } catch (error) {
      // 上传已经持久化成功，缓存刷新失败不应诱导用户重复上传。
      console.error("HTML 工具页面缓存刷新失败：", error);
    }
    return NextResponse.json(
      {
        ok: true,
        toolId,
        bytes: prepared.totalBytes,
        files: prepared.fileCount,
      },
      { status: 201 },
    );
  } catch (error) {
    if (!replaceMode && finalized && !committed && toolId) {
      await removeHtmlToolDirectory(session.user.id, toolId).catch(console.error);
    }
    if (error instanceof PackageRejectedError) {
      // 包内容不合规（路径/软链/超限/无入口）→ 4xx 回显友好文案
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "上传失败，请稍后重试";
    const status = error instanceof UploadError ? error.status : 500;
    if (status === 500) console.error("HTML 工具上传失败：", error);
    return NextResponse.json({ error: message }, { status });
  } finally {
    if (stagingDirectory) {
      await removeUploadStaging(stagingDirectory).catch(console.error);
    }
  }
}
