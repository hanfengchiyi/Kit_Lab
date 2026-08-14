import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF 防护：判断 IP 是否属于禁止访问的环回 / 私网 / 链路本地 / 云元数据网段。
 * 与 /api/html-tools/proxy 配合使用，防止代理被当成内网扫描器或云元数据读取器。
 */

/** IPv4 私有 / 保留网段（含 0.0.0.0/8 "本机"、云元数据 169.254.0.0/16 等） */
function isBlockedIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // 0.0.0.0/8 "本机"
    a === 10 || // 10.0.0.0/8 私网
    a === 127 || // 127.0.0.0/8 环回
    (a === 169 && b === 254) || // 169.254.0.0/16 链路本地 / 云元数据
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 私网
    (a === 192 && b === 168) // 192.168.0.0/16 私网
  );
}

/** 解析 IPv4-mapped IPv6 地址（::ffff:a.b.c.d）为 IPv4 段判断 */
function ipv4Mapped(ip: string): string | null {
  const prefix = "::ffff:";
  if (!ip.toLowerCase().startsWith(prefix)) return null;
  const mapped = ip.slice(prefix.length);
  return net.isIPv4(mapped) ? mapped : null;
}

/** IPv6 环回 / 链路本地 / ULA 私网段 */
function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true; // 未指定 / 环回
  if (normalized.startsWith("fe80:")) return true; // fe80::/10 链路本地
  // fc00::/7（ULA，含 fd00::/8 常见私网段）
  const head = normalized.split(":")[0] ?? "";
  if (/^f[cd][0-9a-f]{0,2}/.test(head)) return true;
  return false;
}

/** 判断 IP 是否命中禁访网段（IPv4 / IPv6 / IPv4-mapped） */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) {
    const mapped = ipv4Mapped(ip);
    if (mapped) return isBlockedIpv4(mapped);
    return isBlockedIpv6(ip);
  }
  return false;
}

/** 目标主机是否命中环回/私网/元数据等禁区（含 DNS 解析结果，挡住明显的外壳域名） */
export async function isBlockedHost(hostname: string): Promise<boolean> {
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

/** 是否允许代理访问私网目标（仅显式开启时放行） */
export function allowPrivateTargets(): boolean {
  return process.env.HTML_TOOL_PROXY_ALLOW_PRIVATE === "true";
}
