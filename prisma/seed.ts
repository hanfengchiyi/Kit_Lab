import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@kitlab.local").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin12345";
const USER_EMAIL = (process.env.USER_EMAIL || "user@kitlab.local").toLowerCase();
const USER_PASSWORD = process.env.USER_PASSWORD || "User12345";

const tools = [
  // 开发工具
  { name: "JSON 格式化工具", url: "https://lab.example.com/json-format", description: "在线格式化、校验与压缩 JSON 数据", category: "开发工具", tags: "json,格式化,在线", source: "self", icon: "🧾", order: 1 },
  { name: "RegExr", url: "https://regexr.com/", description: "正则表达式在线学习与测试工具", category: "开发工具", tags: "正则,regex,测试", source: "third-party", icon: "🔍", order: 2 },
  { name: "Can I Use", url: "https://caniuse.com/", description: "查询 Web 特性的浏览器兼容性", category: "开发工具", tags: "浏览器,兼容性,前端", source: "third-party", icon: "🌐", order: 3 },
  // 文本处理
  { name: "Diffchecker", url: "https://www.diffchecker.com/", description: "在线对比两段文本或文件的差异", category: "文本处理", tags: "对比,diff,文本", source: "third-party", icon: "🔀", order: 1 },
  { name: "字数统计", url: "https://lab.example.com/word-count", description: "统计文本字数、词数与阅读时长", category: "文本处理", tags: "字数,统计,写作", source: "self", icon: "🔢", order: 2 },
  // 图片处理
  { name: "TinyPNG", url: "https://tinypng.com/", description: "智能压缩 PNG / JPEG 图片体积", category: "图片处理", tags: "压缩,png,图片", source: "third-party", icon: "🐼", order: 1 },
  { name: "Squoosh", url: "https://squoosh.app/", description: "在浏览器本地压缩并转换图片格式", category: "图片处理", tags: "压缩,webp,图片", source: "third-party", icon: "🗜️", order: 2 },
  { name: "图片裁剪工具", url: "https://lab.example.com/crop", description: "在线裁剪、缩放图片并导出", category: "图片处理", tags: "裁剪,图片,缩放", source: "self", icon: "✂️", order: 3 },
  // 效率办公
  { name: "Excalidraw", url: "https://excalidraw.com/", description: "手绘风格的在线白板与流程图工具", category: "效率办公", tags: "白板,手绘,协作", source: "third-party", icon: "🎨", order: 1 },
  { name: "番茄钟", url: "https://lab.example.com/pomodoro", description: "专注计时与休息提醒的番茄工作法工具", category: "效率办公", tags: "专注,计时,番茄钟", source: "self", icon: "🍅", order: 2 },
  // 设计资源
  { name: "Heroicons", url: "https://heroicons.com/", description: "Tailwind 团队出品的免费 SVG 图标库", category: "设计资源", tags: "图标,svg,免费", source: "third-party", icon: "⭐", order: 1 },
  { name: "Coolors", url: "https://coolors.co/", description: "快速生成与探索配色方案", category: "设计资源", tags: "配色,调色板,设计", source: "third-party", icon: "🌈", order: 2 },
  // 其他
  { name: "IT Tools", url: "https://it-tools.tech/", description: "面向开发者的在线小工具合集", category: "其他", tags: "开发,合集,工具箱", source: "third-party", icon: "🧰", order: 1 },
] as const;

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "admin" },
    create: {
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PASSWORD, 10),
      name: "站长",
      role: "admin",
    },
  });
  console.log(`管理员账号：${admin.email}`);

  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {},
    create: {
      email: USER_EMAIL,
      password: await bcrypt.hash(USER_PASSWORD, 10),
      name: "示例用户",
      role: "user",
    },
  });
  console.log(`普通用户账号：${user.email}`);

  // 重建示例公共工具，保证 seed 可重复执行
  await prisma.favorite.deleteMany();
  await prisma.tool.deleteMany({ where: { visibility: "public" } });
  await prisma.tool.createMany({
    data: tools.map((tool) => ({ ...tool, visibility: "public" as const })),
  });
  console.log(`已写入 ${tools.length} 条公共工具`);

  // 给普通用户加一条示例收藏，便于演示「我的收藏」
  const tinypng = await prisma.tool.findFirst({ where: { name: "TinyPNG" } });
  if (tinypng) {
    await prisma.favorite.create({
      data: { userId: user.id, toolId: tinypng.id },
    });
    console.log(`已为 ${user.email} 添加示例收藏：${tinypng.name}`);
  }

  // 默认用户守则与欢迎公告（upsert 保证可重跑）
  const ruleContent = [
    "1. 仅收录合法合规的工具与网站，不得添加违法、侵权或恶意内容。",
    "2. 上传的 HTML 工具不得包含窃取信息、挖矿或其他恶意脚本。",
    "3. 不要在工具名称、描述或 HTML 包中放入密码、密钥等敏感资料。",
    "4. 推送公开的工具需经过管理员审核，请保证描述真实准确。",
    "5. 违反守则的账号可能被限制分类权限或移除。",
  ].join(String.fromCharCode(10));
  const welcomeContent = [
    "这里是个人工具库小屋：浏览公共工具、收藏心头好、上传自己的 HTML 小工具。",
    "注册采用邀请制，需要邀请码请联系管理员。",
  ].join(String.fromCharCode(10));
  const defaults = [
    { title: "Kit Lab 用户守则", kind: "rule", order: 1, content: ruleContent },
    { title: "欢迎来到 Kit Lab", kind: "announcement", order: 1, content: welcomeContent },
  ];
  for (const item of defaults) {
    const existing = await prisma.announcement.findFirst({ where: { title: item.title } });
    if (existing) {
      await prisma.announcement.update({ where: { id: existing.id }, data: item });
    } else {
      await prisma.announcement.create({ data: { ...item, published: true } });
    }
  }
  console.log("已写入默认公告与用户守则");

  // 两个初始邀请码（注册必须凭邀请码；已在库中存在则跳过）
  for (const code of ["WELCOME2026", "KITLAB8888"]) {
    const existing = await prisma.invitation.findUnique({ where: { code } });
    if (!existing) {
      await prisma.invitation.create({ data: { code, note: "seed 初始邀请码" } });
    }
  }
  console.log("已确保初始邀请码存在：WELCOME2026 / KITLAB8888");
}

main()
  .catch((error) => {
    console.error("Seed 执行失败：", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
