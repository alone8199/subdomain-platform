# Cloudflare 部署指南

本平台是一个 Cloudflare Workers 项目（Hono + D1 + KV + Static Assets + Cron），全部跑在 Cloudflare 边缘，不需要额外服务器。从零到上线约 10 分钟。

## 0. 前置准备

| 需要 | 说明 |
|---|---|
| Cloudflare 账号 | 免费版即可（Workers 免费额度：10 万请求/天） |
| Node.js | ≥ 18，本机安装 |
| 待分发的根域名 | 必须已接入（托管）在你的 Cloudflare 账号下，即 NS 已指向 Cloudflare |

## 1. 获取代码并安装依赖

```bash
git clone https://github.com/alone8199/subdomain-platform.git
cd subdomain-platform
npm install
```

## 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会弹出授权页面，确认即可。验证登录状态：

```bash
npx wrangler whoami
```

## 3. 创建 D1 数据库和 KV 命名空间

```bash
# 创建 D1（记下输出的 database_id）
npm run db:create

# 创建 KV（记下输出的 id）
npm run kv:create
```

把两个 ID 填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "subdomain_platform"
database_id = "填入刚才的 database_id"     # ← 替换

[[kv_namespaces]]
binding = "KV"
id = "填入刚才的 KV id"                    # ← 替换
```

## 4. 初始化数据库表结构

```bash
npm run db:migrate
```

会依次执行 `migrations/` 下的迁移（建表 + 后续变更），首次部署会全部执行。

## 5. 设置密钥（Secrets）

```bash
npm run secret:set
```

逐项粘贴以下值（都存在 Cloudflare，不进代码库）：

| Secret | 说明 |
|---|---|
| `CF_API_TOKEN` | Cloudflare API Token，用于创建/删除 DNS 记录。到 [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) 创建，权限选 **Zone → DNS → Edit** + **Zone → Zone → Read**，作用范围选你的账号（所有 Zone） |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID（Dashboard 右侧栏「Account ID」） |
| `SETUP_TOKEN` | 自定义一串随机字符串，首次初始化管理员时用 |
| `ADMIN_INITIAL_PASSWORD` | 管理员初始密码 |

另外在 `wrangler.toml` 的 `[vars]` 里把 `ADMIN_EMAIL` 改成你的管理员邮箱。

## 6. 一键部署

```bash
npm run deploy
```

该命令会先构建前端（Vite），再把 Worker + 静态资源 + Cron 一起部署。完成后终端会输出访问地址：

```
https://subdomain-platform.<你的子域>.workers.dev
```

## 7. 初始化管理员

浏览器打开部署地址，会自动跳到 `/setup` 页面：

1. 粘贴 `SETUP_TOKEN`
2. 提交后，系统用 `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD` 创建管理员
3. 用该邮箱和密码登录，进入后台

> 初始化成功后 setup 接口自动失效，无法重复创建。

## 8. 接入根域名

登录管理员后台 →「根域名」→「添加根域名」：

1. 输入一个已托管在你 Cloudflare 账号下的根域名（如 `example.com`）
2. 系统自动通过 API 校验并保存 Zone ID
3. 编辑该域名可设置：默认 TTL、允许记录类型（CNAME/A/AAAA/TXT）、保留词（如 `www,mail,ftp`）

用户端即可开始申请子域名，**申请即自动开通**（自动创建 DNS 记录并激活）。

## 9.（可选）绑定自定义域名

Workers 默认的 `*.workers.dev` 在部分地区访问不稳定，建议绑自己的域名：

```bash
npx wrangler deploy
# 或直接在 Dashboard：Workers & Pages → subdomain-platform → Settings → Domains & Routes → Add → Custom domain
```

例如绑 `panel.example.com`，之后通过它访问管理面板。

## 10. Cron 定时任务

`wrangler.toml` 已配置每日 UTC 0 点（北京时间 8 点）执行过期子域名清理，部署时自动生效，无需额外操作。可在 Dashboard → Workers → subdomain-platform → Settings → Cron Triggers 查看执行记录。

## 常用运维命令

```bash
npm run dev              # 本地开发（本地 D1/KV 模拟）
npm run db:migrate:local # 本地库迁移
npm run deploy           # 构建并部署（日常更新用这个）
npx wrangler tail        # 实时查看线上日志，排错必备
npx wrangler d1 execute subdomain_platform --remote --command "SELECT COUNT(*) FROM subdomains"  # 线上查询
```

## 常见问题

**部署时报 `database_id` 无效**：确认第 3 步创建 D1 成功且 ID 完整粘贴（不要带引号外多余空格）。

**申请子域名报 DNS 创建失败**：`CF_API_TOKEN` 权限不足。确认 Token 同时有 Zone:Read 和 DNS:Edit，且 Zone 资源范围覆盖该根域名。

**前端页面白屏 / 404**：确认部署用的是 `npm run deploy`（会先构建前端），`dist/` 已生成且 `[assets]` 指向 `./dist`。

**想改配额**：管理员后台 →「系统设置」可随时调整每用户子域名数量上限与每月申请次数上限。
