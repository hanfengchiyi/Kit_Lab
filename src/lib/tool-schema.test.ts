import { describe, expect, it } from "vitest";
import { toolCoreSchema, toolSchema, uploadMetadataSchema } from "@/lib/tool-schema";

describe("toolCoreSchema", () => {
  it("接受合法输入并应用默认值", () => {
    const result = toolCoreSchema.safeParse({
      name: "工具",
      description: "描述",
      category: "开发工具",
      tags: "a,b",
      icon: "",
      order: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe(3);
      expect(result.data.icon).toBe("");
    }
  });

  it("拒绝超长图标与越界排序", () => {
    expect(toolCoreSchema.safeParse({ name: "n", description: "d", category: "c", icon: "x".repeat(65) }).success).toBe(false);
    expect(toolCoreSchema.safeParse({ name: "n", description: "d", category: "c", order: 10000 }).success).toBe(false);
    expect(toolCoreSchema.safeParse({ name: "n", description: "d", category: "c", order: -10000 }).success).toBe(false);
  });
});

describe("toolSchema", () => {
  it("拒绝非法 source 与 visibility", () => {
    expect(toolSchema.safeParse({ name: "n", description: "d", category: "c", url: "https://x", source: "bad", visibility: "public" }).success).toBe(false);
    expect(toolSchema.safeParse({ name: "n", description: "d", category: "c", url: "https://x", source: "self", visibility: "secret" }).success).toBe(false);
  });

  it("与上传元数据共享核心规则", () => {
    expect(uploadMetadataSchema.safeParse({ name: "n", description: "d", category: "c" }).success).toBe(true);
  });
});
