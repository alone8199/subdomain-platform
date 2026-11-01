# 二级域名分发平台（Cloudflare Workers）

一个可直接部署在 **Cloudflare Workers** 上的二级域名分发服务：管理员接入自己已托管在 Cloudflare 的多个根域名，用户注册/登录后申请子域名，系统通过 Cloudflare API 自动创建/更新/删除 DNS 记录，并支持到期回收。前端（React）与后端（Hono）部署在**同一个 Worker** 中，使用 D1 + KV + Static Assets + Cron Triggers，不依赖任何外部服务器或常驻进程。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 运行时 | Cloudflare Workers（TypeScript） |
| 后端框架 | Hono |
| 数据库 | Cloudflare D1（SQLite） |
| 缓存/限流 | Cloudflare KV |
| 前端 | React + Vite + TypeScript + Tailwind CSS |
| 静态资源 | Workers Static Assets（SPA fallback） |
| 定时任务 | Cron Triggers（每日清理过期子域名） |
| 校验 | Zod |
| 密码哈希 | Web Crypto PBKDF2（100k 迭代，SHA-256，每用户随机 salt） |

---

## 文件树

```
subdomain-platform/
├── package.json                  # 依赖与脚本（dev/build/deploy/db:migrate/kv:create/secret:set）
├── wrangler.toml                 # 部署配置：D1 / KV / Assets / Cron / 变量
├── tsconfig.json
├── vite.config.ts                # 前端构建（输出到 ./dist）
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── .dev.vars.example            # 本地开发环境变量样例
├── README.md
├── migrations/
│   └── 0001_init.sql            # D1 建表 + 索引（可重复执行）
├── src/                          # Worker 后端
│   ├── worker.ts                 # 入口：路由挂载、安全头、Cron、静态兜底
│   ├── env.ts                    # Env / AppEnv 类型
│   ├── types.ts                  # 领域类型
│   ├── db/index.ts               # D1 访问层
│   ├── cloudflare/client.ts      # Cloudflare API 封装（zone/dns 查询、增删改、脱敏）
│   ├── auth/
│   │   ├── password.ts           # PBKDF2 哈希与校验
│   │   └── session.ts            # 会话创建/校验/ Cookie（HttpOnly/Secure/SameSite=Lax）
│   ├── middleware/
│   │   ├── auth.ts               # 登录 + 管理员校验
│   │   ├── csrf.ts               # Origin/Referer 校验（防 CSRF）
│   │   └── ratelimit.ts          # 基于 KV 的登录/申请限流
│   ├── validators/schemas.ts     # 全部 Zod 校验
│   ├── utils/
│   │   ├── response.ts           # 统一 { ok, data, error }
│   │   ├── audit.ts              # 审计日志（含 root_domain / zone_id）
│   │   ├── error.ts              # ApiError
│   │   ├── id.ts                 # UUID / 时间戳
│   │   └── ip.ts                 # 客户端 IP 摘要
│   ├── services/subdomain.ts     # 申请/审批/删除/重试 核心逻辑（含冲突检测）
│   └── routes/
│       ├── health.ts
│       ├── auth.ts               # /setup /register /login /logout /me
│       ├── user.ts               # 用户中心
│       ├── admin.ts              # 管理员后台
│       └── cron.ts               # 过期清理
└── frontend/                      # React 前端（SPA）
    ├── index.html
    ├── vite-env.d.ts
    └── src/
        ├── main.tsx
        ├── App.tsx                # 路由与权限
    ├── index.css              # Tailwind + MD3 设计令牌（明/暗主题，暖色调 CSS 变量）
    ├── api.ts                 # 统一请求封装（401 跳登录）
    ├── types.ts
    ├── context.tsx            # Auth + Theme（明/暗切换，localStorage 持久化）+ Snackbar Provider
    ├── components/
    │   ├── ui.tsx             # MD3 组件库（Button/Badge/Dialog/Snackbar/Switch/Checkbox/Spinner/EmptyState 等）
    │   └── Layout.tsx         # MD3 导航栏 + 顶栏（响应式抽屉）+ 主题切换
        ├── pages/
        │   ├── Login.tsx
        │   ├── Setup.tsx
        │   ├── user/              # 概览 / 申请 / 我的子域名 / 账户设置
        │   └── admin/             # 仪表盘 / 根域名 / 子域名 / 用户 / 设置 / 审计
└── demo-server/                  # 纯前端 + Node 内存 Mock 的演示服务（无需 Cloudflare 即可预览 UI）
    ├── package.json            # type: module，start: node server.mjs
    └── server.mjs              # 内存数据、静态资源托管、SPA fallback，模拟自动通过/配额/限制等行为
```

---

## 从零部署步骤

> 以下命令统一使用 `npm`（也可替换为 `pnpm`，README 一律以 npm 为准）。需要 Node.js ≥ 18。

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 D1 数据库

