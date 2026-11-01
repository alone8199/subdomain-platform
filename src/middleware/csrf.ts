import type { Context, MiddlewareHandler, Next } from 'hono'
import type { AppEnv } from '../env'
import { fail } from '../utils/response'

// 防 CSRF：对所有状态变更请求（POST/PUT/PATCH/DELETE）校验
// Origin 或 Referer 的 host 必须等于当前请求 host（同源部署）。
// 登录与申请接口额外叠加 KV 限流。
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const csrfMiddleware: MiddlewareHandler<AppEnv> = async (
  c: Context,
  next: Next,
) => {
  if (!MUTATING.has(c.req.method)) {
    await next()
    return
  }
  const host = new URL(c.req.url).host
  const origin = c.req.header('Origin')
  const referer = c.req.header('Referer')

  const originOk = origin ? safeHost(origin) === host : false
  const refererOk = referer ? safeHost(referer) === host : false

  if (!originOk && !refererOk) {
    return fail(
      c,
      'CSRF',
      '请求来源不被信任（Origin/Referer 校验失败）',
      403,
    )
  }
  await next()
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}
