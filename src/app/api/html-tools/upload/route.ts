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
  removeUploadStaging,
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
  let finalized = false;
  let committed = false;
  let toolId: string | null = null;

  try {
    const fileName = path.basename(readEncodedHeader(request, "x-html-tool-file-name"));
    const extension = path.extname(fileName).toLowerCase();
    if (![".html", ".htm", ".zip"].includes(extension)) {
      throw new UploadError("仅支持 .html、.htm 或 .zip 文件");
    }

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

    // 分类必须在当前分组清单内（与保存表单行为一致，不做静默降级）
    const knownCategories = new Set(await listCategoryNames());
    if (!knownCategories.has(parsed.data.category)) {
      throw new UploadError("请选择有效的分类");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { htmlStorageUsedBytes: true },
    });
    if (!user) throw new UploadError("用户不存在", 404);
    const remainingBytes = Math.max(0, HTML_TOOL_QUOTA_BYTES - user.htmlStorageUsedBytes);
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
          name: parsed.data.name,
          url: relativeUrl,
          description: parsed.data.description,
          category: parsed.data.category,
          tags: normalizeTags(parsed.data.tags),
          source: "self",
          icon: parsed.data.icon || null,
          order: parsed.data.order,
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

    try {
      revalidatePath("/my");
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
    if (finalized && !committed && toolId) {
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