```bash
npm run db:create
# 输出类似：
# ✅ Created D1 database 'subdomain_platform' with id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

把返回的 `database_id` 填入 `wrangler.toml` 中的 `database_id`（替换 `REPLACE_WITH_YOUR_D1_DATABASE_ID`）。

### 4. 创建 KV 命名空间（用于限流缓存）

```bash
npm run kv:create
# 输出类似：
# ✅ Created namespace RATE_LIMIT with id: yyyyyyyy-...
```

把返回的 `id` 填入 `wrangler.toml` 中 `[[kv_namespaces]]` 的 `id`（替换 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`）。

### 5. 执行数据库迁移（远程）

```bash
npm run db:migrate
# 等价于 wrangler d1 migrations apply subdomain_platform
```

> 本地开发调试可用 `npm run db:migrate:local`（写入本地 `.wrangler` 的本地 D1）。

### 6. 设置敏感 Secrets（**不要写进 wrangler.toml 或前端**）

```bash
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put SETUP_TOKEN
npx wrangler secret put ADMIN_INITIAL_PASSWORD
```

| Secret | 说明 |
| --- | --- |
| `CF_API_TOKEN` | Cloudflare API Token（最小权限见下） |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID |
| `SETUP_TOKEN` | 初始化管理员时校验的令牌，**防止被抢注** |
| `ADMIN_INITIAL_PASSWORD` | 管理员初始密码（≥8 位） |

非敏感变量 `ADMIN_USERNAME` 已写在 `wrangler.toml` 的 `[vars]` 中，可按需修改（需与初始化时使用的用户名一致）。

### 7. 构建前端并部署

```bash
npm run deploy
# 等价：vite build（输出到 ./dist） && wrangler deploy
```

部署完成后，Worker 同时提供 API（`/api/*`）与前端静态资源（其余路径 SPA fallback）。

### 8. 绑定自定义域名（可选）

在 Cloudflare 控制台 → Workers & Pages → 你的 Worker → Settings → Domains，添加自定义域名（例如 `panel.example.com`）。

### 9. 初始化管理员

浏览器访问 `https://<你的域名>/setup`，输入你在第 6 步设置的 `SETUP_TOKEN`，提交后系统会用 `ADMIN_USERNAME` 与 `ADMIN_INITIAL_PASSWORD` 创建管理员账号。之后访问 `/login` 用该用户名密码登录。

> 初始化逻辑：仅当 `users` 表为空、且 `setupToken` 与 `SETUP_TOKEN` 一致、且用户名与 `ADMIN_USERNAME` 一致时才创建，杜绝被他人抢注。

---

## Cloudflare API Token 权限

在 Cloudflare 控制台 → My Profile → API Tokens → Create Token，使用 **Custom token**，权限：

- `Zone` → `Zone:Read`
- `Zone` → `DNS:Edit`

**Zone Resources** 选择你打算接入的根域名所在的 Zone（或全部 Zone，若 Token 可管理多个 Zone）。

> **多 Zone / 多账户限制说明（如实告知）**
> - 同一 Cloudflare 账户下、使用**同一个 API Token** 即可管理多个 Zone（多个根域名）。添加根域名时系统会用该 Token 查询对应 Zone ID 并保存，每个根域名独立配置、独立状态，审批/DNS 操作均使用其自身的 `cloudflare_zone_id`，不会混用。
> - 若你的多个根域名分布在**不同 Cloudflare 账户**，单个 Token 无法跨账户访问。扩展方式有两种：
>   1. 为不同账户分别创建 Token，并在代码中改为“按根域名存储各自 Token”（当前版本把 Token 放在全局 Secret，默认假设单账户多 Zone；README 明确此边界，避免假装支持）。
>   2. 或把跨账户的根域名统一迁移到同一账户。

---

## 功能概览

- **人机验证**：可选接入 Cloudflare Turnstile（管理后台「系统设置」中开关并填入 Site Key / Secret Key），启用后登录、注册、申请子域名、添加解析记录均需通过验证
- **认证**：用户名+密码登录；会话持久化在 D1（便于查询与审计，且数据模型要求 `sessions` 表），Cookie 为 `HttpOnly; Secure; SameSite=Lax`，7 天过期；KV 用于登录与申请接口的限流缓存（满足“会话/限流缓存：KV”的强依赖要求，限流即用 KV；若后续需要把会话本身也移入 KV 可平滑扩展）；公开注册默认关闭，管理员可在后台开启或手动建用户；修改类接口校验 Origin/Referer 防 CSRF。
- **多根域名**：支持接入任意数量根域名，每个独立配置（启用/禁用、默认 TTL、允许记录类型、保留词、备注），唯一性约束，删除前校验无活跃子域名。
- **子域名申请（自动通过）**：选根域名 + 前缀 + 记录类型（CNAME/A/AAAA/TXT）+ 目标 + TTL + 可选到期；**提交即自动通过并立即创建 DNS 记录，无需管理员审批**（申请即开通）。前缀格式（仅字母数字与连字符、长度等）与保留词（`reserved_words`）在**前端实时拦截**，非标准前缀无法提交；D1 与 Cloudflare Zone 双重冲突检测；创建失败回滚为 `error` 并展示脱敏错误，可重试。已激活子域名即可直接用于解析，解析由 Cloudflare 边缘节点承载，**解析请求次数无平台限制**。创建出的 DNS 记录默认走灰云（直连），是否启用 Cloudflare 代理（橙色云）由用户在 Cloudflare 控制台自行设置，平台不控制该开关。
- **配额限制**：管理员后台「系统设置」可配置 `max_subdomains_per_user`（每用户拥有的子域名数量上限，默认 10）与 `max_applications_per_month`（每用户每月申请次数上限，默认 30）；超出时申请接口返回 `LIMIT_REACHED` / `MONTH_LIMIT`（HTTP 429）。用户中心「概览」以进度条展示已用/上限。
- **管理员后台**：仪表盘、根域名管理、全部子域名、用户管理（启用/禁用/重置密码/设管理员）、系统设置（公开注册开关 + 配额限制）、审计日志（按根域名/动作筛选）。
- **用户中心**：概览（含配额进度）、申请（实时校验、自动通过）、我的子域名（复制/删除/重试）、账户设置（改密码）。
- **界面（Material Design 3）**：前端基于 MD3 设计规范重写，提供**明/暗主题一键切换**并持久化到 `localStorage`，默认采用**暖色调**（陶土棕主色）；导航栏、顶栏、对话框、Snackbar、开关、芯片状态徽章等均为 MD3 组件。
- **到期回收**：每日 Cron 遍历过期子域名，按各自 Zone 删除 DNS 并记录审计。

