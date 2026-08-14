import { createReadStream, createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import mime from "mime-types";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export const HTML_TOOL_QUOTA_BYTES = 1024 * 1024 * 1024;
export const HTML_TOOL_MAX_FILES = 10_000;

/**
 * 用户提交的 HTML 包内容不合规（不安全路径 / 软链接 / 超限 / 无入口等）。
 * 属于客户端输入错误，应作为 4xx 返回，而不是 500。
 */
export class PackageRejectedError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PackageRejectedError";
  }
}

export interface HtmlToolLinkFields {
  url: string;
  kind?: string;
  htmlEntry?: string | null;
  htmlAccessToken?: string | null;
}

export interface PreparedHtmlTool {
  entryFile: string;
  totalBytes: number;
  fileCount: number;
}

function storageRoot(): string {
  return path.resolve(
    process.env.HTML_TOOL_STORAGE_DIR || path.join(process.cwd(), "data", "user-html-tools"),
  );
}

/** 为上传创建与正式目录同盘的暂存区，保证最终 rename 是原子操作。 */
export async function createHtmlToolStagingDir(): Promise<string> {
  const stagingRoot = path.join(storageRoot(), ".staging");
  await mkdir(stagingRoot, { recursive: true });
  return mkdtemp(path.join(stagingRoot, "upload-"));
}

export function htmlToolDirectory(ownerId: string, toolId: string): string {
  return path.join(storageRoot(), ownerId, toolId);
}

export async function finalizeHtmlToolDirectory(
  preparedDirectory: string,
  ownerId: string,
  toolId: string,
): Promise<string> {
  const target = htmlToolDirectory(ownerId, toolId);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(preparedDirectory, target);
  return target;
}

export async function removeHtmlToolDirectory(ownerId: string, toolId: string): Promise<void> {
  await rm(htmlToolDirectory(ownerId, toolId), { recursive: true, force: true });
}

/** 先把待删目录原子移出服务路径；数据库失败时仍可恢复。 */
/** 顺带清理 .trash 中超过 7 天的残留（崩溃中断等情况下可能遗留） */
async function sweepTrash(trashRoot: string): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = await readdir(trashRoot);
  } catch {
    return; // 目录不存在等，无需清理
  }
  await Promise.all(
    entries.map(async (name) => {
      const target = path.join(trashRoot, name);
      try {
        const info = await stat(target);
        if (info.mtimeMs < cutoff) {
          await rm(target, { recursive: true, force: true });
        }
      } catch {
        // 单个残留清理失败不影响主流程
      }
    }),
  );
}

export async function stageHtmlToolDeletion(
  ownerId: string,
  toolId: string,
): Promise<string | null> {
  const source = htmlToolDirectory(ownerId, toolId);
  const trashRoot = path.join(storageRoot(), ".trash");
  const staged = path.join(trashRoot, `${toolId}-${randomUUID()}`);
  await mkdir(trashRoot, { recursive: true });
  await sweepTrash(trashRoot).catch(() => {});
  try {
    await rename(source, staged);
    return staged;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function restoreStagedHtmlTool(
  stagedDirectory: string,
  ownerId: string,
  toolId: string,
): Promise<void> {
  const target = htmlToolDirectory(ownerId, toolId);
  await mkdir(path.dirname(target), { recursive: true });
  await rename(stagedDirectory, target);
}

export async function purgeStagedHtmlTool(stagedDirectory: string): Promise<void> {
  await rm(stagedDirectory, { recursive: true, force: true });
}

export async function removeUploadStaging(stagingDirectory: string): Promise<void> {
  await rm(stagingDirectory, { recursive: true, force: true });
}

function isZipSymlink(entry: Entry): boolean {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & 0o170000) === 0o120000;
}

export function validateArchivePath(fileName: string): string {
  const normalizedSlashes = fileName.replaceAll("\\", "/");
  if (
    normalizedSlashes.includes("\0") ||
    normalizedSlashes.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizedSlashes) ||
    normalizedSlashes.length > 1024
  ) {
    throw new PackageRejectedError(`ZIP 中包含不安全的路径：${fileName}`);
  }

  const segments = normalizedSlashes.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === ".." || segment === ".")) {
    throw new PackageRejectedError(`ZIP 中包含不安全的路径：${fileName}`);
  }

  for (const segment of segments) {
    if (
      /[<>:"|?*]/.test(segment) ||
      /[. ]$/.test(segment) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)
    ) {
      throw new PackageRejectedError(`ZIP 中包含当前系统不支持的文件名：${fileName}`);
    }
  }

  return segments.join("/");
}

function openZip(filePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, autoClose: true, validateEntrySizes: true },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(error || new Error("无法打开 ZIP 文件"));
          return;
        }
        resolve(zipFile);
      },
    );
  });
}

function openZipEntry(zipFile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error || new Error(`无法读取 ZIP 条目：${entry.fileName}`));
        return;
      }
      resolve(stream);
    });
  });
}

