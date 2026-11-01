// 运行时绑定与环境变量类型定义。
// D1 / KV / ASSETS 通过 wrangler.toml 绑定；敏感项通过 wrangler secret 设置。
export interface Env {
  DB: D1Database
  KV: KVNamespace
  ASSETS: Fetcher

  // 非敏感变量（可在 wrangler.toml [vars] 中）
  ADMIN_USERNAME?: string
  ADMIN_EMAIL?: string // 兼容旧部署

  // 敏感信息（必须通过 wrangler secret put 设置，绝不写入前端/日志）
  ADMIN_INITIAL_PASSWORD: string
  SETUP_TOKEN: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
}

// Hono 应用上下文绑定
export type AppEnv = { Bindings: Env }
