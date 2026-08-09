import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 通过设定的图像生成 API 为工具生成图标。
 * 环境变量：
 *   ICON_GEN_API_BASE_URL  例如 http://192.220.24.62:8000/v1（留空则关闭自动生成）
 *   ICON_GEN_API_KEY       Bearer Key
 *   ICON_GEN_MODEL         默认 grok-imagine-image
 */

const TIMEOUT_MS = 60_000;

function apiConfig() {
  const baseUrl = (process.env.ICON_GEN_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.ICON_GEN_API_KEY || "").trim();
  const model = (process.env.ICON_GEN_MODEL || "grok-imagine-image").trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, model };
}

export function iconGenEnabled(): boolean {
  return apiConfig() !== null;
}

function iconsDir(): string {
  return path.resolve(process.env.HTML_TOOL_STORAGE_DIR
    ? path.join(process.env.HTML_TOOL_STORAGE_DIR, "..", "generated-icons")
    : path.join(process.cwd(), "data", "generated-icons"));
}

interface ImagesResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
}

/** 生成图标并落盘，返回站内图标路径（/api/icons/<file>）；失败返回 null 不阻塞建单 */
export async function generateToolIcon(name: string, description: string): Promise<string | null> {
  const config = apiConfig();
  if (!config) return null;

  try {
    const prompt =
      `Flat minimal app icon for a web tool named "${name}". ${description}. ` +
      "Simple geometric mascot, soft pastel colors, centered, rounded square background, no text, clean vector style.";

    const res = await fetch(`${config.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        n: 1,
        aspect_ratio: "1:1",
        resolution: "1k",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`图标生成失败（HTTP ${res.status}）：`, text.slice(0, 300));
      return null;
    }

    // Grok2API 可能把媒体 URL 拼成它自己视角的回环地址，统一改写成配置的 API 源
    const origin = new URL(config.baseUrl).origin;
    const fixed = text.replace(/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/g, origin);
    const data = JSON.parse(fixed) as ImagesResponse;
    const item = data.data?.[0];

    let bytes: Buffer | null = null;
    if (item?.b64_json) {
      bytes = Buffer.from(item.b64_json, "base64");
    } else if (item?.url) {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (imgRes.ok) {
        bytes = Buffer.from(await imgRes.arrayBuffer());
      }
    }
    if (!bytes || bytes.length === 0) return null;

    const dir = iconsDir();
    await mkdir(dir, { recursive: true });
    const fileName = `${randomUUID()}.png`;
    await writeFile(path.join(dir, fileName), bytes);
    return `/api/icons/${fileName}`;
  } catch (error) {
    console.error("图标生成异常：", error);
    return null;
  }
}

/** 供 /api/icons/[file] 路由读取图标文件（防目录穿越） */
export function resolveIconFile(fileName: string): string | null {
  if (!/^[a-zA-Z0-9-]+\.png$/.test(fileName)) return null;
  const root = iconsDir();
  const target = path.resolve(root, fileName);
  return target.startsWith(`${root}${path.sep}`) ? target : null;
}
