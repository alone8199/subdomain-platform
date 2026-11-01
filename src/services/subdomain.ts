import type { Env } from '../env'
import type { Context } from 'hono'
import {
  db,
  getZoneById,
  getSubdomainById,
  getSubdomainByFullDomain,
} from '../db'
import { makeCf, CloudflareError } from '../cloudflare/client'
import { ApiError } from '../utils/error'
import { audit } from '../utils/audit'
import { newId, nowSec } from '../utils/id'
import type { SubdomainRow, ZoneRow } from '../types'

// 清理 Cloudflare 错误信息中的敏感字段（token 不会出现在 body，但保险起见做摘要）。
function sanitizeCfError(e: unknown): string {
  if (e instanceof CloudflareError) {
    return e.message
  }
  return 'DNS 操作失败（未知错误）'
}

// 校验前缀是否为保留词
export function isReservedPrefix(
  prefix: string,
  zone: ZoneRow,
): boolean {
  const words = zone.reserved_words
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
  return words.includes(prefix.toLowerCase())
}

// 校验记录类型是否被该根域名允许
export function isTypeAllowed(
  type: string,
  zone: ZoneRow,
): boolean {
  const types = zone.allowed_types
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
  return types.includes(type.toUpperCase())
}

// 冲突检测：D1 内唯一 + Cloudflare Zone 内现有 DNS 冲突
export async function checkConflict(
  env: Env,
  zone: ZoneRow,
  fullDomain: string,
): Promise<void> {
  const existing = await getSubdomainByFullDomain(db(env), fullDomain)
  if (existing) {
    throw new ApiError('DOMAIN_TAKEN', '该完整域名已被占用', 409)
  }
  const cf = makeCf(env)
  let cfRecords: { id: string }[] = []
  try {
    cfRecords = await cf.listDnsByName(zone.cloudflare_zone_id, fullDomain)
  } catch (e) {
    // 查询失败不阻断申请，但记录可疑；这里直接抛出以便管理员排查 Token 权限
    throw new ApiError('CF_CHECK_FAILED', sanitizeCfError(e), 502)
  }
  if (cfRecords.length > 0) {
    throw new ApiError(
      'DOMAIN_TAKEN_CF',
      '该域名在 Cloudflare Zone 中已存在 DNS 记录',
      409,
    )
  }
}

// 创建 DNS 记录并激活
async function createDnsAndActivate(
  env: Env,
  zone: ZoneRow,
  sub: SubdomainRow,
  c?: Context,
): Promise<void> {
  const cf = makeCf(env)
  let record
  try {
    record = await cf.createDns(zone.cloudflare_zone_id, {
      type: sub.record_type,
      name: sub.full_domain,
      content: sub.target,
      ttl: sub.ttl,
    })
  } catch (e) {
    // 创建失败回滚状态为 error，不假装成功
    await db(env).run(
      `UPDATE subdomains SET status='error', error_message=?, updated_at=? WHERE id=?`,
      sanitizeCfError(e),
      nowSec(),
      sub.id,
    )
    await audit(env, {
      action: 'dns_create',
      target: sub.full_domain,
      rootDomain: zone.root_domain,
      zoneId: zone.cloudflare_zone_id,
      result: 'failure',
      detail: sanitizeCfError(e),
      c,
    })
    throw new ApiError('CF_CREATE_FAILED', sanitizeCfError(e), 502)
  }
  await db(env).run(
    `UPDATE subdomains SET status='active', dns_record_id=?, error_message=NULL, updated_at=? WHERE id=?`,
    record.id,
    nowSec(),
    sub.id,
  )
  await audit(env, {
    action: 'dns_create',
    target: sub.full_domain,
    rootDomain: zone.root_domain,
    zoneId: zone.cloudflare_zone_id,
    result: 'success',
    detail: `record_id=${record.id}`,
    c,
  })
}

