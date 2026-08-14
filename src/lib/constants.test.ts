import { describe, expect, it } from "vitest";
import { normalizeTags, parseTags, toToolDTO } from "@/lib/constants";

describe("parseTags", () => {
  it("兼容中英文逗号并去空", () => {
    expect(parseTags("json,格式化，工具 ,, ")).toEqual(["json", "格式化", "工具"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("normalizeTags", () => {
  it("规范化标签串", () => {
    expect(normalizeTags("json, 格式化 ，工具")).toBe("json,格式化,工具");
    expect(normalizeTags("  ")).toBe("");
  });
});

describe("toToolDTO", () => {
  it("映射数据库记录并收窄 source", () => {
    const dto = toToolDTO({
      id: "1",
      name: "n",
      url: "https://x",
      description: "d",
      category: "开发工具",
      tags: "a，b",
      source: "third-party",
      icon: null,
    });
    expect(dto).toMatchObject({
      id: "1",
      tags: ["a", "b"],
      source: "third-party",
      icon: null,
    });
  });

  it("未知 source 一律归为 third-party", () => {
    const dto = toToolDTO({
      id: "2",
      name: "n",
      url: "u",
      description: "d",
      category: "c",
      tags: "",
      source: "weird",
      icon: null,
    });
    expect(dto.source).toBe("third-party");
  });
});
