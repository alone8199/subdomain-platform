import { useEffect, useState, useCallback } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import {
  PageHeader,
  Spinner,
  EmptyState,
  Badge,
  ConfirmButton,
} from '../../components/ui'
import type { Subdomain, Zone } from '../../types'

function fmt(ts: number | null) {
  return ts ? new Date(ts * 1000).toLocaleString('zh-CN') : '-'
}

const STATUS_OPTIONS = ['', 'pending', 'active', 'rejected', 'error', 'expired', 'deleting']

export default function AdminSubdomains() {
  const { toast } = useToast()
  const [list, setList] = useState<Subdomain[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (zoneFilter) params.set('zone_id', zoneFilter)
      if (statusFilter) params.set('status', statusFilter)
      const q = params.toString()
      const [subs, z] = await Promise.all([
        api.get<Subdomain[]>('/api/admin/subdomains' + (q ? `?${q}` : '')),
        api.get<Zone[]>('/api/admin/zones'),
      ])
      setList(subs)
      setZones(z)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [zoneFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    try {
      await api.post(`/api/admin/subdomains/${id}/delete`)
      toast('已删除', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const retry = async (id: string) => {
    try {
      await api.post(`/api/admin/subdomains/${id}/retry`)
      toast('已重试', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="全部子域名" desc="管理所有用户申请的子域名（按根域名 / 状态筛选）" />
      <div className="card">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <select className="input w-48" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="">全部根域名</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.root_domain}</option>
            ))}
          </select>
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === '' ? '全部状态' : s}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState title="暂无子域名" />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">完整域名</th>
                  <th className="th">根域名</th>
                  <th className="th">类型</th>
                  <th className="th">目标</th>
                  <th className="th">状态</th>
                  <th className="th">创建时间</th>
                  <th className="th">到期</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-medium">{s.full_domain}</td>
                    <td className="td">{s.root_domain}</td>
                    <td className="td">{s.record_type}</td>
                    <td className="td max-w-xs truncate">{s.target}</td>
                    <td className="td">
                      <Badge value={s.status} />
                      {s.status === 'error' && s.error_message && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate">{s.error_message}</div>
                      )}
                    </td>
                    <td className="td text-xs text-gray-500">{fmt(s.created_at)}</td>
                    <td className="td text-xs text-gray-500">{fmt(s.expires_at)}</td>
                    <td className="td whitespace-nowrap">
                      <div className="flex gap-1">
                        {s.status === 'error' && (
                          <button className="btn-secondary btn-sm" onClick={() => retry(s.id)}>重试</button>
                        )}
                        <ConfirmButton
                          label="强制删除"
                          confirmText={`强制删除 ${s.full_domain}？将移除 Cloudflare DNS 记录。`}
                          onConfirm={() => remove(s.id)}
                        />
                      </div>
                    </td>
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
