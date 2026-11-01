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
import type { Subdomain, ApplyZone } from '../../types'

function fmt(ts: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

export default function MySubdomains() {
  const { toast } = useToast()
  const [list, setList] = useState<Subdomain[]>([])
  const [zones, setZones] = useState<ApplyZone[]>([])
  const [zoneFilter, setZoneFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subs, z] = await Promise.all([
        api.get<Subdomain[]>('/api/user/subdomains' + (zoneFilter ? `?zone_id=${zoneFilter}` : '')),
        api.get<ApplyZone[]>('/api/user/zones'),
      ])
      setList(subs)
      setZones(z)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [zoneFilter])

  useEffect(() => {
    load()
  }, [load])

  const copy = (domain: string) => {
    navigator.clipboard?.writeText(domain)
    toast('已复制 ' + domain, 'success')
  }

  const remove = async (id: string) => {
    try {
      await api.post(`/api/user/subdomains/${id}/delete`)
      toast('已删除', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const retry = async (id: string) => {
    try {
      await api.post(`/api/user/subdomains/${id}/retry`)
      toast('已重试同步', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="我的子域名" desc="查看、复制、删除你申请的子域名" />
      <div className="card">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <label className="text-sm text-gray-600">按根域名筛选</label>
          <select
            className="input w-48"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="">全部</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.root_domain}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState title="暂无子域名" hint="去「申请子域名」提交第一个吧。" />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">完整域名</th>
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
                    <td className="td">{s.record_type}</td>
                    <td className="td max-w-xs truncate">{s.target}</td>
                    <td className="td">
                      <Badge value={s.status} />
                      {s.status === 'rejected' && s.reject_reason && (
                        <div className="text-xs text-red-600 mt-1">{s.reject_reason}</div>
                      )}
                      {s.status === 'error' && s.error_message && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate">
                          {s.error_message}
                        </div>
                      )}
                    </td>
                    <td className="td">{fmt(s.created_at)}</td>
                    <td className="td">{fmt(s.expires_at)}</td>
                    <td className="td whitespace-nowrap">
                      <div className="flex gap-1">
                        <button className="btn-secondary btn-sm" onClick={() => copy(s.full_domain)}>
                          复制
                        </button>
                        {s.status === 'error' && (
                          <button className="btn-secondary btn-sm" onClick={() => retry(s.id)}>
                            重试
                          </button>
                        )}
                        <ConfirmButton
                          label="删除"
                          confirmText={`确认删除 ${s.full_domain}？将同时移除 Cloudflare DNS 记录。`}
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
