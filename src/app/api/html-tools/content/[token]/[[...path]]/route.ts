import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  contentTypeFor,
  htmlToolDraftDirectory,
  htmlToolDirectory,
  requestUsesDedicatedHtmlOrigin,
  resolveExistingHtmlToolAsset,
  streamFile,
} from "@/lib/html-tools";
import { getInjectedHtml } from "@/lib/html-tool-proxy";
import { getCachedHtmlToolContentAccess } from "@/lib/html-tool-access";
import { categoryAllowed, getAllowedCategories } from "@/lib/grants";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAME_ORIGIN_SANDBOX = [
  "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads",
  "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
  "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
  "style-src * data: blob: 'unsafe-inline'",
  "img-src * data: blob:",
  "media-src * data: blob:",
  "connect-src * data: blob:",
  "worker-src * data: blob:",
  "form-action *",
].join("; ");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; path?: string[] }> },
) {
  const { token, path: pathSegments } = await params;
  if (!token || !pathSegments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 走 60s 缓存（tag 失效兜底）：工具页一次加载几十个静态资源，避免每个请求都打库
  const tool = await getCachedHtmlToolContentAccess(token);
  if (!tool || tool.kind !== "html" || !tool.ownerId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const session = await auth();
  const isOwner = session?.user?.id === tool.ownerId;
  const isAdmin = session?.user?.role === "admin";

  if (!isOwner && !isAdmin) {
    // 私有 / 已下架条目只有属主与管理员的地址有效；token 泄露不应暴露内容。
    if (tool.visibility !== "public") {
      return new NextResponse("Not found", { status: 404 });
    }
    // 分类授权：受限用户无权使用该分类时，即使拿到内容地址也拒绝访问
    const allowed = await getAllowedCategories(session?.user);
    if (!categoryAllowed(allowed, tool.category)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // 版本分发：属主/管理员可见草稿（创作者最新版），其他人只见已审批的公开版。
  // 草稿文件缺失时回退到公开版，避免旧资源引用 404。
  const viewer = isOwner || isAdmin;
  const hasDraft = viewer && !!tool.htmlDraftEntry && tool.htmlDraftBytes > 0;

  if (hasDraft && tool.htmlDraftEntry) {
    // 属主从旧入口地址（公开版入口）打开时，重定向到草稿入口，保证立即看到最新版
    const requested = pathSegments.join("/");
    if (requested === (tool.htmlEntry ?? "") && tool.htmlDraftEntry !== tool.htmlEntry) {
      const redirect = new URL(request.url);
      redirect.pathname = `/api/html-tools/content/${token}/${tool.htmlDraftEntry
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
      return NextResponse.redirect(redirect, 307);
    }
  }

  // 草稿优先、公开版兜底（草稿缺失的资源继续用公开版，避免旧引用 404）
  const filePath = await resolveExistingHtmlToolAsset(
    hasDraft
      ? [
          htmlToolDraftDirectory(tool.ownerId, tool.id),
          htmlToolDirectory(tool.ownerId, tool.id),
        ]
      : [htmlToolDirectory(tool.ownerId, tool.id)],
    pathSegments,
  );
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }
  // 单次 stat：文件不存在与不是普通文件都按 404 处理
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!fileStat.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = contentTypeFor(filePath);
  const requestHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const dedicatedOrigin = requestUsesDedicatedHtmlOrigin(request.url, requestHost);
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(fileStat.size),
    // 浏览器侧不缓存：令牌有效性由服务端缓存（60s TTL + 写入即失效）保证，
    // 删除/下架工具后最迟一个失效周期内旧地址即不可用于新会话。
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-HTML-Tool-Sandbox": dedicatedOrigin ? "disabled" : "enabled",
  });

  if (contentType.startsWith("text/html") && !dedicatedOrigin) {
    headers.set("Content-Security-Policy", SAME_ORIGIN_SANDBOX);
  }

  // HTML 入口页注入跨域代理补丁，让工具里的 fetch/XHR 跨域请求改走本站服务端代理。
  // 注入结果按「路径+大小+mtime」做内存缓存，避免每次访问重复读盘与注入。
  // 超大 HTML 维持流式返回、不注入。
  const MAX_INJECT_BYTES = 10 * 1024 * 1024;
  if (contentType.startsWith("text/html") && fileStat.size <= MAX_INJECT_BYTES) {
    const html = await getInjectedHtml(filePath, fileStat.size, fileStat.mtimeMs);
    headers.set("Content-Length", String(Buffer.byteLength(html)));
    return new NextResponse(html, { status: 200, headers });
  }

  const body = Readable.toWeb(streamFile(filePath)) as ReadableStream<Uint8Array>;
  return new NextResponse(body, { status: 200, headers });
}
