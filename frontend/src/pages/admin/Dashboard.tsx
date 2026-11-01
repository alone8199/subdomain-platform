import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHeader, Spinner } from '../../components/ui'

interface Stats {
  users: number
  zones: number
  active: number
  pending: number
  per_zone: {
    zone_id: string
    root_domain: string
    total: number
    active: number
    pending: number
  }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Stats>('/api/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const cards = [
    { label: '用户数', value: stats?.users ?? 0 },
    { label: '根域名数', value: stats?.zones ?? 0 },
    { label: '活跃子域名', value: stats?.active ?? 0 },
    { label: '待审批', value: stats?.pending ?? 0 },
  ]

  return (
    <div>
      <PageHeader title="仪表盘" desc="平台全局概览" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-semibold text-gray-800 mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card mt-4">
        <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-700">
          各根域名子域名数量
        </div>
        {stats && stats.per_zone.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">暂无根域名数据。</div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">根域名</th>
                  <th className="th">总数</th>
                  <th className="th">活跃</th>
                  <th className="th">待审批</th>
                </tr>
              </thead>
              <tbody>
                {stats?.per_zone.map((z) => (
                  <tr key={z.zone_id}>
                    <td className="td font-medium">{z.root_domain}</td>
                    <td className="td">{z.total}</td>
                    <td className="td">{z.active}</td>
                    <td className="td">{z.pending}</td>
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
