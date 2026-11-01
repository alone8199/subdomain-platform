import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, Spinner, Switch, Button, Input } from '../../components/ui'

interface Settings {
  registration_enabled: boolean
  max_subdomains_per_user: number
  max_applications_per_month: number
  default_auto_approve: boolean
  default_zone_ttl: number
  turnstile_enabled: boolean
  turnstile_site_key: string
  turnstile_has_secret?: boolean
}

export default function AdminSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regEnabled, setRegEnabled] = useState(false)
  const [maxSub, setMaxSub] = useState(10)
  const [maxMonth, setMaxMonth] = useState(30)
  const [dAuto, setDAuto] = useState(false)
  const [dTtl, setDTtl] = useState(300)
  const [tsEnabled, setTsEnabled] = useState(false)
  const [tsSiteKey, setTsSiteKey] = useState('')
  const [tsSecretKey, setTsSecretKey] = useState('')
  const [tsHasSecret, setTsHasSecret] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api
      .get<Settings>('/api/admin/settings')
      .then((s) => {
        setRegEnabled(s.registration_enabled)
        setMaxSub(s.max_subdomains_per_user)
        setMaxMonth(s.max_applications_per_month)
        setDAuto(s.default_auto_approve)
        setDTtl(s.default_zone_ttl)
        setTsEnabled(s.turnstile_enabled)
        setTsSiteKey(s.turnstile_site_key)
        setTsHasSecret(!!s.turnstile_has_secret)
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
        default_auto_approve: dAuto,
        default_zone_ttl: Number(dTtl),
        turnstile_enabled: tsEnabled,
        turnstile_site_key: tsSiteKey.trim(),
        ...(tsSecretKey.trim() ? { turnstile_secret_key: tsSecretKey.trim() } : {}),
      })
      setTsHasSecret((h) => h || !!tsSecretKey.trim())
      setTsSecretKey('')
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
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !dirty}
            onClick={save}
          >
            {saving ? '保存中…' : '保存'}
          </Button>
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
        <hr style={{ borderColor: 'var(--ui-outline-variant)' }} />
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-medium text-on-surface">新根域名默认自动审批</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              添加根域名时的默认值；每个根域名还可在「根域名管理」中单独开关。
            </div>
          </div>
          <Switch
            checked={dAuto}
            onChange={(v) => {
              setDAuto(v)
              setDirty(true)
            }}
          />
        </div>
        <div>
          <Input
            label="新根域名默认 TTL（秒）"
            type="number"
            className="w-40"
            value={dTtl}
            onChange={(v) => {
              setDTtl(Number(v))
              setDirty(true)
            }}
          />
          <div className="text-xs text-on-surface-variant mt-1">
            新增根域名时解析记录的默认 TTL（60-86400），每个根域名可在编辑中单独修改。
          </div>
        </div>
        <hr style={{ borderColor: 'var(--ui-outline-variant)' }} />
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-medium text-on-surface">人机验证（Cloudflare Turnstile）</div>
            <div className="text-xs text-on-surface-variant mt-0.5">
              开启后，登录、注册、申请子域名、添加解析记录需先通过人机验证。
            </div>
          </div>
          <Switch
            checked={tsEnabled}
            onChange={(v) => {
              setTsEnabled(v)
              setDirty(true)
            }}
          />
        </div>
        {tsEnabled && (
          <div className="space-y-3 rounded-md p-3" style={{ background: 'var(--ui-surface-container)' }}>
            <Input
              label="Site Key（公开）"
              value={tsSiteKey}
              onChange={(v) => {
                setTsSiteKey(v)
                setDirty(true)
              }}
              placeholder="0x4AAAAAAA..."
            />
            <Input
              label={tsHasSecret ? 'Secret Key（已保存，输入新值可覆盖）' : 'Secret Key'}
              type="password"
              value={tsSecretKey}
              onChange={(v) => {
                setTsSecretKey(v)
                setDirty(true)
              }}
              placeholder={tsHasSecret ? '••••••••' : '0x4AAAAAAA...'}
            />
            <div className="text-xs text-on-surface-variant">
              在 Cloudflare 控制台 → Turnstile 中创建 Widget 获取密钥，域名需填本站域名（如 panel.neob.asia）。
            </div>
          </div>
        )}
        <hr style={{ borderColor: 'var(--ui-outline-variant)' }} />
        <div>
          <Input
            label="每用户子域名数量上限"
            type="number"
            className="w-40"
            value={maxSub}
            onChange={(v) => {
              setMaxSub(Number(v))
              setDirty(true)
            }}
          />
          <div className="text-xs text-on-surface-variant mt-1">
            单个用户最多可拥有的子域名数量（不含已被拒绝的）。
          </div>
        </div>
        <div>
          <Input
            label="每用户每月申请次数上限"
            type="number"
            className="w-40"
            value={maxMonth}
            onChange={(v) => {
              setMaxMonth(Number(v))
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
