import { describe, expect, it } from "vitest";
import { isBlockedIp } from "@/lib/ssrf";

describe("isBlockedIp — IPv4", () => {
  it("拦截环回与本机网段", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.255.255.254")).toBe(true);
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("0.1.2.3")).toBe(true);
  });

  it("拦截私网网段", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("10.255.255.255")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });

  it("拦截链路本地与云元数据", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("169.254.0.1")).toBe(true);
  });

  it("放行公网地址", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("172.15.0.1")).toBe(false);
    expect(isBlockedIp("172.32.0.1")).toBe(false);
    expect(isBlockedIp("192.169.0.1")).toBe(false);
    expect(isBlockedIp("169.253.0.1")).toBe(false);
  });
});

describe("isBlockedIp — IPv6", () => {
  it("拦截环回 / 未指定 / 链路本地 / ULA", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("::")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
    expect(isBlockedIp("fdff:ffff::1")).toBe(true);
  });

  it("放行公网 IPv6", () => {
    expect(isBlockedIp("2001:db8::1")).toBe(false);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIp("f000::1")).toBe(false);
  });

  it("IPv4-mapped 按 IPv4 规则判断", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(false);
  });
});