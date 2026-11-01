import type { Env } from '../env'
import type { Context } from 'hono'
import { db, getSubdomainById } from '../db'
import { makeCf, CloudflareError } from '../cloudflare/client'
import { ApiError } from '../utils/error'
import { audit } from '../utils/audit'
import { newId, nowSec } from '../utils/id'
import type { SubdomainRow } from '../types'

// 每个子域名允许的记录类型与上限。
// 注意：刻意不开放 NS/MX/SOA 等类型 —— NS 会委派子域导致劫持风险，MX 滥用风险高。
export const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'TXT'] as const
export const MAX_RECORDS_PER_SUBDOMAIN = 20

export interface DnsRecordRow {
  id: string
  subdomain_id: string
  user_id: string
  name: string
  record_type: string
  content: string
  ttl: number
  cf_record_id: string | null
  status: string
  error_message: string | null
  created_at: number
  updated_at: number
}

function sanitizeCfError(e: unknown): string {
  if (e instanceof CloudflareError) return e.message
  return 'DNS 操作失败（未知错误）'
}

// 校验相对记录名：空/'@' 表示子域本身；其余按域名段规则（字母数字连字符，可多段）。
function validateRecordName(name: string): string {
  const n = (name || '').trim().toLowerCase().replace(/\.$/, '')
  if (n === '' || n === '@') return ''
  if (n.length > 100) throw new ApiError('INVALID_NAME', '记录名过长', 422)
  const labels = n.split('.').filter((s) => s !== '')
  if (labels.length === 0) return ''
  if (labels.length > 3)
    throw new ApiError('INVALID_NAME', '记录名最多 3 级子域', 422)
  for (const l of labels) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) {
      throw new ApiError(
        'INVALID_NAME',
        '记录名每段仅允许字母、数字与连字符，且不以连字符开头/结尾',
        422,
      )
    }
  }
  return labels.join('.')
}

// 校验记录值
function validateContent(type: string, content: string): string {
  const c = content.trim()
  if (!c || c.length > 1024)
    throw new ApiError('INVALID_CONTENT', '记录值不能为空且不超过 1024 字符', 422)
  if (type === 'A') {
    const parts = c.split('.')
    const ok =
      parts.length === 4 &&
      parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
    if (!ok)
      throw new ApiError('INVALID_CONTENT', 'A 记录值必须是 IPv4 地址（如 1.2.3.4）', 422)
  }
  if (type === 'AAAA' && !(/^[0-9a-fA-F:]{2,45}$/.test(c) && c.includes(':'))) {
    throw new ApiError('INVALID_CONTENT', 'AAAA 记录值必须是 IPv6 地址', 422)
  }
  if (type === 'CNAME' && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.?$/.test(c)) {
    throw new ApiError('INVALID_CONTENT', 'CNAME 记录值必须是域名（如 example.com）', 422)
  }
  return c
}

// 取归属校验后的子域名（仅 active 可管理解析）
async function getOwnedSubdomain(
  env: Env,
  userId: string,
  subId: string,
): Promise<SubdomainRow> {
  const sub = await getSubdomainById(db(env), subId)
  if (!sub || sub.user_id !== userId)
    throw new ApiError('NOT_FOUND', '子域名不存在', 404)
  if (sub.status !== 'active')
    throw new ApiError('NOT_ACTIVE', '仅已激活的子域名可管理解析', 409)
  return sub
}

function fullName(sub: SubdomainRow, name: string): string {
  return name ? `${name}.${sub.full_domain}` : sub.full_domain
}

export async function listRecords(
  env: Env,
  userId: string,
  subId: string,
): Promise<DnsRecordRow[]> {
  await getOwnedSubdomain(env, userId, subId)
  return db(env).all<DnsRecordRow>(
    'SELECT * FROM dns_records WHERE subdomain_id = ? ORDER BY created_at ASC',
    subId,
  )
}

