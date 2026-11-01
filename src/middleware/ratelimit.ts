import type { Context, MiddlewareHandler, Next } from 'hono'
import type { AppEnv } from '../env'
import { fail } from '../utils/response'
import { clientIp } from '../utils/ip'

interface Window {
  count: number
  reset: number // 毫秒时间戳
}

// KV 限流：基于客户端 IP + 动作维度，固定窗口计数。
export async function rateLimit(
  c: Context<AppEnv>,
  action: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const ip = clientIp(c)
  const key = `ratelimit:${action}:${ip}`
  const now = Date.now()
  const raw = await c.env.KV.get(key, 'json')
  const w: Window | null = (raw as Window) ?? null

  if (!w || w.reset < now) {
    const next: Window = { count: 1, reset: now + windowSec * 1000 }
    await c.env.KV.put(key, JSON.stringify(next), {
      // KV 要求 expirationTtl ≥ 60
      expirationTtl: Math.max(60, windowSec + 5),
    })
    return true
  }
  if (w.count >= limit) {
    return false
  }
  const next: Window = { count: w.count + 1, reset: w.reset }
  await c.env.KV.put(key, JSON.stringify(next), {
    // KV 要求 expirationTtl ≥ 60（剩余窗口不足 60 时必须兜底，否则 PUT 报 400）
    expirationTtl: Math.max(60, Math.ceil((w.reset - now) / 1000) + 5),
  })
  return true
}

// 登录限流：每分钟最多 10 次
export const loginRateLimit: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const ok = await rateLimit(c, 'login', 10, 60)
  if (!ok) {
    return fail(c, 'RATE_LIMITED', '登录尝试过于频繁，请稍后再试', 429)
  }
  await next()
}

// 申请限流：每分钟最多 5 次
export const applyRateLimit: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const ok = await rateLimit(c, 'apply', 5, 60)
  if (!ok) {
    return fail(c, 'RATE_LIMITED', '申请过于频繁，请稍后再试', 429)
  }
  await next()
}