async function extractZip(
  packagePath: string,
  destination: string,
  maxBytes: number,
): Promise<{ files: string[]; totalBytes: number }> {
  const zipFile = await openZip(packagePath);
  const files: string[] = [];
  let totalBytes = 0;
  let fileCount = 0;

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(error instanceof Error ? error : new Error("ZIP 解压失败"));
    };

    zipFile.on("error", fail);
    zipFile.on("end", () => {
      if (settled) return;
      settled = true;
      resolve({ files, totalBytes });
    });
    zipFile.on("entry", (entry) => {
      void (async () => {
        if (isZipSymlink(entry)) {
          throw new PackageRejectedError(`ZIP 不允许包含软链接：${entry.fileName}`);
        }

        const relativePath = validateArchivePath(entry.fileName);
        const isDirectory = /\/$/.test(entry.fileName);
        const target = path.resolve(destination, ...relativePath.split("/"));
        const destinationPrefix = `${path.resolve(destination)}${path.sep}`;
        if (!target.startsWith(destinationPrefix)) {
          throw new PackageRejectedError(`ZIP 中包含越界路径：${entry.fileName}`);
        }

        if (isDirectory) {
          await mkdir(target, { recursive: true });
          zipFile.readEntry();
          return;
        }

        fileCount += 1;
        if (fileCount > HTML_TOOL_MAX_FILES) {
          throw new PackageRejectedError(
            `单个 HTML 工具最多包含 ${HTML_TOOL_MAX_FILES} 个文件`,
          );
        }

        await mkdir(path.dirname(target), { recursive: true });
        const input = await openZipEntry(zipFile, entry);
        // 按实际写入字节计数（不信任 zip 头声明的 uncompressedSize，防 ZIP 炸弹）
        const counter = createQuotaCounter(maxBytes - totalBytes);
        await pipeline(input, counter, createWriteStream(target, { flags: "wx" }));
        totalBytes += counter.count;
        files.push(relativePath);
        zipFile.readEntry();
      })().catch(fail);
    });

    zipFile.readEntry();
  });
}

export interface QuotaCounter extends Transform {
  /** 累计实际写入的字节数 */
  readonly count: number;
}

/**
 * 实际写入字节计数流：超过 maxBytes 即中断并报错。
 * 用于解压时按真实写出量记账，防止伪造 zip 头大小绕过配额。
 */
export function createQuotaCounter(maxBytes: number): QuotaCounter {
  let count = 0;
  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      count += chunk.length;
      if (count > maxBytes) {
        callback(new PackageRejectedError("解压后的实际大小超过剩余存储额度", 413));
        return;
      }
      callback(null, chunk);
    },
  }) as QuotaCounter;
  Object.defineProperty(transform, "count", { get: () => count });
  return transform;
}

export function pickEntryFile(files: string[]): string {
  const rootIndex = files.find((file) => file.toLowerCase() === "index.html");
  if (rootIndex) return rootIndex;

  const nestedIndexes = files.filter(
    (file) => path.posix.basename(file).toLowerCase() === "index.html",
  );
  if (nestedIndexes.length === 1) return nestedIndexes[0];

  const htmlFiles = files.filter((file) => /\.html?$/i.test(file));
  if (htmlFiles.length === 1) return htmlFiles[0];

  if (nestedIndexes.length > 1) {
    throw new PackageRejectedError(
      "ZIP 中有多个 index.html，请只保留一个入口页面或把入口放在 ZIP 根目录",
    );
  }
  throw new PackageRejectedError(
    "没有找到入口页面；ZIP 根目录需要 index.html，或只包含一个 HTML 文件",
  );
}

export async function prepareHtmlToolPackage(
  packagePath: string,
  originalFileName: string,
  destination: string,
  maxBytes: number,
): Promise<PreparedHtmlTool> {
  await mkdir(destination, { recursive: true });
  const extension = path.extname(originalFileName).toLowerCase();

  if (extension === ".html" || extension === ".htm") {
    const fileStat = await stat(packagePath);
    if (fileStat.size > maxBytes) {
      throw new PackageRejectedError("HTML 文件超过剩余存储额度", 413);
    }
    await copyFile(packagePath, path.join(destination, "index.html"));
    return { entryFile: "index.html", totalBytes: fileStat.size, fileCount: 1 };
  }

  if (extension !== ".zip") {
    throw new PackageRejectedError("仅支持 .html、.htm 或 .zip 文件");
  }

  const extracted = await extractZip(packagePath, destination, maxBytes);
  if (extracted.files.length === 0) {
    throw new PackageRejectedError("ZIP 文件是空的");
  }
  return {
    entryFile: pickEntryFile(extracted.files),
    totalBytes: extracted.totalBytes,
    fileCount: extracted.files.length,
  };
}

function contentOrigin(): string | null {
  const raw = process.env.HTML_TOOL_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function encodedPath(filePath: string): string {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getToolHref(tool: HtmlToolLinkFields): string {
  if (tool.kind !== "html" || !tool.htmlAccessToken || !tool.htmlEntry) {
    return tool.url;
  }
  const relative = `/api/html-tools/content/${tool.htmlAccessToken}/${encodedPath(tool.htmlEntry)}`;
  const origin = contentOrigin();
  return origin ? `${origin}${relative}` : relative;
}

export function requestUsesDedicatedHtmlOrigin(
  requestUrl: string,
  requestHost?: string | null,
): boolean {
  const expected = contentOrigin();
  if (!expected) return false;
  const actualHost = requestHost?.split(",")[0]?.trim() || new URL(requestUrl).host;
  return actualHost.toLowerCase() === new URL(expected).host.toLowerCase();
}

export function resolveHtmlToolAsset(
  ownerId: string,
  toolId: string,
  pathSegments: string[],
): string | null {
  if (pathSegments.length === 0) return null;
  const relative = pathSegments.join("/");
  let safeRelative: string;
  try {
    safeRelative = validateArchivePath(relative);
  } catch {
    return null;
  }
  const root = path.resolve(htmlToolDirectory(ownerId, toolId));
  const target = path.resolve(root, ...safeRelative.split("/"));
  return target.startsWith(`${root}${path.sep}`) ? target : null;
}

export async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export function contentTypeFor(filePath: string): string {
  return mime.contentType(path.extname(filePath)) || "application/octet-stream";
}

export function streamFile(filePath: string) {
  return createReadStream(filePath);
}