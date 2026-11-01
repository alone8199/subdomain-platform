import { Hono } from 'hono'
import type { AppEnv, Env } from './env'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/user'
import { adminRoutes } from './routes/admin'
import { csrfMiddleware } from './middleware/csrf'
import { fail } from './utils/response'
import { runExpiredCleanup } from './routes/cron'

const app = new Hono<AppEnv>()

// 基本安全响应头
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'same-origin')
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'",
  )
})

// 所有 /api 修改类请求统一 CSRF 校验（路由内也单独加了，这里兜底覆盖）
app.use('/api/*', csrfMiddleware)

// -------------------- API 路由 --------------------
app.route('/api/health', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/user', userRoutes)
app.route('/api/admin', adminRoutes)

// 健康检查也可通过根路径探测
app.get('/', (c) => c.redirect('/login'))

// 未匹配路由：API 返回 404 JSON，其余交给静态资源（SPA fallback）
app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return fail(c, 'NOT_FOUND', '接口不存在', 404)
  }
  // 静态资源 / SPA 回退
  return c.env.ASSETS.fetch(c.req.raw)
})

// 全局异常处理
app.onError((err, c) => {
  // 不向客户端暴露内部细节
  console.error('[error]', err?.message)
  return fail(c, 'INTERNAL', '服务器内部错误', 500)
})

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(req, env, ctx),
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ) => {
    const result = await runExpiredCleanup(env)
    console.log('[cron] expired cleanup', JSON.stringify(result))
  },
}
