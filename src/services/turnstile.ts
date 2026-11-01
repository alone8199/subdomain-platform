import type { Env } from '../env'
import { db } from '../db'
import { ApiError } from '../utils/error'

// Cloudflare Turnstile 人机验证
// 配置存于 settings 表（管理员后台可改）：turnstile_enabled / turnstile_site_key / turnstile_secret_key

export interface TurnstileConfig {
  enabled: boolean
  siteKey: string
  secretKey: string
}

export async function getTurnstileConfig(env: Env): Promise<TurnstileConfig> {
  const rows = await db(env).all<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key')",
  )
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    enabled: map.get('turnstile_enabled') === '1',
    siteKey: map.get('turnstile_site_key') ?? '',
    secretKey: map.get('turnstile_secret_key') ?? '',
  }
}

// 校验 Turnstile Token；未启用时直接放行。token 从请求体的 cf_turnstile_token 字段取。
export async function requireTurnstile(
  env: Env,
  token: string | undefined,
  ip?: string,
): Promise<void> {
  const cfg = await getTurnstileConfig(env)
  if (!cfg.enabled) return

  if (!cfg.secretKey || !cfg.siteKey) {
    throw new ApiError(
      'TURNSTILE_CONFIG',
      '管理员未完成人机验证配置（缺少 Site Key / Secret Key）',
      500,
    )
  }
  if (!token) {
    throw new ApiError('TURNSTILE_REQUIRED', '请先完成人机验证', 422)
  }

  const body = new URLSearchParams({
    secret: cfg.secretKey,
    response: token,
  })
  if (ip) body.set('remoteip', ip)

  let ok = false
  try {
    const resp = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    )
    const data = (await resp.json()) as { success?: boolean }
    ok = data.success === true
  } catch {
    // siteverify 网络异常时放行会导致验证形同虚设，这里按失败处理
    throw new ApiError('TURNSTILE_FAILED', '人机验证服务异常，请稍后重试', 502)
  }
  if (!ok) {
    throw new ApiError('TURNSTILE_FAILED', '人机验证未通过，请重试', 422)
  }
}