// 添加解析记录（根解析：name 留空/@；子域解析：name 填 www、a 等）
export async function addRecord(
  env: Env,
  c: Context | undefined,
  userId: string,
  subId: string,
  input: { name?: string; record_type: string; content: string; ttl?: number },
): Promise<DnsRecordRow> {
  const sub = await getOwnedSubdomain(env, userId, subId)
  const type = (input.record_type || '').toUpperCase()
  if (!(RECORD_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(
      'TYPE_NOT_ALLOWED',
      `记录类型仅支持：${RECORD_TYPES.join(' / ')}`,
      422,
    )
  }
  const name = validateRecordName(input.name || '')
  const content = validateContent(type, input.content)
  const ttl = Math.min(Math.max(input.ttl || sub.ttl || 300, 60), 86400)

  // 记录数量上限
  const cnt = await db(env).get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM dns_records WHERE subdomain_id = ?',
    subId,
  )
  if ((cnt?.n ?? 0) >= MAX_RECORDS_PER_SUBDOMAIN) {
    throw new ApiError(
      'RECORD_LIMIT',
      `每个子域名最多 ${MAX_RECORDS_PER_SUBDOMAIN} 条解析记录`,
      429,
    )
  }

  const full = fullName(sub, name)

  // 同名同类型冲突检测（D1 内）。DNS 规则：CNAME 与任何记录互斥；其余类型可同名共存（如 A + TXT）
  const dupRows = await db(env).all<{ record_type: string }>(
    'SELECT record_type FROM dns_records WHERE subdomain_id = ? AND name = ?',
    subId,
    name,
  )
  const dupHasCname = dupRows.some((r) => r.record_type === 'CNAME')
  if (type === 'CNAME' || dupHasCname) {
    if (dupRows.length > 0)
      throw new ApiError('RECORD_EXISTS', `${full} 已存在解析记录（CNAME 不可与其他记录共存）`, 409)
  } else if (dupRows.some((r) => r.record_type === type)) {
    throw new ApiError('RECORD_EXISTS', `${full} 已存在同类型的解析记录`, 409)
  }

  // Cloudflare 冲突检测（防绕过平台写入的记录）
  const cf = makeCf(env)
  let cfExisting: { id: string; type: string }[] = []
  try {
    cfExisting = await cf.listDnsByName(sub.cloudflare_zone_id, full)
  } catch (e) {
    throw new ApiError('CF_CHECK_FAILED', sanitizeCfError(e), 502)
  }
  const cfHasCname = cfExisting.some((r) => r.type === 'CNAME')
  const conflict =
    type === 'CNAME' || cfHasCname
      ? cfExisting.length > 0
      : cfExisting.some((r) => r.type === type)
  if (conflict) {
    throw new ApiError(
      'RECORD_EXISTS_CF',
      cfHasCname
        ? `${full} 已存在 CNAME 记录（CNAME 不可与其他记录共存）`
        : `${full} 已存在 ${type} 记录`,
      409,
    )
  }

  // 创建 CF 记录
  const recId = newId()
  const now = nowSec()
  await db(env).run(
    `INSERT INTO dns_records (id, subdomain_id, user_id, name, record_type, content, ttl, cf_record_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?)`,
    recId,
    subId,
    userId,
    name,
    type,
    content,
    ttl,
    now,
    now,
  )
  let record
  try {
    record = await cf.createDns(sub.cloudflare_zone_id, {
      type,
      name: full,
      content,
      ttl,
    })
  } catch (e) {
    await db(env).run(
      `UPDATE dns_records SET status='error', error_message=?, updated_at=? WHERE id=?`,
      sanitizeCfError(e),
      nowSec(),
      recId,
    )
    await audit(env, {
      action: 'record_create',
      actorId: userId,
      target: full,
      rootDomain: sub.root_domain,
      zoneId: sub.cloudflare_zone_id,
      result: 'failure',
      detail: sanitizeCfError(e),
      c,
    })
    throw new ApiError('CF_CREATE_FAILED', sanitizeCfError(e), 502)
  }
  await db(env).run(
    `UPDATE dns_records SET status='active', cf_record_id=?, error_message=NULL, updated_at=? WHERE id=?`,
    record.id,
    nowSec(),
    recId,
  )
  await audit(env, {
    action: 'record_create',
    actorId: userId,
    target: full,
    rootDomain: sub.root_domain,
    zoneId: sub.cloudflare_zone_id,
    result: 'success',
    detail: `type=${type} record_id=${record.id}`,
    c,
  })
  return (await db(env).get<DnsRecordRow>('SELECT * FROM dns_records WHERE id = ?', recId))!
}

