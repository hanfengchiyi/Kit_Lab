import dns from "node:dns/promises";
import net from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 用户 HTML 工具的同源代理：浏览器里跨域请求会被 CORS 拦截，
 * 由服务端代为转发（服务器之间没有同源策略）。
 * 只转发请求体里声明的 URL/方法/头，绝不携带本站 Cookie。
 */

const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_BODY_BYTES = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

/** 逐跳头和由运行时代理的头，不能从客户端透传。 */
const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
  "cookie",
]);

/** 已经解码/重编码过的响应头，回传给浏览器前必须去掉。 */
const STRIPPED_RESPONSE_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  "content-encoding",
  "set-cookie",
]);

function allowPrivateTargets(): boolean {
  return process.env.HTML_TOOL_PROXY_ALLOW_PRIVATE === "true";
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // 0.0.0.0/8 “本机”
      a === 10 || // 私网
      a === 127 || // 环回
      (a === 169 && b === 254) || // 链路本地 / 云元数据
      (a === 172 && b >= 16 && b <= 31) || // 私网
      (a === 192 && b === 168) // 私网
    );
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true; // 链路本地
    if (normalized.startsWith("::ffff:")) return isBlockedIp(normalized.slice(7));
    return false;
  }
  return false;
}

/** 目标主机是否命中环回/私网/元数据等禁区（含 DNS 解析结果，挡住明显的外壳域名）。 */
async function isBlockedHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (net.isIP(lower)) return isBlockedIp(lower);
  try {
    const records = await dns.lookup(lower, { all: true, verbatim: true });
    if (records.length === 0) return true;
    return records.some((record) => isBlockedIp(record.address));
  } catch {
    // DNS 解析失败的目标没有转发价值，一律拒绝。
    return true;
  }
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

interface ProxyPayload {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer | null;
}

async function parsePayload(request: Request): Promise<ProxyPayload | NextResponse> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BODY_BYTES + 64 * 1024) {
    return errorResponse(413, "请求体超过代理大小限制");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "请求体必须是 JSON");
  }

  if (!raw || typeof raw !== "object") {
    return errorResponse(400, "请求体必须是 JSON 对象");
  }

  const { url, method = "GET", headers = {}, body = null } = raw as Record<string, unknown>;

  if (typeof url !== "string" || url.length > 8192) {
    return errorResponse(400, "缺少有效的 url 字段");
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return errorResponse(400, "url 不是合法地址");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return errorResponse(400, "仅支持 http/https 目标");
  }

  const upperMethod = typeof method === "string" ? method.toUpperCase() : "";
  if (!ALLOWED_METHODS.has(upperMethod)) {
    return errorResponse(400, `不支持的请求方法：${String(method)}`);
  }

  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return errorResponse(400, "headers 字段必须是对象");
  }
  const forwardHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName)) continue;
    if (typeof value !== "string" || value.length > 8192) continue;
    forwardHeaders[name] = value;
  }

  let bodyBuffer: Buffer | null = null;
  if (body !== null && body !== undefined) {
    if (typeof body !== "string") {
      return errorResponse(400, "body 字段必须是 base64 字符串");
    }
    try {
      bodyBuffer = Buffer.from(body, "base64");
    } catch {
      return errorResponse(400, "body 字段不是有效的 base64");
    }
    if (bodyBuffer.length > MAX_REQUEST_BODY_BYTES) {
      return errorResponse(413, "请求体超过代理大小限制");
    }
  }

  return { url: target.toString(), method: upperMethod, headers: forwardHeaders, body: bodyBuffer };
}

export async function POST(request: Request) {
  const parsed = await parsePayload(request);
  if (parsed instanceof NextResponse) return parsed;

  if (!allowPrivateTargets()) {
    const host = new URL(parsed.url).hostname;
    if (await isBlockedHost(host)) {
      return errorResponse(403, "代理不允许访问环回/私网/元数据地址");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.url, {
      method: parsed.method,
      headers: parsed.headers,
      body: parsed.method === "GET" || parsed.method === "HEAD" || parsed.body === null
        ? null
        : new Uint8Array(parsed.body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "目标服务器不可达";
    return errorResponse(502, `无法连接目标服务器：${message}`);
  }

  // 手动读取响应流，超限即断开，避免代理被当成大文件中转。
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    if (upstream.body) {
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_RESPONSE_BODY_BYTES) {
          await reader.cancel();
          return errorResponse(502, "目标响应超过代理大小限制");
        }
        chunks.push(Buffer.from(value));
      }
    }
  } catch {
    return errorResponse(502, "读取目标响应失败");
  }

  const responseHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, name) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders[name] = value;
    }
  });

  return NextResponse.json({
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
    bodyBase64: Buffer.concat(chunks).toString("base64"),
  });
}

export function GET() {
  return errorResponse(405, "仅支持 POST");
}
