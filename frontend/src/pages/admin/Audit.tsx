import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api'
import { PageHeader, Spinner, EmptyState, Badge } from '../../components/ui'
import type { AuditLog, Zone } from '../../types'

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

const ACTION_OPTIONS = [
  '',
  'login',
  'register',
  'setup',
  'apply',
  'approve',
  'reject',
  'dns_create',
  'dns_delete',
  'user_change',
  'zone_change',
  'cron_expire',
]

export default function AdminAudit() {
  const [list, setList] = useState<AuditLog[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [actionFilter, setActionFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (zoneFilter) params.set('zone_id', zoneFilter)
      const q = params.toString()
      const [logs, z] = await Promise.all([
        api.get<AuditLog[]>('/api/admin/audit' + (q ? `?${q}` : '')),
        api.get<Zone[]>('/api/admin/zones'),
      ])
      setList(logs)
      setZones(z)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [actionFilter, zoneFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <PageHeader title="审计日志" desc="记录登录、申请、审批、DNS 变更、用户与根域名变更（含 root_domain 与 zone_id）" />
      <div className="card">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <select className="input w-44" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{a === '' ? '全部动作' : a}</option>
            ))}
          </select>
          <select className="input w-48" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="">全部根域名</option>
            {zones.map((z) => (
              <option key={z.id} value={z.cloudflare_zone_id}>{z.root_domain}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState title="暂无审计记录" />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">时间</th>
                  <th className="th">操作者</th>
                  <th className="th">动作</th>
                  <th className="th">目标</th>
                  <th className="th">根域名</th>
                  <th className="th">结果</th>
                  <th className="th">详情</th>
                  <th className="th">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id}>
                    <td className="td text-xs text-gray-500 whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td className="td text-xs">{l.actor_email ?? '-'}</td>
                    <td className="td">{l.action}</td>
                    <td className="td max-w-xs truncate">{l.target ?? '-'}</td>
                    <td className="td">{l.root_domain ?? '-'}</td>
                    <td className="td"><Badge value={l.result} /></td>
                    <td className="td max-w-xs truncate text-xs text-gray-500">{l.detail ?? '-'}</td>
                    <td className="td text-xs text-gray-500">{l.ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
