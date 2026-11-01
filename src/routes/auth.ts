import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { ok, fail } from '../utils/response'
import { csrfMiddleware } from '../middleware/csrf'
import { loginRateLimit } from '../middleware/ratelimit'
import {
  setupSchema,
  registerSchema,
  loginSchema,
} from '../validators/schemas'
import { db, getUserByName, toPublicUser } from '../db'
import { generateSalt, hashPassword, verifyPassword } from '../auth/password'
import {
  createSession,
  destroySession,
} from '../auth/session'
import { getCookie } from 'hono/cookie'
import { audit } from '../utils/audit'
import { newId, nowSec } from '../utils/id'
import { clientIp } from '../utils/ip'
import { requireTurnstile, getTurnstileConfig } from '../services/turnstile'
import { ApiError } from '../utils/error'

export const authRoutes = new Hono<AppEnv>()

// 初始化管理员：需携带正确的 SETUP_TOKEN，且用户名与 ADMIN_USERNAME 一致。
// 管理员用户名与密码取自环境变量，避免被外部抢注。
authRoutes.post('/setup', csrfMiddleware, async (c) => {
  const parsed = setupSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  const { setupToken } = parsed.data

  if (setupToken !== c.env.SETUP_TOKEN) {
    return fail(c, 'FORBIDDEN', 'SETUP_TOKEN 不正确', 403)
  }

  const adminName = (c.env.ADMIN_USERNAME || c.env.ADMIN_EMAIL || '').toLowerCase()
  if (!adminName) {
    return fail(c, 'CONFIG_ERROR', '未配置 ADMIN_USERNAME', 500)
  }

  const exists = await getUserByName(db(c.env), adminName)
  if (exists) {
    return fail(c, 'ALREADY_INITIALIZED', '管理员已初始化', 409)
  }

  const initialPassword = c.env.ADMIN_INITIAL_PASSWORD
  if (!initialPassword || initialPassword.length < 8) {
    return fail(c, 'CONFIG_ERROR', 'ADMIN_INITIAL_PASSWORD 未配置或长度不足 8 位', 500)
  }

  const salt = generateSalt()
  const hash = await hashPassword(initialPassword, salt)
  const now = nowSec()
  await db(c.env).run(
    `INSERT INTO users (id, username, password_hash, salt, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)`,
    newId(),
    adminName,
    hash,
    salt,
    now,
    now,
  )
  await audit(c.env, {
    action: 'setup',
    target: adminName,
    result: 'success',
    detail: '初始化管理员账号',
    c,
  })
  return ok(c, { initialized: true }, 201)
})

// Turnstile 公开配置（前端据此渲染人机验证组件）
authRoutes.get('/turnstile', async (c) => {
  const cfg = await getTurnstileConfig(c.env)
  return ok(c, { enabled: cfg.enabled, site_key: cfg.enabled ? cfg.siteKey : '' })
})

// 公开注册（受系统设置开关控制）。管理员也可在后台直接创建用户。
authRoutes.post('/register', csrfMiddleware, async (c) => {
  const reg = await db(c.env).get<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    'registration_enabled',
  )
  if (!reg || reg.value !== '1') {
    return fail(c, 'REGISTRATION_CLOSED', '公开注册已关闭', 403)
  }
  const body = await c.req.json().catch(() => ({}))
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  try {
    await requireTurnstile(c.env, body?.cf_turnstile_token, clientIp(c))
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'TURNSTILE_FAILED', '人机验证未通过', 422)
  }
  const { username, password } = parsed.data
  const exists = await getUserByName(db(c.env), username)
  if (exists) {
    return fail(c, 'USERNAME_TAKEN', '该用户名已注册', 409)
  }
  const salt = generateSalt()
  const hash = await hashPassword(password, salt)
  const now = nowSec()
  await db(c.env).run(
    `INSERT INTO users (id, username, password_hash, salt, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'user', 'active', ?, ?)`,
    newId(),
    username,
    hash,
    salt,
    now,
    now,
  )
  await audit(c.env, {
    action: 'register',
    target: username,
    result: 'success',
    c,
  })
  return ok(c, { registered: true }, 201)
})

// 登录（带 KV 限流 + CSRF）
authRoutes.post('/login', loginRateLimit, csrfMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return fail(c, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? '参数错误', 422)
  }
  try {
    await requireTurnstile(c.env, body?.cf_turnstile_token, clientIp(c))
  } catch (e) {
    if (e instanceof ApiError) return fail(c, e.code, e.message, e.status)
    return fail(c, 'TURNSTILE_FAILED', '人机验证未通过', 422)
  }
  const { username, password } = parsed.data
  const user = await getUserByName(db(c.env), username)
  if (!user) {
    await audit(c.env, {
      action: 'login',
      target: username,
      result: 'failure',
      detail: '用户不存在',
      c,
    })
    return fail(c, 'INVALID_CREDENTIALS', '用户名或密码错误', 401)
  }
  const valid = await verifyPassword(password, user.salt, user.password_hash)
  if (!valid || user.status === 'disabled') {
    await audit(c.env, {
      action: 'login',
      target: username,
      result: 'failure',
      detail: user.status === 'disabled' ? '账号已禁用' : '密码错误',
      c,
    })
    return fail(c, 'INVALID_CREDENTIALS', '用户名或密码错误', 401)
  }
  await createSession(
    c.env,
    user.id,
    c,
    clientIp(c),
    c.req.header('User-Agent'),
  )
  await audit(c.env, {
    action: 'login',
    actorId: user.id,
    actorName: user.username,
    target: user.username,
    result: 'success',
    c,
  })
  return ok(c, { user: await toPublicUser(user) })
})

// 登出
authRoutes.post('/logout', csrfMiddleware, async (c) => {
  await destroySession(c.env, c)
  return ok(c, { loggedOut: true })
})

// 当前用户
authRoutes.get('/me', async (c) => {
  const token = getCookie(c, 'session')
  if (!token) return fail(c, 'UNAUTHENTICATED', '未登录', 401)
  const u = await db(c.env).get<{
    id: string
    username: string
    role: string
    status: string
    created_at: number
  }>(
    'SELECT id, username, role, status, created_at FROM users WHERE id = (SELECT user_id FROM sessions WHERE id = ?)',
    token,
  )
  if (!u) return fail(c, 'UNAUTHENTICATED', '会话无效', 401)
  return ok(c, {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
  })
})
