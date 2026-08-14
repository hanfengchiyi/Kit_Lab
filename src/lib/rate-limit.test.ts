import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  clearFailures,
  failureCount,
  recordFailure,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("窗口内放行前 limit 次，之后拒绝", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("k", 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("不同 key 互不影响", () => {
    checkRateLimit("a", 1, 60_000);
    expect(checkRateLimit("b", 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 60_000).allowed).toBe(false);
  });

  it("窗口过期后恢复放行", () => {
    vi.useFakeTimers();
    try {
      expect(checkRateLimit("k2", 1, 1000).allowed).toBe(true);
      expect(checkRateLimit("k2", 1, 1000).allowed).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(checkRateLimit("k2", 1, 1000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("recordFailure / clearFailures / failureCount", () => {
  it("失败计数递增并在窗口内保留", () => {
    expect(recordFailure("login:1.2.3.4", 60_000)).toBe(1);
    expect(recordFailure("login:1.2.3.4", 60_000)).toBe(2);
    expect(failureCount("login:1.2.3.4", 60_000)).toBe(2);
    clearFailures("login:1.2.3.4");
    expect(failureCount("login:1.2.3.4", 60_000)).toBe(0);
  });
});
