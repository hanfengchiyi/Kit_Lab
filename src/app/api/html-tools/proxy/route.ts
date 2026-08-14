import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { allowPrivateTargets, isBlockedHost } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 用户 HTML 工具的同源代理：浏览器里跨域请求会被 CORS 拦截，
 * 由服务端代为转发（服务器之间没有同源策略）。
 * 只转发请求体里声明的 URL/方法/头，绝不携带本站 Cookie。
 *
 * 安全设计：
 * - 目标地址逐跳校验（含重定向），拒绝环回/私网/云元数据地址（SSRF 防护）；
 * - 按 IP 限流，避免被当成开放转发跳板；
 * - 沙箱模式（同源 opaque origin）下允许 Origin: null 的 CORS 请求。
 */

const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_BODY_BYTES = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
/** 每 IP 每分钟最多 60 次代理请求 */
const PROXY_RATE_LIMIT = 60;
const PROXY_RATE_WINDOW_MS = 60_000;

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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** 沙箱 HTML 工具页（opaque origin）通过 CORS 使用本代理时的响应头 */
function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  // 仅放行 opaque origin（沙箱页面）；普通第三方站点拿不到匹配的 ACAO 头
  if (origin === "null") {
    return {
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  }
  return { Vary: "Origin" };
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

/**
 * 带逐跳 SSRF 校验的转发：手动跟随重定向，每一跳都重新检查目标地址，
 * 防止「公网域名 → 302 到 127.0.0.1/云元数据」的绕过。
 */
async function fetchWithRedirectValidation(
  initialUrl: string,
  method: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
): Promise<Response> {
  let current = initialUrl;

  for (let hop = 0; ; hop++) {
    if (hop > MAX_REDIRECTS) {
      throw new Error("重定向次数过多");
    }
    const host = new URL(current).hostname;
    if (!allowPrivateTargets() && (await isBlockedHost(host))) {
      throw new Error("重定向目标为环回/私网/元数据地址");
    }

    const response = await fetch(current, {
      method,
      headers,
      body: body ? Buffer.from(body) : null,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: "manual",
    });

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    // 不读取重定向响应体，直接断开连接
    await response.body?.cancel().catch(() => {});
    if (!location) {
      return response;
    }
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new Error("重定向目标不合法");
    }
    if (next.protocol !== "http:" && next.protocol !== "https:") {
      throw new Error("重定向目标协议不支持");
    }
    current = next.toString();
  }
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`proxy:${ip}`, PROXY_RATE_LIMIT, PROXY_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec ?? 60),
          ...corsHeadersFor(request),
        },
      },
    );
  }

  const parsed = await parsePayload(request);
  if (parsed instanceof NextResponse) {
    const response = parsed;
    for (const [key, value] of Object.entries(corsHeadersFor(request))) {
      response.headers.set(key, value);
    }
    return response;
  }

  let upstream: Response;
  try {
    upstream = await fetchWithRedirectValidation(
      parsed.url,
      parsed.method,
      parsed.headers,
      parsed.method === "GET" || parsed.method === "HEAD" || parsed.body === null
        ? null
        : new Uint8Array(parsed.body),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "目标服务器不可达";
    const response = errorResponse(502, `无法连接目标服务器：${message}`);
    for (const [key, value] of Object.entries(corsHeadersFor(request))) {
      response.headers.set(key, value);
    }
    return response;
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

  return NextResponse.json(
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      bodyBase64: Buffer.concat(chunks).toString("base64"),
    },
    { headers: corsHeadersFor(request) },
  );
}

/** 沙箱 HTML 工具（opaque origin）发起的 preflight 预检请求 */
export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeadersFor(request),
  });
}

export function GET(request: Request) {
  const response = errorResponse(405, "仅支持 POST");
  for (const [key, value] of Object.entries(corsHeadersFor(request))) {
    response.headers.set(key, value);
  }
  return response;
}