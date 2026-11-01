import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { ok, fail } from '../utils/response'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { csrfMiddleware } from '../middleware/csrf'
import {
  zoneCreateSchema,
  zoneUpdateSchema,
  rejectSchema,
  userCreateSchema,
  userUpdateSchema,
  resetPasswordSchema,
  settingsUpdateSchema,
  subdomainEditSchema,
} from '../validators/schemas'
import { db, getZoneByRootDomain, getZoneById, getUserByEmail } from '../db'
import { makeCf, CloudflareError } from '../cloudflare/client'
import { ApiError } from '../utils/error'
import {
  approveSubdomain,
  rejectSubdomain,
  deleteSubdomain,
  retrySubdomain,
  editSubdomain,
} from '../services/subdomain'
import {
  generateSalt,
  hashPassword,
} from '../auth/password'
import { audit } from '../utils/audit'
import { newId, nowSec } from '../utils/id'
import { clientIp } from '../utils/ip'
import type { ZoneRow } from '../types'

export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('*', authMiddleware, adminMiddleware)

// -------------------- 仪表盘统计 --------------------
adminRoutes.get('/stats', async (c) => {
  const users = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM users',
  )
  const zones = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM zones',
  )
  const active = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE status = ?',
    'active',
  )
  const pending = await db(c.env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE status = ?',
    'pending',
  )
  // 每个根域名的子域名数量
  const perZone = await db(c.env).all<{
    zone_id: string
    root_domain: string
    total: number
    active: number
    pending: number
  }>(
    `SELECT zone_id, root_domain,
        COUNT(*) AS total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
     FROM subdomains GROUP BY zone_id, root_domain`,
  )
  return ok(c, {
    users: users?.n ?? 0,
    zones: zones?.n ?? 0,
    active: active?.n ?? 0,
    pending: pending?.n ?? 0,
    per_zone: perZone,
  })
})

// -------------------- 根域名管理 --------------------
adminRoutes.get('/zones', async (c) => {
  const zones = await db(c.env).all<ZoneRow>(
    'SELECT * FROM zones ORDER BY created_at DESC',
  )
  // 统计每个 zone 的子域名数
  const stats = await db(c.env).all<{
    zone_id: string
    total: number
    active: number
    pending: number
  }>(
    `SELECT zone_id,
        COUNT(*) AS total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
     FROM subdomains GROUP BY zone_id`,
  )
  const statMap = new Map(stats.map((s) => [s.zone_id, s]))
  const data = zones.map((z) => {
    const s = statMap.get(z.id)
    return {
      ...z,
      summary: {
        total: s?.total ?? 0,
        active: s?.active ?? 0,
        pending: s?.pending ?? 0,
      },
    }
  })
  return ok(c, data)
})

