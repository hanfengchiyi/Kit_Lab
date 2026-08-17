# Kit Lab — 个人工具库网站

## 1. 项目简介

Kit Lab 是一个个人工具库网站，把分散在各处的工具链接集中到一个站点统一管理：

- **自研工具入口**：既可收录部署在别处的链接，也可直接上传单文件 HTML 或带资源的 ZIP；
- **第三方工具导航**：平时收藏的好用外部工具 / 网站链接。

站点**公开可浏览**；同时提供注册登录，登录后可以收藏工具、添加自己的私有工具。

> **当前状态**：第一期（核心功能）已完成并可用，见[第 9 节路线图](#9-路线图)。

### 目标

- 访客打开页面就能按分类 / 标签浏览公共工具库；
- 注册登录后：收藏公共工具、维护自己的私有工具条目，并在本地保存 HTML 工具（每人 1 GB）；
- 管理员（站长）通过界面维护公共条目，不需要改代码重新部署；
- 部署在自己的服务器上，数据完全自主可控。

### 非目标

- 不做社交功能（评论、分享、关注等）；
- 不做面向公众的大型导航站，注册功能面向熟人和自用扩展，不追求用户规模；
- 不做原生 App，移动端用响应式网页覆盖。

## 2. 功能特性

### 第一期（核心功能，✅ 已完成）

**公共工具库（访客可用）**

- 工具条目以卡片形式展示：名称、描述、图标、链接；
- 按**分类 + 标签**分组浏览；
- 卡片上区分「自研」与「第三方」标识；
- 响应式布局，手机与桌面均可正常使用。

**用户体系**

- 邮箱 + 密码注册、登录、退出；
- 密码哈希存储（bcrypt），会话由 Auth.js 管理。

**登录后的扩展能力**

- 收藏公共工具，在「我的收藏」中查看；
- 添加 / 编辑 / 删除自己的私有工具（其他访客和用户不可见）。
- 上传 `.html` / `.htm`，或带 CSS、JS、图片等资源的 `.zip`；上传后可直接打开使用；
- 编辑 HTML 工具时可直接**替换内容**更新功能：访问地址与令牌保持不变，旧文件额度自动归还、按新文件大小差额结算；
- 每位用户拥有 1 GB 独立额度，按 ZIP 解压后的实际文件总量计算，删除后自动归还；
- 上传文件流式落盘，ZIP 会拦截目录穿越、软链接、超额解压及异常文件数量。

**管理后台（仅管理员）**

- 公共工具条目的增删改。

### 第二期新增（✅ 已完成）

- **公告与用户守则**：`/announcements` 公开页；管理员在 `/admin/announcements` 维护，支持公告 / 守则两种类型、排序与发布开关；
- **邀请制注册**：注册必须填写有效邀请码（一码一人）；管理员在 `/admin/invitations` 生成与作废；
- **个人工具推送公开**：用户在「我的工具」点「申请公开」进入审批队列，管理员在 `/admin/publish` 通过 / 拒绝（可附备注），也可直接把任意用户工具推送为公开或下架回私有；
- **公开工具版本更新**：公开的 HTML 工具属主仍可替换内容——新内容立即成为自己的草稿（自己打开即见最新版，公开访客仍用已审批版本）；属主可「申请更新公开版本」进入审批队列，管理员通过后草稿晋升为公开版（链接与令牌不变），拒绝则草稿保留、可修改后重新申请；下架时草稿自动合并为私有内容；
- **分组管理**：管理员在 `/admin/categories` 新建分组，并可为每个分组设置「默认全员可用」或「需单独授权」；分类清单改为数据库驱动，全站表单与侧边栏实时生效；
- **分类授权**：用户可用分组 = 默认全员授权分组 ∪ 管理员在 `/admin/grants` 为个人勾选的分组；受限用户首页仅显示被授权分类，HTML 工具内容地址同样拦截；
- **自动生成图标**：创建工具且未手动填图标时，调用 `ICON_GEN_*` 环境变量配置的图像 API 生成图标，存至 `data/generated-icons/` 并经 `/api/icons/<file>` 提供；生成失败不影响建单。

### 后续期次

实时搜索、深色模式、最近使用、第三方登录等，见[第 9 节路线图](#9-路线图)。

## 3. 技术选型

**已确认：方案 C —— Next.js（App Router）+ TypeScript。** 理由：站点需要注册登录与服务端能力，
完整框架一步到位，避免先静态后重写的迁移成本。

三方案对比存档：

| 维度 | 方案 A：纯静态 HTML/CSS/JS | 方案 B：Astro | ✅ 方案 C：Next.js / Nuxt |
| --- | --- | --- | --- |
| 构建步骤 | 无 | 需要（Node.js） | 需要（Node.js） |
| 用户登录 / 服务端能力 | 不支持 | 需额外接服务 | 原生支持 |
| 数据管理 | JSON 文件 | Content Collections | 数据库 |
| 扩展性 | 一般 | 好 | 强 |
| 学习与维护成本 | 极低 | 低 | 中 |
| 适用场景 | 内容少、页面简单 | 内容驱动、无动态需求 | 需要登录和动态功能（本项目） |

配套技术选型：

| 关注点 | 选择 | 实际版本 | 说明 |
| --- | --- | --- | --- |
| 框架 | Next.js（App Router）+ TypeScript | Next.js 15.5 / TS 5.9 | React 生态，认证与部署方案最成熟 |
| 数据库 | SQLite + Prisma ORM | Prisma 6.19 | 单文件、零运维，备份就是拷文件；Prisma 支持日后平滑切换 PostgreSQL / MySQL |
| 认证 | Auth.js（NextAuth v5）Credentials Provider | next-auth 5.0.0-beta | 邮箱 + 密码，bcryptjs 哈希（纯 JS 实现，无原生编译依赖）；日后可扩展 GitHub / Google OAuth |
| 样式 | Tailwind CSS | v4（PostCSS 插件方式） | 按需引入，暂无额外组件库 |
| 校验 | Zod | v4 | 注册与工具表单的服务端入参校验 |
| 部署 | PM2 + Nginx 反向代理 | — | 见第 7 节 |

数据变更以 **Server Actions** 为主（登录、收藏、工具增删改）；注册与流式 HTML 上传走 Route Handler；
受保护页面（`/favorites`、`/my`、`/admin`）由 `src/middleware.ts` 统一做登录重定向，写操作在服务端二次校验权限。

## 4. 数据结构设计

数据库共三张核心表（以 `prisma/schema.prisma` 为准）：

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String     // bcrypt 哈希
  name      String?
  role      String     @default("user") // "admin" | "user"
  htmlStorageUsedBytes Int @default(0)
  tools     Tool[]
  favorites Favorite[]
  createdAt DateTime   @default(now())
}

model Tool {
  id          String     @id @default(cuid())
  name        String
  url         String
  description String
  category    String
  tags        String     // 逗号分隔，如 "json,格式化"
  source      String     // "self" | "third-party"
  icon        String?
  order       Int        @default(0)
  visibility  String     @default("public") // "public" | "private"
  ownerId     String?    // 私有条目的属主；null 表示管理员维护的公共条目
  owner       User?      @relation(fields: [ownerId], references: [id])
  favoritedBy Favorite[]
  addedAt     DateTime   @default(now())
  kind            String  @default("link") // "link" | "html"
  htmlEntry       String?
  htmlBytes       Int     @default(0)
  htmlAccessToken String? @unique
}

model Favorite {
  userId    String
  toolId    String
  user      User     @relation(fields: [userId], references: [id])
  tool      Tool     @relation(fields: [toolId], references: [id])
  createdAt DateTime @default(now())

  @@id([userId, toolId])
}
```

Tool 字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 工具名称 |
| `url` | string | 是 | 工具链接 |
| `description` | string | 是 | 一句话描述 |
| `category` | string | 是 | 所属分类，取值见下方分类清单 |
| `tags` | string | 否 | 逗号分隔的标签，用于分组筛选 |
| `source` | `"self"` / `"third-party"` | 是 | 自研 / 第三方 |
| `icon` | string | 否 | 图标（emoji 或 `public/icons/` 下的文件名），缺省用默认图标 |
| `order` | number | 否 | 同分类内排序，越小越靠前 |
| `visibility` | `"public"` / `"private"` | 是 | 公共条目全站可见，私有条目仅属主可见 |
| `ownerId` | string | 私有必填 | 私有条目属主；公共条目为空 |
| `addedAt` | datetime | 自动 | 收录时间 |
| `kind` | `"link"` / `"html"` | 自动 | 外部链接或本地 HTML 工具 |
| `htmlEntry` | string | HTML 必填 | ZIP 内入口文件相对路径 |
| `htmlBytes` | number | 自动 | 本地实际保存的文件总大小 |
| `htmlAccessToken` | string | HTML 必填 | 256 位随机内容访问令牌，不使用可枚举 ID 暴露文件 |

分类清单（示例，可按需调整，保持用词一致）：开发工具、文本处理、图片处理、效率办公、设计资源、其他。

访问规则：

- 访客与所有登录用户都能看到全部 `public` 条目；
- `private` 条目只对 `ownerId` 对应的用户可见；
- 只有 `role = "admin"` 的用户能创建 / 修改 `public` 条目。
- HTML 工具元数据仍为私有；内容地址使用不可猜测令牌。拿到完整内容地址的人可以访问该工具，因此不要在 HTML 包中放入密钥或敏感资料。

## 5. 项目结构

```
Kit_Lab/
├── README.md
├── package.json              # 含 prisma seed 配置（prisma db seed → tsx prisma/seed.ts）
├── .env.example              # 环境变量样例（真实 .env 不进仓库）
├── next.config.ts / tsconfig.json / postcss.config.mjs / eslint.config.mjs
├── prisma/
│   ├── schema.prisma         # 数据模型（User / Tool / Favorite）
│   ├── migrations/           # 数据库迁移
│   └── seed.ts               # 初始账号 + 示例公共工具
├── deploy/
│   └── nginx.conf            # Nginx 反向代理样例
├── data/user-html-tools/     # 默认上传目录（运行时生成，不进 Git）
└── src/
    ├── auth.ts               # Auth.js 主配置（Credentials authorize，bcrypt 校验）
    ├── auth.config.ts        # 页面/JWT/会话回调与路由授权规则
    ├── middleware.ts         # 保护 /favorites、/my、/admin，未登录重定向
    ├── app/                  # App Router 页面与 API
    │   ├── page.tsx          # 首页：公共工具库（分类分组 + 标签筛选）
    │   ├── login/ register/  # 登录页 / 注册页
    │   ├── favorites/        # 我的收藏（需登录）
    │   ├── my/               # 我的私有工具（含链接、HTML 上传、编辑）
    │   ├── admin/            # 公共条目管理（仅管理员，含 new、[id]/edit）
    │   └── api/              # auth、register、HTML 流式上传与内容读取
    ├── components/           # Navbar、ToolBrowser、ToolCard、ToolForm、FavoriteButton 等
    └── lib/                  # Prisma client 单例、常量（分类清单）、Server Actions
```

## 6. 开发指南

环境要求：Node.js LTS（≥ 20）。

```bash
npm install                  # 安装依赖（postinstall 自动执行 prisma generate）
cp .env.example .env         # 生成 AUTH_SECRET，其余默认值即可本地运行
npx prisma migrate dev       # 初始化本地数据库（首次会顺带执行 seed）
npm run dev                  # http://localhost:3000
```

本地调试上传的 HTML 工具时，建议主站用 `http://localhost:3000`，并在 `.env` 设置
`HTML_TOOL_PUBLIC_ORIGIN="http://127.0.0.1:3000"`；修改后需重启 Next.js。两个地址指向
同一个服务，但浏览器将它们视为不同来源，可避免用户脚本接触主站登录态，同时保留
`localStorage` 和正常网络请求能力。若改用其他端口，两处端口需保持一致。

其他常用命令：`npm run lint`（ESLint）、`npm run build && npm run start`（生产构建与启动）、
`npx prisma db seed`（重复执行 seed，按邮箱 upsert，可安全重跑）、`npx prisma studio`（可视化查看数据）。

Seed 会自动创建两个账号（可用 `.env` 中的 `ADMIN_*` / `USER_*` 变量覆盖）：

- 管理员 `admin@kitlab.local` / `Admin12345`：登录后导航栏出现「管理后台」，可维护公共条目；
- 普通用户 `user@kitlab.local` / `User12345`：用于体验收藏与私有工具。

也可以正常注册新账号后，在数据库中把该用户的 `role` 手动改为 `admin`。

## 7. 部署指南（自己的服务器）

### 7.1 服务器环境

- Node.js LTS + PM2（`npm i -g pm2`）；
- Nginx 做反向代理；
- SQLite 数据库文件放在代码目录之外（如 `/var/lib/kit-lab/prod.db`），通过 `DATABASE_URL` 指向；
- 创建 HTML 持久化目录（如 `/var/lib/kit-lab/html-tools`），确保运行 PM2 的用户可写，并设置 `HTML_TOOL_STORAGE_DIR`；
- 为用户内容准备独立域名（如 `tools.example.com`），设置 `HTML_TOOL_PUBLIC_ORIGIN`。未配置时系统会启用同源安全沙箱，`localStorage` 等能力会受限。

### 7.2 发布流程

```bash
git pull                   # 或 rsync 代码到服务器
npm ci
npx prisma migrate deploy  # 应用数据库迁移
npm run build
pm2 restart kit-lab        # 首次部署：pm2 start npm --name kit-lab -- start
```

### 7.3 Nginx 反向代理

`deploy/nginx.conf` 保存完整样例。主站的上传路径需允许 1 GB 请求并关闭代理缓冲：

```nginx
server {
    listen 80;
    server_name kit.example.com;

    location = /api/html-tools/upload {
        client_max_body_size 1g;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

样例还包含 `tools.example.com` 独立内容站点，只代理 `/api/html-tools/content/`，并主动移除 Cookie。
修改两个 `server_name` 为实际域名后，放入 `sites-available` 并软链到 `sites-enabled`，
`sudo nginx -t` 检查通过后 `sudo systemctl reload nginx`。

### 7.4 HTTPS

使用 Let's Encrypt 免费证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kit.example.com -d tools.example.com
```

certbot 会自动修改 Nginx 配置并配置证书自动续期。

### 7.5 数据备份

备份必须同时包含 SQLite 与 HTML 工具目录：

```bash
cp /var/lib/kit-lab/prod.db /var/backups/kit-lab/prod-$(date +%F).db
tar -czf /var/backups/kit-lab/html-tools-$(date +%F).tar.gz -C /var/lib/kit-lab html-tools
```

建议用 cron 每日执行，并只保留最近 7 份。

## 8. 内容维护指南

不再需要改文件发版，一切通过界面完成：

- **公共条目**：管理员登录后进入 `/admin` 增删改；
- **收藏**：登录用户在卡片上点收藏，到 `/favorites` 查看；
- **私有工具**：登录用户在 `/my` 管理自己的条目；
- **HTML 工具**：在 `/my` 查看用量并上传；删除条目会同步删除本地文件并归还额度；需要更新功能时在编辑页直接替换 HTML/ZIP（访问地址不变、立即生效），额度按新旧文件差额结算；
- **公开 HTML 工具的更新**：属主在 `/my` 的「已公开的工具」进入「更新内容」替换 HTML/ZIP——新内容成为自己的草稿，公开访客仍用已审批版本；点「申请更新公开版本」后管理员在 `/admin/publish` 审批，通过即全员更新，拒绝可修改后重新申请；
- `category` 保持用词一致，新增分类前先确认现有清单里没有合适的；
- 第三方链接定期人工检查是否失效（路线图中有死链检查一项）。

## 9. 路线图

- **第一期（✅ 已完成）**：公共工具分类 / 标签展示、注册登录、收藏、私有工具、HTML 上传与 1 GB 配额、管理后台；
- **第二期**：实时搜索过滤（✅ 首页已完成）、深色模式、最近使用记录；
- **第三期**：第三方登录（GitHub / Google OAuth）、死链检查脚本、数据导入导出；
- **远期（可选）**：数据量或用户量增长后迁移 PostgreSQL；PWA 支持。

## 10. 约定与规范

- 全栈使用 TypeScript；提交信息使用 Conventional Commits（`feat:` / `fix:` / `chore:` 等）；
- `main` 分支保持随时可发布，功能开发在 `feat/*` 分支进行；
- 文件名统一小写连字符（kebab-case），代码符号遵循 Next.js 社区惯例；
- `.env` 与数据库文件不进仓库，密钥只放在服务器上。

## 11. 许可证

待定。自用项目可选择不公开仓库；若开源，建议使用 MIT。
