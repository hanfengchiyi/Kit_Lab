import { PrismaClient } from "@prisma/client";

// 防止开发环境热更新时创建多个 PrismaClient 实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// SQLite 并发调优：WAL 模式允许读写并行（上传/删除时不阻塞首页读），
// busy_timeout 让并发写短时等待而不是立刻报 SQLITE_BUSY。
void prisma
  .$queryRawUnsafe("PRAGMA journal_mode=WAL")
  .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000"))
  .catch(() => {
    // PRAGMA 失败不影响功能，仅在数据库不支持时静默降级
  });