adminRoutes.post('/zones', csrfMiddleware, async (c) => {
  const parsed = zoneCreateSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const { root_domain } = parsed.data
  const exist = await getZoneByRootDomain(db(c.env), root_domain)
  if (exist) {
    return fail(c, 'ZONE_EXISTS', '该根域名已存在', 409)
  }
  // 通过 Cloudflare API 校验权限并获取 Zone ID
  const cf = makeCf(c.env)
  let zone
  try {
    zone = await cf.getZoneByName(root_domain)
  } catch (e) {
    const msg = e instanceof CloudflareError ? e.message : 'Cloudflare 校验失败'
    await audit(c.env, {
      action: 'zone_change',
      actorId: c.get('user').id,
      actorEmail: c.get('user').email,
      target: root_domain,
      result: 'failure',
      detail: msg,
      c,
    })
    return fail(c, 'CF_ZONE_VERIFY_FAILED', msg, 502)
  }
  const now = nowSec()
  const id = newId()
  await db(c.env).run(
    `INSERT INTO zones
      (id, root_domain, cloudflare_zone_id, cloudflare_account_id, enabled, auto_approve, default_ttl, allowed_types, reserved_words, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    root_domain,
    zone.id,
    (zone as any).account?.id ?? c.env.CF_ACCOUNT_ID,
    parsed.data.enabled ? 1 : 0,
    parsed.data.auto_approve ? 1 : 0,
    parsed.data.default_ttl,
    parsed.data.allowed_types,
    parsed.data.reserved_words,
    parsed.data.note,
    now,
    now,
  )
  await audit(c.env, {
    action: 'zone_change',
    actorId: c.get('user').id,
    actorEmail: c.get('user').email,
    target: root_domain,
    rootDomain: root_domain,
    zoneId: zone.id,
    result: 'success',
    detail: '添加根域名',
    c,
  })
  return ok(c, { id, cloudflare_zone_id: zone.id }, 201)
})

adminRoutes.get('/zones/:id', async (c) => {
  const z = await getZoneById(db(c.env), c.req.param('id'))
  if (!z) return fail(c, 'NOT_FOUND', '根域名不存在', 404)
  return ok(c, z)
})

adminRoutes.put('/zones/:id', csrfMiddleware, async (c) => {
  const z = await getZoneById(db(c.env), c.req.param('id'))
  if (!z) return fail(c, 'NOT_FOUND', '根域名不存在', 404)
  const parsed = zoneUpdateSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const d = parsed.data
  const fields: string[] = []
  const params: any[] = []
  if (d.enabled !== undefined) { fields.push('enabled = ?'); params.push(d.enabled ? 1 : 0) }
  if (d.auto_approve !== undefined) { fields.push('auto_approve = ?'); params.push(d.auto_approve ? 1 : 0) }
  if (d.default_ttl !== undefined) { fields.push('default_ttl = ?'); params.push(d.default_ttl) }
  if (d.allowed_types !== undefined) { fields.push('allowed_types = ?'); params.push(d.allowed_types) }
  if (d.reserved_words !== undefined) { fields.push('reserved_words = ?'); params.push(d.reserved_words) }
  if (d.note !== undefined) { fields.push('note = ?'); params.push(d.note) }
  if (fields.length === 0) return ok(c, z)
  fields.push('updated_at = ?')
  params.push(nowSec())
  params.push(z.id)
  await db(c.env).run(
    `UPDATE zones SET ${fields.join(', ')} WHERE id = ?`,
    ...params,
  )
  await audit(c.env, {
    action: 'zone_change',
    actorId: c.get('user').id,
    actorEmail: c.get('user').email,
    target: z.root_domain,
    rootDomain: z.root_domain,
    zoneId: z.cloudflare_zone_id,
    result: 'success',
    detail: '更新根域名配置',
    c,
  })
  return ok(c, { updated: true })
})

adminRoutes.delete('/zones/:id', csrfMiddleware, async (c) => {
  const z = await getZoneById(db(c.env), c.req.param('id'))
  if (!z) return fail(c, 'NOT_FOUND', '根域名不存在', 404)
  // 存在活跃/待处理/删除中/错误（孤儿）子域名则阻止删除
  const blocking = await db(c.env).get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM subdomains WHERE zone_id = ? AND status IN ('pending','active','deleting','error')`,
    z.id,
  )
  if ((blocking?.n ?? 0) > 0) {
    return fail(
      c,
      'ZONE_IN_USE',
      `该根域名下仍有 ${blocking!.n} 个活跃/待处理子域名，无法删除`,
      409,
    )
  }
  await db(c.env).run('DELETE FROM zones WHERE id = ?', z.id)
  await audit(c.env, {
    action: 'zone_change',
    actorId: c.get('user').id,
    actorEmail: c.get('user').email,
    target: z.root_domain,
    rootDomain: z.root_domain,
    zoneId: z.cloudflare_zone_id,
    result: 'success',
    detail: '删除根域名',
    c,
  })
  return ok(c, { deleted: true })
})

// 重新校验根域名（确认 Token 仍具备权限）
adminRoutes.post('/zones/:id/verify', csrfMiddleware, async (c) => {
  const z = await getZoneById(db(c.env), c.req.param('id'))
  if (!z) return fail(c, 'NOT_FOUND', '根域名不存在', 404)
  const cf = makeCf(c.env)
  try {
    const zone = await cf.getZoneByName(z.root_domain)
    const match = zone.id === z.cloudflare_zone_id
    return ok(c, { ok: true, match, cloudflare_zone_id: zone.id })
  } catch (e) {
    const msg = e instanceof CloudflareError ? e.message : '校验失败'
    return fail(c, 'CF_VERIFY_FAILED', msg, 502)
  }
})

// -------------------- 申请审批 --------------------
adminRoutes.get('/approvals', async (c) => {
  const zoneId = c.req.query('zone_id')
  const sql =
    'SELECT * FROM subdomains WHERE status = ?' +
    (zoneId ? ' AND zone_id = ?' : '') +
    ' ORDER BY created_at ASC'
  const rows = await db(c.env).all<any>(
    sql,
    ...(zoneId ? ['pending', zoneId] : ['pending']),
  )
  return ok(c, rows)
})

