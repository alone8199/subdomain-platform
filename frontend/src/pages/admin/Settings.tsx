import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, Spinner } from '../../components/ui'

export default function AdminSettings() {
  const { toast } = useToast()
  const [regEnabled, setRegEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get<{ registration_enabled: boolean }>('/api/admin/settings')
      .then((s) => setRegEnabled(s.registration_enabled))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async (value: boolean) => {
    setSaving(true)
    try {
      await api.put('/api/admin/settings', { registration_enabled: value })
      setRegEnabled(value)
      toast(value ? '已开放公开注册' : '已关闭公开注册', 'success')
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="系统设置" />
      <div className="card p-5 max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">公开注册</div>
            <div className="text-xs text-gray-400 mt-0.5">
              开启后，任何人可通过 /login 页面的注册入口自助注册；关闭则仅管理员可创建用户。默认关闭。
            </div>
          </div>
          <button
            className={regEnabled ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            disabled={saving}
            onClick={() => save(!regEnabled)}
          >
            {regEnabled ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>
    </div>
  )
}