---

## 常见错误排查

| 现象 | 可能原因 / 解决 |
| --- | --- |
| `/setup` 返回 `CF_ZONE_VERIFY_FAILED` 或 502 | Token 权限不足或根域名未托管到对应账户；确认 Token 有 `Zone:Read`/`DNS:Edit`，且域名 Status 为 active |
| 申请子域名提示 `DOMAIN_TAKEN_CF` | 该完整域名在 Cloudflare Zone 中已存在 DNS 记录（可能之前手动建过），先去 Cloudflare 删除冲突记录 |
| 审批/创建 DNS 返回 `CF_CREATE_FAILED` | 目标内容格式不符（如 A 记录填了域名），或 TTL 不在 60–86400；检查申请表单 |
| 登录后跳转异常 / 401 循环 | 确认部署后 Cookie 能写入（自定义域名需 HTTPS；`Secure` 属性要求 HTTPS） |
| 前端页面空白 / 资源 404 | 未执行 `vite build` 就 `wrangler deploy`；确认 `./dist` 已生成且 `wrangler.toml` 的 `assets.directory` 指向 `./dist` |
| `CF_ACCOUNT_ID` 为空 | 通过 `wrangler secret put CF_ACCOUNT_ID` 设置；根域名添加时会优先用 Zone 返回的 account.id |
| Cron 未生效 | 确认 `wrangler.toml` 中 `[[triggers]] crons = ["0 0 * * *"]` 已生效；可在控制台 → Worker → Settings → Triggers 查看 |

---

## 最小验收清单

1. **登录**：访问 `/setup` 用 `SETUP_TOKEN` 初始化管理员 → `/login` 用管理员用户名密码登录成功。
2. **添加根域名**：管理员后台「根域名管理」→ 添加 `example.com` → 系统校验 Token 权限并保存 Zone ID，列表显示启用/自动审批/统计。
3. **用户申请**：用普通用户（或开启公开注册后注册）在「申请子域名」选择根域名、填前缀 `foo`、类型 CNAME、目标 `target.example.net` 提交。
4. **自动通过**：提交申请后无需审批，状态直接为 `active`，并在 Cloudflare 对应 Zone 创建 DNS 记录。非标准前缀（如含下划线、命中保留词 `www` 等）在提交前被前端拦截。
5. **DNS 创建成功**：到 Cloudflare 控制台对应 Zone 的 DNS 页面，确认出现 `foo.example.com` 的 CNAME 记录（与 `dns_record_id` 对应）。
5b. **配额限制**：在「系统设置」把 `max_subdomains_per_user` 调小（如 1），用户再次申请时返回 `LIMIT_REACHED`（HTTP 429）；把 `max_applications_per_month` 调小后，跨月额度的申请也会被拦截。用户中心「概览」进度条同步展示用量。
6. **删除回收**：用户在「我的子域名」删除 → Cloudflare DNS 记录被移除；管理员「全部子域名」也可强制删除。
7. **Cron 过期清理**：给某子域名设置过去时间作为到期时间（或数据库内将 `expires_at` 改为过去时间戳），等待每日 Cron 或手动触发后，确认 DNS 记录被删除且审计日志有 `cron_expire` 记录。

---

## API 约定

- 基础路径：`/api/*`；统一响应 `{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。
- 主要端点：`/api/health`、`/api/auth/{setup,register,login,logout,me}`、`/api/user/*`、`/api/admin/*`。
- 密码、Token、Cookie 绝不出现在响应与日志中；Cloudflare 错误已脱敏。
- 同源部署，无需额外开放 CORS；修改类请求需同源 Origin/Referer（防 CSRF）。
