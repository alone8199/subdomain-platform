import type { Env } from '../env'
import { db, getSession, deleteSession } from '../db'
import { newId, nowSec } from '../utils/id'
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const SESSION_TTL_SEC = 60 * 60 * 24 * 7 // 7 天
const COOKIE_NAME = 'session'

export interface SessionUser {
  id: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'disabled'
}

// 创建会话：写 D1 + 设置 HttpOnly Cookie
export async function createSession(
  env: Env,
  userId: string,
  c: Context,
  ip?: string,
  userAgent?: string,
): Promise<string> {
  const token = newId()
  const now = nowSec()
  const expires = now + SESSION_TTL_SEC
  await db(env).run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    token,
    userId,
    expires,
    now,
    ip ?? null,
    userAgent ?? null,
  )
  setSessionCookie(c, token, SESSION_TTL_SEC)
  return token
}

export function setSessionCookie(c: Context, token: string, ttl: number) {
  setCookie(c, COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: ttl,
  })
}

export function clearSessionCookie(c: Context) {
  setCookie(c, COOKIE_NAME, '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
  })
}

// 校验并解析当前会话（从 Cookie）
export async function resolveSession(
  env: Env,
  c: Context,
): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const s = await getSession(db(env), token)
  if (!s || s.expires_at < nowSec()) {
    if (s) await deleteSession(db(env), token)
    return null
  }
  const u = await db(env).get<{
    id: string
    email: string
    role: string
    status: string
  }>('SELECT id, email, role, status FROM users WHERE id = ?', s.user_id)
  if (!u || u.status === 'disabled') return null
  return {
    id: u.id,
    email: u.email,
    role: u.role as any,
    status: u.status as any,
  }
}

export async function destroySession(env: Env, c: Context) {
  const token = getCookie(c, COOKIE_NAME)
  if (token) await deleteSession(db(env), token)
  clearSessionCookie(c)
}

export const SESSION_MAX_AGE = SESSION_TTL_SEC
