import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context'
import { PageHeader, Spinner } from '../../components/ui'

interface Stats {
  total: number
  active: number
  pending: number
  limit: number
  monthly_limit: number
  monthly_used: number
}

function QuotaRow({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm text-on-surface-variant mb-1">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div
        className="h-2 rounded-full"
        style={{ background: 'var(--ui-surface-container-high)' }}
      >
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, background: 'var(--ui-primary)' }}
        />
      </div>
    </div>
  )
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
                <div className="text-sm text-on-surface-variant">{c.label}</div>
                <div
                  className="text-2xl font-semibold mt-1"
                  style={{ color: 'var(--ui-on-surface)' }}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>
          {stats && stats.limit > 0 && (
            <div className="card mt-4 p-5">
              <div className="text-sm font-medium text-on-surface mb-3">
                使用配额
              </div>
              <QuotaRow
                label="子域名数量"
                used={stats.total}
                limit={stats.limit}
              />
              <QuotaRow
                label="本月申请次数"
                used={stats.monthly_used}
                limit={stats.monthly_limit}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