// 编辑解析记录（内容 / TTL）
export async function editRecord(
  env: Env,
  c: Context | undefined,
  userId: string,
  subId: string,
  recordId: string,
  input: { content: string; ttl?: number },
): Promise<DnsRecordRow> {
  const sub = await getOwnedSubdomain(env, userId, subId)
  const rec = await db(env).get<DnsRecordRow>(
    'SELECT * FROM dns_records WHERE id = ? AND subdomain_id = ? AND user_id = ?',
    recordId,
    subId,
    userId,
  )
  if (!rec) throw new ApiError('NOT_FOUND', '解析记录不存在', 404)
  const content = validateContent(rec.record_type, input.content)
  const ttl = Math.min(Math.max(input.ttl || rec.ttl, 60), 86400)

  await db(env).run(
    'UPDATE dns_records SET content=?, ttl=?, updated_at=? WHERE id=?',
    content,
    ttl,
    nowSec(),
    rec.id,
  )
  if (rec.cf_record_id) {
    const cf = makeCf(env)
    try {
      await cf.updateDns(sub.cloudflare_zone_id, rec.cf_record_id, {
        type: rec.record_type,
        name: fullName(sub, rec.name),
        content,
        ttl,
      })
    } catch (e) {
      await db(env).run(
        `UPDATE dns_records SET status='error', error_message=?, updated_at=? WHERE id=?`,
        sanitizeCfError(e),
        nowSec(),
        rec.id,
      )
      throw new ApiError('CF_UPDATE_FAILED', sanitizeCfError(e), 502)
    }
    await audit(env, {
      action: 'record_update',
      actorId: userId,
      target: fullName(sub, rec.name),
      rootDomain: sub.root_domain,
      zoneId: sub.cloudflare_zone_id,
      result: 'success',
      c,
    })
  }
  return (await db(env).get<DnsRecordRow>('SELECT * FROM dns_records WHERE id = ?', rec.id))!
}

// 删除解析记录（同步删除 Cloudflare 上的记录）
export async function deleteRecord(
  env: Env,
  c: Context | undefined,
  userId: string,
  subId: string,
  recordId: string,
): Promise<void> {
  const sub = await getOwnedSubdomain(env, userId, subId)
  const rec = await db(env).get<DnsRecordRow>(
    'SELECT * FROM dns_records WHERE id = ? AND subdomain_id = ? AND user_id = ?',
    recordId,
    subId,
    userId,
  )
  if (!rec) throw new ApiError('NOT_FOUND', '解析记录不存在', 404)

  if (rec.cf_record_id) {
    const cf = makeCf(env)
    try {
      await cf.deleteDns(sub.cloudflare_zone_id, rec.cf_record_id)
    } catch (e) {
      // Cloudflare 上已不存在（被人手动删过）：视为已删除，正常清理本地行
      if (!isRecordMissing(e)) {
        await db(env).run(
          `UPDATE dns_records SET status='error', error_message=?, updated_at=? WHERE id=?`,
          sanitizeCfError(e),
          nowSec(),
          rec.id,
        )
        await audit(env, {
          action: 'record_delete',
          actorId: userId,
          target: fullName(sub, rec.name),
          rootDomain: sub.root_domain,
          zoneId: sub.cloudflare_zone_id,
          result: 'failure',
          detail: sanitizeCfError(e),
          c,
        })
        throw new ApiError('CF_DELETE_FAILED', sanitizeCfError(e), 502)
      }
    }
  }
  await db(env).run('DELETE FROM dns_records WHERE id = ?', rec.id)
  await audit(env, {
    action: 'record_delete',
    actorId: userId,
    target: fullName(sub, rec.name),
    rootDomain: sub.root_domain,
    zoneId: sub.cloudflare_zone_id,
    result: 'success',
    c,
  })
}

// 判断是否为「记录在 Cloudflare 上已不存在」的错误（幂等删除场景）
export function isRecordMissing(e: unknown): boolean {
  if (!(e instanceof CloudflareError)) return false
  return /does not exist|not found/i.test(e.message) || e.status === 404
}

// 删除子域名时级联删除其全部解析记录（供 deleteSubdomain 调用）
// 返回本次已处理（删除成功或本就不存在）的 Cloudflare 记录 ID 集合，
// 调用方据此跳过重复删除（根记录与 sub.dns_record_id 是同一条 CF 记录）。
export async function deleteAllRecordsForSubdomain(
  env: Env,
  sub: SubdomainRow,
): Promise<string[]> {
  const rows = await db(env).all<DnsRecordRow>(
    'SELECT * FROM dns_records WHERE subdomain_id = ?',
    sub.id,
  )
  const cf = makeCf(env)
  const handled: string[] = []
  const failed: string[] = []
  for (const r of rows) {
    if (!r.cf_record_id) continue
    try {
      await cf.deleteDns(sub.cloudflare_zone_id, r.cf_record_id)
      handled.push(r.cf_record_id)
    } catch (e) {
      if (isRecordMissing(e)) {
        handled.push(r.cf_record_id)
      } else {
        failed.push(r.id)
      }
    }
  }
  await db(env).run('DELETE FROM dns_records WHERE subdomain_id = ?', sub.id)
  if (failed.length > 0) {
    throw new ApiError(
      'CF_DELETE_FAILED',
      `部分解析记录删除失败（${failed.length} 条），请稍后重试`,
      502,
    )
  }
  return handled
}