// 用户申请子域名
export async function applySubdomain(
  env: Env,
  c: Context,
  userId: string,
  input: {
    zone_id: string
    prefix: string
    record_type: string
    target: string
    ttl?: number
    expires_at?: number | null
  },
): Promise<SubdomainRow> {
  const zone = await getZoneById(db(env), input.zone_id)
  if (!zone) throw new ApiError('ZONE_NOT_FOUND', '根域名不存在', 404)
  if (!zone.enabled) {
    throw new ApiError('ZONE_DISABLED', '该根域名已禁用，暂不可申请', 403)
  }

  // ---- 平台限制：每用户子域名数量上限 + 每月申请次数上限 ----
  const maxSub = Number(
    (await db(env).get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'max_subdomains_per_user'))?.value ?? 10,
  )
  const maxMonth = Number(
    (await db(env).get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'max_applications_per_month'))?.value ?? 30,
  )
  const owned = await db(env).get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ? AND status != 'rejected'",
    userId,
  )
  if ((owned?.n ?? 0) >= maxSub) {
    throw new ApiError('LIMIT_REACHED', `已达到每用户子域名数量上限（${maxSub} 个）`, 429)
  }
  const d = new Date()
  const monthStart = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000)
  const monthCount = await db(env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM subdomains WHERE user_id = ? AND created_at >= ?',
    userId,
    monthStart,
  )
  if ((monthCount?.n ?? 0) >= maxMonth) {
    throw new ApiError('MONTH_LIMIT', `本月申请次数已达上限（${maxMonth} 次）`, 429)
  }

  if (!isTypeAllowed(input.record_type, zone)) {
    throw new ApiError('TYPE_NOT_ALLOWED', '该根域名不支持此记录类型', 422)
  }
  if (isReservedPrefix(input.prefix, zone)) {
    throw new ApiError('RESERVED_PREFIX', '该前缀为保留词，不可使用', 422)
  }
  const fullDomain = `${input.prefix}.${zone.root_domain}`.toLowerCase()

  // 被拒绝 / 创建失败（无 CF 记录）的旧申请可清理，允许同一前缀重新申请
  const old = await getSubdomainByFullDomain(db(env), fullDomain)
  if (
    old &&
    (old.status === 'rejected' ||
      (old.status === 'error' && !old.dns_record_id))
  ) {
    await db(env).run('DELETE FROM subdomains WHERE id = ?', old.id)
  }

  await checkConflict(env, zone, fullDomain)

  const ttl = input.ttl || zone.default_ttl
  const subId = newId()
  const now = nowSec()

  // 始终先落库为 pending
  await db(env).run(
    `INSERT INTO subdomains
      (id, user_id, zone_id, root_domain, prefix, full_domain, record_type, target, ttl, status, dns_record_id, cloudflare_zone_id, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, ?)`,
    subId,
    userId,
    zone.id,
    zone.root_domain,
    input.prefix,
    fullDomain,
    input.record_type,
    input.target,
    ttl,
    zone.cloudflare_zone_id,
    input.expires_at ?? null,
    now,
    now,
  )

  const sub = (await getSubdomainById(db(env), subId))!
  await audit(env, {
    action: 'apply',
    actorId: userId,
    target: fullDomain,
    rootDomain: zone.root_domain,
    zoneId: zone.cloudflare_zone_id,
    result: 'success',
    detail: `type=${input.record_type}`,
    c,
  })

  // 自动通过：申请校验通过后直接创建 DNS 并激活（用户申请即开通）
  await createDnsAndActivate(env, zone, sub, c)
  return (await getSubdomainById(db(env), subId))!
}

// 管理员审批通过：创建 DNS 并激活
export async function approveSubdomain(
  env: Env,
  c: Context,
  subId: string,
): Promise<SubdomainRow> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub) throw new ApiError('NOT_FOUND', '子域名申请不存在', 404)
  if (sub.status === 'active') {
    throw new ApiError('ALREADY_ACTIVE', '该子域名已激活', 409)
  }
  if (sub.status === 'rejected') {
    throw new ApiError('REJECTED', '该申请已被拒绝', 409)
  }
  const zone = await getZoneById(db(env), sub.zone_id)
  if (!zone) throw new ApiError('ZONE_NOT_FOUND', '根域名不存在', 404)
  await createDnsAndActivate(env, zone, sub, c)
  return (await getSubdomainById(db(env), subId))!
}

// 管理员拒绝
export async function rejectSubdomain(
  env: Env,
  c: Context,
  subId: string,
  reason: string,
): Promise<void> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub) throw new ApiError('NOT_FOUND', '子域名申请不存在', 404)
  if (sub.status === 'active') {
    throw new ApiError('ALREADY_ACTIVE', '已激活的子域名不能拒绝', 409)
  }
  await db(env).run(
    `UPDATE subdomains SET status='rejected', reject_reason=?, updated_at=? WHERE id=?`,
    reason,
    nowSec(),
    subId,
  )
  await audit(env, {
    action: 'reject',
    target: sub.full_domain,
    rootDomain: sub.root_domain,
    zoneId: sub.cloudflare_zone_id,
    result: 'success',
    detail: reason,
    c,
  })
}

