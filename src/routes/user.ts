import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { ok, fail } from '../utils/response'
import { authMiddleware } from '../middleware/auth'
import { csrfMiddleware } from '../middleware/csrf'
import { applyRateLimit } from '../middleware/ratelimit'
import { subdomainApplySchema, subdomainEditSchema, recordCreateSchema, recordEditSchema } from '../validators/schemas'
import { db } from '../db'
import { ApiError } from '../utils/error'
import {
  applySubdomain,
  deleteSubdomain,
  retrySubdomain,
  editSubdomain,
} from '../services/subdomain'
import {
  listRecords,
  addRecord,
  editRecord,
  deleteRecord,
} from '../services/dnsrecord'
import { verifyPassword, generateSalt, hashPassword } from '../auth/password'
import { audit } from '../utils/audit'
import { clientIp } from '../utils/ip'
import { requireTurnstile } from '../services/turnstile'
import { getUserById } from '../db'

export const userRoutes = new Hono<AppEnv>()

userRoutes.use('*', authMiddleware)

// 可申请的启用的根域名列表
userRoutes.get('/zones', async (c) => {
  const zones = await db(c.env).all<{
    id: string
    root_domain: string
    allowed_types: string
    default_ttl: number
    auto_approve: number
    reserved_words: string
  }>(
    'SELECT id, root_domain, allowed_types, default_ttl, auto_approve, reserved_words FROM zones WHERE enabled = 1 ORDER BY root_domain',
  )
  return ok(c, zones)
})

// 申请子域名
userRoutes.post(
  '/subdomains',
  applyRateLimit,
  csrfMiddleware,
  async (c) => {
    const user = c.get('user')
    const body = await c.req.json().catch(() => ({}))
    const parsed = subdomainApplySchema.safeParse(body)
    if (!parsed.success) {
      return fail(
        c,
        'INVALID_INPUT',
        parsed.error.issues[0]?.message ?? '参数错误',
        422,
      )
    }
    try {
      await requireTurnstile(c.env, body?.cf_turnstile_token, clientIp(c))
    } catch (e) {
      if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
      return fail(c, 'TURNSTILE_FAILED', '人机验证未通过', 422)
    }
    try {
      const sub = await applySubdomain(c.env, c, user.id, parsed.data)
      return ok(
        c,
        {
          id: sub.id,
          full_domain: sub.full_domain,
          status: sub.status,
          error_message: sub.error_message,
        },
        201,
      )
    } catch (e) {
      if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
      return fail(c, 'INTERNAL', '服务器错误', 500)
    }
  },
)

// 我的子域名列表（可按 zone 筛选）
userRoutes.get('/subdomains', async (c) => {
  const user = c.get('user')
  const zoneId = c.req.query('zone_id')
  const sql =
    'SELECT * FROM subdomains WHERE user_id = ?' +
    (zoneId ? ' AND zone_id = ?' : '') +
    ' ORDER BY created_at DESC'
  const rows = await db(c.env).all<any>(
    sql,
    ...(zoneId ? [user.id, zoneId] : [user.id]),
  )
  return ok(c, rows)
})

// 子域名详情（归属校验）
userRoutes.get('/subdomains/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const sub = await db(c.env).get<any>(
    'SELECT * FROM subdomains WHERE id = ? AND user_id = ?',
    id,
    user.id,
  )
  if (!sub) return fail(c, 'NOT_FOUND', '子域名不存在', 404)
  return ok(c, sub)
})

