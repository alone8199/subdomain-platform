import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context'
import { PageHeader, Spinner, EmptyState } from '../../components/ui'

interface Stats {
  total: number
  active: number
  pending: number
}

export default function UserDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Stats>('/api/user/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: '我的子域名', value: stats?.total ?? 0 },
    { label: '已激活', value: stats?.active ?? 0 },
    { label: '待审批', value: stats?.pending ?? 0 },
  ]

  return (
    <div>
      <PageHeader title="概览" desc={`欢迎，${user?.email ?? ''}`} />
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <div className="text-sm text-gray-500">{c.label}</div>
                <div className="text-2xl font-semibold text-gray-800 mt-1">
                  {c.value}
                </div>
              </div>
            ))}
          </div>
          {stats && stats.total === 0 && (
            <div className="card mt-4">
              <EmptyState
                title="还没有子域名"
                hint="前往「申请子域名」选择一个根域名并提交前缀即可。"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