// 删除 DNS 并移除记录（仅删除平台创建的记录）
export async function deleteSubdomain(
  env: Env,
  c: Context,
  subId: string,
): Promise<void> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub) throw new ApiError('NOT_FOUND', '子域名不存在', 404)

  // 仅当存在 CF DNS 记录时才调用删除（平台创建的记录）
  if (sub.dns_record_id) {
    const cf = makeCf(env)
    try {
      await cf.deleteDns(sub.cloudflare_zone_id, sub.dns_record_id)
    } catch (e) {
      // 删除失败：保留记录并标记 error，便于重试/排查，不假装成功
      await db(env).run(
        `UPDATE subdomains SET status='error', error_message=?, updated_at=? WHERE id=?`,
        sanitizeCfError(e),
        nowSec(),
        subId,
      )
      await audit(env, {
        action: 'dns_delete',
        target: sub.full_domain,
        rootDomain: sub.root_domain,
        zoneId: sub.cloudflare_zone_id,
        result: 'failure',
        detail: sanitizeCfError(e),
        c,
      })
      throw new ApiError('CF_DELETE_FAILED', sanitizeCfError(e), 502)
    }
    await audit(env, {
      action: 'dns_delete',
      target: sub.full_domain,
      rootDomain: sub.root_domain,
      zoneId: sub.cloudflare_zone_id,
      result: 'success',
      detail: `record_id=${sub.dns_record_id}`,
      c,
    })
  }

  // 删除平台记录行
  await db(env).run('DELETE FROM subdomains WHERE id = ?', subId)
}

// 错误状态重试同步（重新尝试创建 DNS）
export async function retrySubdomain(
  env: Env,
  c: Context,
  subId: string,
): Promise<SubdomainRow> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub) throw new ApiError('NOT_FOUND', '子域名不存在', 404)
  if (sub.status !== 'error') {
    throw new ApiError('NOT_ERROR', '仅 error 状态可重试', 409)
  }
  const zone = await getZoneById(db(env), sub.zone_id)
  if (!zone) throw new ApiError('ZONE_NOT_FOUND', '根域名不存在', 404)
  await createDnsAndActivate(env, zone, sub, c)
  return (await getSubdomainById(db(env), subId))!
}

// 编辑已激活子域名并同步到 Cloudflare（使用各自根域名的 zone_id）
export async function editSubdomain(
  env: Env,
  c: Context | undefined,
  subId: string,
  input: { target: string; ttl?: number },
): Promise<SubdomainRow> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub) throw new ApiError('NOT_FOUND', '子域名不存在', 404)
  if (sub.status !== 'active') {
    throw new ApiError('NOT_ACTIVE', '仅已激活的子域名可编辑', 409)
  }
  const zone = await getZoneById(db(env), sub.zone_id)
  if (!zone) throw new ApiError('ZONE_NOT_FOUND', '根域名不存在', 404)

  const ttl = input.ttl ?? sub.ttl

  // 先更新本地记录
  await db(env).run(
    `UPDATE subdomains SET target=?, ttl=?, updated_at=? WHERE id=?`,
    input.target,
    ttl,
    nowSec(),
    subId,
  )

  // 已创建 CF 记录的才需要同步；使用所属根域名的 zone_id
  if (sub.dns_record_id) {
    const cf = makeCf(env)
    try {
      await cf.updateDns(zone.cloudflare_zone_id, sub.dns_record_id, {
        type: sub.record_type,
        name: sub.full_domain,
        content: input.target,
        ttl,
      })
    } catch (e) {
      await db(env).run(
        `UPDATE subdomains SET status='error', error_message=?, updated_at=? WHERE id=?`,
        sanitizeCfError(e),
        nowSec(),
        subId,
      )
      await audit(env, {
        action: 'dns_update',
        target: sub.full_domain,
        rootDomain: zone.root_domain,
        zoneId: zone.cloudflare_zone_id,
        result: 'failure',
        detail: sanitizeCfError(e),
        c,
      })
      throw new ApiError('CF_UPDATE_FAILED', sanitizeCfError(e), 502)
    }
    await audit(env, {
      action: 'dns_update',
      target: sub.full_domain,
      rootDomain: zone.root_domain,
      zoneId: zone.cloudflare_zone_id,
      result: 'success',
      detail: `record_id=${sub.dns_record_id}`,
      c,
    })
  }
  return (await getSubdomainById(db(env), subId))!
}
