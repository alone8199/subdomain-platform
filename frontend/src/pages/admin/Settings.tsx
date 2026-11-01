import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, Spinner, Switch } from '../../components/ui'

interface Settings {
  registration_enabled: boolean
  max_subdomains_per_user: number
  max_applications_per_month: number
}

export default function AdminSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regEnabled, setRegEnabled] = useState(false)
  const [maxSub, setMaxSub] = useState(10)
  const [maxMonth, setMaxMonth] = useState(30)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api
      .get<Settings>('/api/admin/settings')
      .then((s) => {
        setRegEnabled(s.registration_enabled)
        setMaxSub(s.max_subdomains_per_user)
        setMaxMonth(s.max_applications_per_month)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/admin/settings', {
        registration_enabled: regEnabled,
        max_subdomains_per_user: Number(maxSub),
        max_applications_per_month: Number(maxMonth),
      })
      toast('设置已保存', 'success')
      setDirty(false)
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="系统设置"
        actions={
          <button
            className="btn-primary btn-sm"
            disabled={saving || !dirty}
            onClick={save}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        }
      />
      <div className="card p-5 max-w-lg space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-medium text-on-surface">公开注册</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              开启后，任何人可通过 /login 注册；关闭则仅管理员可创建用户。默认关闭。
            </div>
          </div>
          <Switch
            checked={regEnabled}
            onChange={(v) => {
              setRegEnabled(v)
              setDirty(true)
            }}
          />
        </div>
        <hr style={{ borderColor: 'var(--md-outline-variant)' }} />
        <div>
          <label className="label">每用户子域名数量上限</label>
          <input
            type="number"
            min={1}
            max={1000}
            className="input w-40"
            value={maxSub}
            onChange={(e) => {
              setMaxSub(Number(e.target.value))
              setDirty(true)
            }}
          />
          <div className="text-xs text-on-surface-variant mt-1">
            单个用户最多可拥有的子域名数量（不含已被拒绝的）。
          </div>
        </div>
        <div>
          <label className="label">每用户每月申请次数上限</label>
          <input
            type="number"
            min={1}
            max={10000}
            className="input w-40"
            value={maxMonth}
            onChange={(e) => {
              setMaxMonth(Number(e.target.value))
              setDirty(true)
            }}
          />
          <div className="text-xs text-on-surface-variant mt-1">
            单个用户每月最多可提交的申请次数（含已创建与创建失败的）。
          </div>
        </div>
        <div className="text-xs text-on-surface-variant">
          说明：DNS 解析本身由 Cloudflare 提供，不限次数；以上为平台侧的创建 / 申请限制。
        </div>
      </div>
    </div>
  )
}