adminRoutes.post('/approvals/:id/approve', csrfMiddleware, async (c) => {
  try {
    const sub = await approveSubdomain(c.env, c, c.req.param('id'))
    return ok(c, { id: sub.id, status: sub.status })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

adminRoutes.post('/approvals/:id/reject', csrfMiddleware, async (c) => {
  const parsed = rejectSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  try {
    await rejectSubdomain(c.env, c, c.req.param('id'), parsed.data.reason)
    return ok(c, { rejected: true })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

adminRoutes.post('/approvals/bulk-approve', csrfMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const ids = (body as any).ids as string[] | undefined
  if (!Array.isArray(ids) || ids.length === 0) {
    return fail(c, 'INVALID_INPUT', '请提供要审批的 id 列表', 422)
  }
  const results: { id: string; ok: boolean; message?: string }[] = []
  for (const id of ids) {
    try {
      await approveSubdomain(c.env, c, id)
      results.push({ id, ok: true })
    } catch (e) {
      results.push({
        id,
        ok: false,
        message: e instanceof ApiError ? e.message : '失败',
      })
    }
  }
  return ok(c, { results })
})

// -------------------- 全部子域名管理 --------------------
adminRoutes.get('/subdomains', async (c) => {
  const zoneId = c.req.query('zone_id')
  const status = c.req.query('status')
  const conds = []
  const params: any[] = []
  if (zoneId) { conds.push('zone_id = ?'); params.push(zoneId) }
  if (status) { conds.push('status = ?'); params.push(status) }
  const sql =
    'SELECT * FROM subdomains' +
    (conds.length ? ' WHERE ' + conds.join(' AND ') : '') +
    ' ORDER BY created_at DESC'
  const rows = await db(c.env).all<any>(sql, ...params)
  return ok(c, rows)
})

adminRoutes.put('/subdomains/:id', csrfMiddleware, async (c) => {
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
    const updated = await editSubdomain(c.env, c, c.req.param('id'), parsed.data)
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

adminRoutes.post('/subdomains/:id/delete', csrfMiddleware, async (c) => {
  try {
    await deleteSubdomain(c.env, c, c.req.param('id'))
    return ok(c, { deleted: true })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

adminRoutes.post('/subdomains/:id/retry', csrfMiddleware, async (c) => {
  try {
    const sub = await retrySubdomain(c.env, c, c.req.param('id'))
    return ok(c, { status: sub.status, error_message: sub.error_message })
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'INTERNAL', '服务器错误', 500)
  }
})

// -------------------- 用户管理 --------------------
adminRoutes.get('/users', async (c) => {
  const rows = await db(c.env).all<any>(
    'SELECT id, email, role, status, created_at, updated_at FROM users ORDER BY created_at DESC',
  )
  return ok(c, rows)
})

adminRoutes.post('/users', csrfMiddleware, async (c) => {
  const parsed = userCreateSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const { email, password, role } = parsed.data
  const exist = await getUserByEmail(db(c.env), email)
  if (exist) return fail(c, 'EMAIL_TAKEN', '该邮箱已注册', 409)
  const salt = generateSalt()
  const hash = await hashPassword(password, salt)
  const now = nowSec()
  const id = newId()
  await db(c.env).run(
    `INSERT INTO users (id, email, password_hash, salt, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    id,
    email,
    hash,
    salt,
    role,
    now,
    now,
  )
  await audit(c.env, {
    action: 'user_change',
    actorId: c.get('user').id,
    actorEmail: c.get('user').email,
    target: email,
    result: 'success',
    detail: `创建用户 role=${role}`,
    c,
  })
  return ok(c, { id }, 201)
})

adminRoutes.patch('/users/:id', csrfMiddleware, async (c) => {
  const parsed = userUpdateSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const target = await db(c.env).get<any>(
    'SELECT * FROM users WHERE id = ?',
    c.req.param('id'),
  )
  if (!target) return fail(c, 'NOT_FOUND', '用户不存在', 404)
  const me = c.get('user')
  // 防止管理员禁用/降级自己
  if (target.id === me.id && (parsed.data.status === 'disabled' || parsed.data.role === 'user')) {
    return fail(c, 'SELF_MODIFY', '不能对自己执行该操作', 409)
  }
  const d = parsed.data
  const fields: string[] = []
  const params: any[] = []
  if (d.status !== undefined) { fields.push('status = ?'); params.push(d.status) }
  if (d.role !== undefined) { fields.push('role = ?'); params.push(d.role) }
  if (fields.length === 0) return ok(c, { updated: false })
  fields.push('updated_at = ?'); params.push(nowSec()); params.push(target.id)
  await db(c.env).run(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    ...params,
  )
  await audit(c.env, {
    action: 'user_change',
    actorId: me.id,
    actorEmail: me.email,
    target: target.email,
    result: 'success',
    detail: `更新 status=${d.status ?? ''} role=${d.role ?? ''}`,
    c,
  })
  return ok(c, { updated: true })
})

adminRoutes.post('/users/:id/reset-password', csrfMiddleware, async (c) => {
  const parsed = resetPasswordSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const target = await db(c.env).get<any>(
    'SELECT * FROM users WHERE id = ?',
    c.req.param('id'),
  )
  if (!target) return fail(c, 'NOT_FOUND', '用户不存在', 404)
  const salt = generateSalt()
  const hash = await hashPassword(parsed.data.password, salt)
  await db(c.env).run(
    'UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    nowSec(),
    target.id,
  )
  await audit(c.env, {
    action: 'user_change',
    actorId: c.get('user').id,
    actorEmail: c.get('user').email,
    target: target.email,
    result: 'success',
    detail: '重置密码',
    c,
  })
  return ok(c, { reset: true })
})

// 设为/取消管理员（谨慎）
adminRoutes.post('/users/:id/toggle-admin', csrfMiddleware, async (c) => {
  const target = await db(c.env).get<any>(
    'SELECT * FROM users WHERE id = ?',
    c.req.param('id'),
  )
  if (!target) return fail(c, 'NOT_FOUND', '用户不存在', 404)
  const me = c.get('user')
  if (target.id === me.id) {
    return fail(c, 'SELF_MODIFY', '不能修改自己的角色', 409)
  }
  const newRole = target.role === 'admin' ? 'user' : 'admin'
  await db(c.env).run(
    'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
    newRole,
    nowSec(),
    target.id,
  )
  await audit(c.env, {
    action: 'user_change',
    actorId: me.id,
    actorEmail: me.email,
    target: target.email,
    result: 'success',
    detail: `设置角色为 ${newRole}`,
    c,
  })
  return ok(c, { role: newRole })
})

// -------------------- 系统设置 --------------------
adminRoutes.get('/settings', async (c) => {
  const keys = [
    ['registration_enabled', '0'],
    ['max_subdomains_per_user', '10'],
    ['max_applications_per_month', '30'],
  ] as const
  const out: Record<string, string | number | boolean> = {}
  for (const [key, def] of keys) {
    const row = await db(c.env).get<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      key,
    )
    out[key] = row?.value ?? def
  }
  out.registration_enabled = out.registration_enabled === '1'
  out.max_subdomains_per_user = Number(out.max_subdomains_per_user)
  out.max_applications_per_month = Number(out.max_applications_per_month)
  return ok(c, out)
})

adminRoutes.put('/settings', csrfMiddleware, async (c) => {
  const parsed = settingsUpdateSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const actor = c.get('user')
  const updates: [string, string, string][] = []
  if (parsed.data.registration_enabled !== undefined) {
    updates.push([
      'registration_enabled',
      parsed.data.registration_enabled ? '1' : '0',
      `公开注册=${parsed.data.registration_enabled}`,
    ])
  }
  if (parsed.data.max_subdomains_per_user !== undefined) {
    updates.push([
      'max_subdomains_per_user',
      String(parsed.data.max_subdomains_per_user),
      `每用户子域名上限=${parsed.data.max_subdomains_per_user}`,
    ])
  }
  if (parsed.data.max_applications_per_month !== undefined) {
    updates.push([
      'max_applications_per_month',
      String(parsed.data.max_applications_per_month),
      `每月申请上限=${parsed.data.max_applications_per_month}`,
    ])
  }
  for (const [key, value, detail] of updates) {
    await db(c.env).run(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?',
      key,
      value,
      nowSec(),
      value,
      nowSec(),
    )
    await audit(c.env, {
      action: 'user_change',
      actorId: actor.id,
      actorEmail: actor.email,
      target: 'settings',
      result: 'success',
      detail,
      c,
    })
  }
  return ok(c, { updated: true })
})

// -------------------- 审计日志 --------------------
adminRoutes.get('/audit', async (c) => {
  const action = c.req.query('action')
  const zoneId = c.req.query('zone_id')
  const conds = []
  const params: any[] = []
  if (action) { conds.push('action = ?'); params.push(action) }
  if (zoneId) { conds.push('zone_id = ?'); params.push(zoneId) }
  const sql =
    'SELECT * FROM audit_logs' +
    (conds.length ? ' WHERE ' + conds.join(' AND ') : '') +
    ' ORDER BY created_at DESC LIMIT 200'
  const rows = await db(c.env).all<any>(sql, ...params)
  return ok(c, rows)
})
