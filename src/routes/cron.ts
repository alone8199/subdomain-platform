import type { Env } from '../env'
import { db } from '../db'
import { makeCf, CloudflareError } from '../cloudflare/client'
import { audit } from '../utils/audit'
import { nowSec } from '../utils/id'

// Cron：每天清理过期子域名（遍历所有子域名，按各自 Zone 删除 DNS）。
// 仅删除平台创建的记录（dns_record_id 存在），失败的标记为 error 并继续。
export async function runExpiredCleanup(env: Env): Promise<{
  checked: number
  cleaned: number
  failed: number
}> {
  const now = nowSec()
  const expired = await db(env).all<{
    id: string
    full_domain: string
    root_domain: string
    cloudflare_zone_id: string
    dns_record_id: string | null
  }>(
    'SELECT id, full_domain, root_domain, cloudflare_zone_id, dns_record_id FROM subdomains WHERE expires_at IS NOT NULL AND expires_at < ?',
    now,
  )

  const cf = makeCf(env)
  let cleaned = 0
  let failed = 0

  for (const sub of expired) {
    if (sub.dns_record_id) {
      try {
        await cf.deleteDns(sub.cloudflare_zone_id, sub.dns_record_id)
      } catch (e) {
        failed++
        const msg = e instanceof CloudflareError ? e.message : 'DNS 删除失败'
        await db(env).run(
          `UPDATE subdomains SET status='error', error_message=?, updated_at=? WHERE id=?`,
          msg,
          nowSec(),
          sub.id,
        )
        await audit(env, {
          action: 'cron_expire',
          target: sub.full_domain,
          rootDomain: sub.root_domain,
          zoneId: sub.cloudflare_zone_id,
          result: 'failure',
          detail: msg,
        })
        continue
      }
      await audit(env, {
        action: 'cron_expire',
        target: sub.full_domain,
        rootDomain: sub.root_domain,
        zoneId: sub.cloudflare_zone_id,
        result: 'success',
        detail: `record_id=${sub.dns_record_id}`,
      })
    }
    await db(env).run('DELETE FROM subdomains WHERE id = ?', sub.id)
    cleaned++
  }

  return { checked: expired.length, cleaned, failed }
}
