import { prisma } from "@/lib/prisma";

/** 读系统设置：数据库优先，缺省回落到环境变量 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  if (row && row.value.trim() !== "") return row.value;
  const env = process.env[key];
  return env && env.trim() !== "" ? env.trim() : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
