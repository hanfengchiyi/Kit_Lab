/**
 * 轻量内存滑动窗口限流器（单进程部署适用）。
 * PM2 多实例部署时每个进程独立计数，如需严格全局限流应换共享存储（如 Redis）。
 */

interface WindowState {
  timestamps: number[];
}

const WINDOWS = new Map<string, WindowState>();
let lastSweep = Date.now();

/** 每 5 分钟清理一次过期窗口，防止内存无限增长 */
function sweepIfNeeded(now: number): void {
  if (now - lastSweep < 5 * 60 * 1000) return;
  lastSweep = now;
  for (const [key, state] of WINDOWS) {
    if (state.timestamps.length === 0) {
      WINDOWS.delete(key);
    }
  }
}

export interface RateLimitResult {
  /** 是否允许本次请求 */
  allowed: boolean;
  /** 被限流时建议的等待秒数 */
  retryAfterSec?: number;
}

/**
 * 滑动窗口限流：windowMs 内最多允许 limit 次。
 * @param key 限流键，如 `proxy:${ip}`
 * @param limit 窗口内最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepIfNeeded(now);
  const state = WINDOWS.get(key) ?? { timestamps: [] };
  const cutoff = now - windowMs;
  const alive = state.timestamps.filter((t) => t > cutoff);
  if (alive.length >= limit) {
    const oldest = alive[0] ?? now;
    state.timestamps = alive;
    WINDOWS.set(key, state);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  alive.push(now);
  state.timestamps = alive;
  WINDOWS.set(key, state);
  return { allowed: true };
}

/** 记录一次失败（如登录失败），返回当前失败次数 */
export function recordFailure(key: string, windowMs: number): number {
  const now = Date.now();
  sweepIfNeeded(now);
  const state = WINDOWS.get(key) ?? { timestamps: [] };
  const alive = state.timestamps.filter((t) => t > now - windowMs);
  alive.push(now);
  state.timestamps = alive;
  WINDOWS.set(key, state);
  return alive.length;
}

/** 清除失败记录（如登录成功后） */
export function clearFailures(key: string): void {
  WINDOWS.delete(key);
}

/** 查询当前失败次数 */
export function failureCount(key: string, windowMs: number): number {
  const state = WINDOWS.get(key);
  if (!state) return 0;
  const cutoff = Date.now() - windowMs;
  return state.timestamps.filter((t) => t > cutoff).length;
}

/** 从请求头提取客户端 IP（信任 x-forwarded-for 第一跳；Nginx 反代场景由 Nginx 覆盖该头） */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
