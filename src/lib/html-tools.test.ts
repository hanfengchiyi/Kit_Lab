import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createQuotaCounter,
  PackageRejectedError,
  pickEntryFile,
  prepareHtmlToolPackage,
  validateArchivePath,
} from "@/lib/html-tools";

describe("validateArchivePath", () => {
  it("拒绝绝对路径 / 盘符 / 反斜杠穿越", () => {
    expect(() => validateArchivePath("/etc/passwd")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("C:\\Windows\\x")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("..\\..\\evil")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("a/../../evil")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("a/./b")).toThrow(PackageRejectedError);
  });

  it("拒绝空字节与超长路径", () => {
    expect(() => validateArchivePath("a\0b")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("x".repeat(1025))).toThrow(PackageRejectedError);
  });

  it("拒绝 Windows 保留名与非法字符", () => {
    expect(() => validateArchivePath("con.txt")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("nul")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("lpt1")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("a:b")).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("a/b?" )).toThrow(PackageRejectedError);
    expect(() => validateArchivePath("trailing. ")).toThrow(PackageRejectedError);
  });

  it("接受正常相对路径并把反斜杠规范化为斜杠", () => {
    expect(validateArchivePath("index.html")).toBe("index.html");
    expect(validateArchivePath("assets/js/app.js")).toBe("assets/js/app.js");
    expect(validateArchivePath("assets\\style.css")).toBe("assets/style.css");
  });
});

describe("pickEntryFile", () => {
  it("优先选根目录 index.html", () => {
    expect(pickEntryFile(["index.html", "assets/app.js"])).toBe("index.html");
    expect(pickEntryFile(["INDEX.HTML", "a.js"])).toBe("INDEX.HTML");
  });

  it("唯一嵌套 index.html 或唯一 html 也可作为入口", () => {
    expect(pickEntryFile(["app/index.html"])).toBe("app/index.html");
    expect(pickEntryFile(["page.html"])).toBe("page.html");
  });

  it("多个嵌套 index.html 或无 html 时报错", () => {
    expect(() => pickEntryFile(["a/index.html", "b/index.html"])).toThrow(PackageRejectedError);
    expect(() => pickEntryFile(["a.js", "b.css"])).toThrow(PackageRejectedError);
    expect(() => pickEntryFile([])).toThrow(PackageRejectedError);
  });
});

/** 丢弃数据的可写流（避免测试写盘） */
function discardSink(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

describe("createQuotaCounter", () => {
  it("统计实际字节并放行未超限数据", async () => {
    const counter = createQuotaCounter(10);
    await pipeline(Readable.from([Buffer.from("abc"), Buffer.from("defg")]), counter, discardSink());
    expect(counter.count).toBe(7);
  });

  it("实际写入超过上限时报错并中断", async () => {
    const counter = createQuotaCounter(5);
    await expect(
      pipeline(Readable.from([Buffer.from("abcdef"), Buffer.from("ghij")]), counter, discardSink()),
    ).rejects.toThrow(PackageRejectedError);
    expect(counter.count).toBeGreaterThan(5);
  });
});

describe("prepareHtmlToolPackage", () => {
  it("单文件 html 复制为入口并记录大小", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kitlab-test-"));
    try {
      const packagePath = path.join(dir, "tool.html");
      await writeFile(packagePath, "<h1>hi</h1>", "utf8");
      const dest = path.join(dir, "out");
      const result = await prepareHtmlToolPackage(packagePath, "tool.html", dest, 10_000);
      expect(result.entryFile).toBe("index.html");
      expect(result.totalBytes).toBe(11);
      expect(await readFile(path.join(dest, "index.html"), "utf8")).toBe("<h1>hi</h1>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("超过剩余额度时抛 413", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kitlab-test-"));
    try {
      const packagePath = path.join(dir, "big.html");
      await writeFile(packagePath, "x".repeat(100), "utf8");
      await expect(
        prepareHtmlToolPackage(packagePath, "big.html", path.join(dir, "out"), 50),
      ).rejects.toMatchObject({ status: 413 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("拒绝不支持的扩展名", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kitlab-test-"));
    try {
      const packagePath = path.join(dir, "tool.txt");
      await writeFile(packagePath, "x", "utf8");
      await expect(
        prepareHtmlToolPackage(packagePath, "tool.txt", path.join(dir, "out"), 10_000),
      ).rejects.toThrow(PackageRejectedError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});