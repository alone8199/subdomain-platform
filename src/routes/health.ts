import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { ok } from '../utils/response'

// 健康检查
export const healthRoutes = new Hono<AppEnv>()

healthRoutes.get('/', async (c) => {
  // 可选：探测 D1 是否可用
  let dbOk = true
  try {
    await c.env.DB.prepare('SELECT 1').first()
  } catch {
    dbOk = false
  }
  return ok(c, {
    status: 'ok',
    time: new Date().toISOString(),
    db: dbOk,
  })
})
