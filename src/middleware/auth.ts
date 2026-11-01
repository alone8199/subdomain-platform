import type { Context, MiddlewareHandler, Next } from 'hono'
import type { AppEnv } from '../env'
import { fail } from '../utils/response'
import { resolveSession } from '../auth/session'
import type { SessionUser } from '../auth/session'

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser
  }
}

// 登录校验：必须携带有效会话
export const authMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next: Next,
) => {
  const user = await resolveSession(c.env, c)
  if (!user) {
    return fail(c, 'UNAUTHENTICATED', '未登录或会话已过期', 401)
  }
  c.set('user', user)
  await next()
}

// 管理员校验
export const adminMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next: Next,
) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return fail(c, 'FORBIDDEN', '需要管理员权限', 403)
  }
  await next()
}
