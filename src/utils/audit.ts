import type { Env } from '../env'
import { db } from '../db'
import { newId, nowSec } from './id'
import { clientIp } from './ip'
import type { Context } from 'hono'

// 写入审计日志。多根域名操作必须记录 root_domain 与 zone_id，确保可追溯。
export async function audit(
  env: Env,
  params: {
    actorId?: string | null
    actorName?: string | null
    action: string
    target?: string | null
    rootDomain?: string | null
    zoneId?: string | null
    result?: 'success' | 'failure'
    detail?: string | null
    c?: Context
  },
): Promise<void> {
  const ip = params.c ? clientIp(params.c) : null
  await db(env).run(
    `INSERT INTO audit_logs
      (id, actor_id, actor_name, action, target, root_domain, zone_id, result, detail, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    params.actorId ?? null,
    params.actorName ?? null,
    params.action,
    params.target ?? null,
    params.rootDomain ?? null,
    params.zoneId ?? null,
    params.result ?? 'success',
    params.detail ?? null,
    ip,
    nowSec(),
  )
}