// 编辑子域名（仅本人、仅 active）
userRoutes.put('/subdomains/:id', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const owned = await db(c.env).get<any>(
    'SELECT id FROM subdomains WHERE id = ? AND user_id = ?',
    id,
    user.id,
  )
  if (!owned) return fail(c, 'NOT_FOUND', '子域名不存在', 404)
  const parsed = subdomainEditSchema.safeParse(
    await c.req.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return fail(
      c,
      'INVALID_INPUT',
      parsed.error.issues[0]?.message ?? '参数错误',
      422,
    )
  }
  try {
    const updated = await editSubdomain(c.env, c, id, parsed.data)
    return ok(c, {
      id: updated.id,
      status: updated.status,
      error_message: updated.error_message,
    })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// 申请删除（仅本人）
userRoutes.post('/subdomains/:id/delete', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const sub = await db(c.env).get<any>(
    'SELECT * FROM subdomains WHERE id = ? AND user_id = ?',
    id,
    user.id,
  )
  if (!sub) return fail(c, 'NOT_FOUND', '子域名不存在', 404)
  try {
    await deleteSubdomain(c.env, c, id)
    return ok(c, { deleted: true })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// 错误状态重试同步（仅本人）
userRoutes.post('/subdomains/:id/retry', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const sub = await db(c.env).get<any>(
    'SELECT * FROM subdomains WHERE id = ? AND user_id = ?',
    id,
    user.id,
  )
  if (!sub) return fail(c, 'NOT_FOUND', '子域名不存在', 404)
  try {
    const updated = await retrySubdomain(c.env, c, id)
    return ok(c, { status: updated.status, error_message: updated.error_message })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// -------------------- 解析记录管理（对已申请的子域名独立配置解析） --------------------

// 记录列表
userRoutes.get('/subdomains/:id/records', async (c) => {
  const user = c.get('user')
  try {
    const rows = await listRecords(c.env, user.id, c.req.param('id'))
    return ok(c, rows)
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// 添加解析记录：name 留空 = 根解析（test.neob.asia 本身）；name 填 www = www.test.neob.asia
userRoutes.post('/subdomains/:id/records', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const parsed = recordCreateSchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  try {
    await requireTurnstile(c.env, body?.cf_turnstile_token, clientIp(c))
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'TURNSTILE_FAILED', '人机验证未通过', 422)
  }
  try {
    const rec = await addRecord(c.env, c, user.id, c.req.param('id'), parsed.data)
    return ok(c, rec, 201)
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// 编辑解析记录（内容 / TTL）
userRoutes.put('/subdomains/:id/records/:rid', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const parsed = recordEditSchema.safeParse(
    await c.req.json().catch(() => ({})),
  )
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  try {
    const rec = await editRecord(
      c.env,
      c,
      user.id,
      c.req.param('id'),
      c.req.param('rid'),
      parsed.data,
    )
    return ok(c, rec)
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// 删除解析记录
userRoutes.post('/subdomains/:id/records/:rid/delete', csrfMiddleware, async (c) => {
  const user = c.get('user')
  try {
    await deleteRecord(c.env, c, user.id, c.req.param('id'), c.req.param('rid'))
    return ok(c, { deleted: true })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})


// 用户中心统计（含平台限制额度）
userRoutes.get('/stats', async (c) => {
  const user = c.get('user')
  const total = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ?',
    user.id,
  )
  const active = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ? AND status = ?',
    user.id,
    'active',
  )
  const pending = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ? AND status = ?',
    user.id,
    'pending',
  )
  const maxSub = Number(
    (await db(c.env).get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'max_subdomains_per_user'))?.value ?? 10,
  )
  const maxMonth = Number(
    (await db(c.env).get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'max_applications_per_month'))?.value ?? 30,
  )
  const d = new Date()
  const monthStart = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000)
  const monthUsed = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ? AND created_at >= ?',
    user.id,
    monthStart,
  )
  return ok(c, {
    total: total?.n ?? 0,
    active: active?.n ?? 0,
    pending: pending?.n ?? 0,
    limit: maxSub,
    monthly_limit: maxMonth,
    monthly_used: monthUsed?.n ?? 0,
  })
})

// 修改密码
userRoutes.post('/settings/password', csrfMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { old_password, new_password } = body as {
    old_password?: string
    new_password?: string
  }
  if (!old_password || !new_password) {
    return fail(c, 'INVALID_INPUT', '请填写原密码与新密码', 422)
  }
  if (new_password.length < 8) {
    return fail(c, 'INVALID_INPUT', '新密码至少 8 位', 422)
  }
  const u = await getUserById(db(c.env), user.id)
  if (!u) return fail(c, 'NOT_FOUND', '用户不存在', 404)
  const valid = await verifyPassword(old_password, u.salt, u.password_hash)
  if (!valid) return fail(c, 'INVALID_CREDENTIALS', '原密码错误', 401)
  const salt = generateSalt()
  const hash = await hashPassword(new_password, salt)
  await db(c.env).run(
    'UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    Math.floor(Date.now() / 1000),
    user.id,
  )
  await audit(c.env, {
    action: 'user_change',
    actorId: user.id,
    actorName: user.username,
    target: user.username,
    result: 'success',
    detail: '修改密码',
    c,
  })
  return ok(c, { changed: true })
})
