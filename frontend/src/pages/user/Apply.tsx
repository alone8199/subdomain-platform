import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, FieldError } from '../../components/ui'
import type { ApplyZone } from '../../types'

export default function UserApply() {
  const { toast } = useToast()
  const [zones, setZones] = useState<ApplyZone[]>([])
  const [zoneId, setZoneId] = useState('')
  const [prefix, setPrefix] = useState('')
  const [recordType, setRecordType] = useState('CNAME')
  const [target, setTarget] = useState('')
  const [ttl, setTtl] = useState<number>(300)
  const [proxied, setProxied] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ full_domain: string; status: string } | null>(null)

  useEffect(() => {
    api
      .get<ApplyZone[]>('/api/user/zones')
      .then((z) => {
        setZones(z)
        if (z.length) {
          setZoneId(z[0].id)
          setTtl(z[0].default_ttl)
          const types = z[0].allowed_types.split(',').map((t) => t.trim())
          if (!types.includes('CNAME')) setRecordType(types[0] ?? 'A')
        }
      })
      .catch(() => {})
  }, [])

  const selectedZone = zones.find((z) => z.id === zoneId)
  const allowedTypes = selectedZone
    ? selectedZone.allowed_types.split(',').map((t) => t.trim())
    : []
  const canProxy = ['A', 'AAAA', 'CNAME'].includes(recordType)

  const onZoneChange = (id: string) => {
    setZoneId(id)
    const z = zones.find((x) => x.id === id)
    if (z) {
      setTtl(z.default_ttl)
      const types = z.allowed_types.split(',').map((t) => t.trim())
      if (!types.includes(recordType)) setRecordType(types[0] ?? 'A')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr({})
    setResult(null)
    const next: Record<string, string> = {}
    if (!zoneId) next.zone_id = '请选择根域名'
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix))
      next.prefix = '前缀仅允许小写字母、数字、连字符，且不能以连字符开头或结尾'
    if (!target.trim()) next.target = '请填写目标内容'
    if (Object.keys(next).length) {
      setErr(next)
      return
    }
    setLoading(true)
    try {
      const r = await api.post<{ full_domain: string; status: string }>(
        '/api/user/subdomains',
        {
          zone_id: zoneId,
          prefix,
          record_type: recordType,
          target: target.trim(),
          ttl,
          proxied: canProxy ? proxied : false,
          expires_at: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
        },
      )
      setResult(r)
      toast('申请已提交', 'success')
      setPrefix('')
      setTarget('')
      setProxied(false)
      setExpiresAt('')
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErr({ form: e.message })
        toast(e.message, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (zones.length === 0) {
    return (
      <div>
        <PageHeader title="申请子域名" />
        <div className="card p-4">
          <div className="text-sm text-gray-500">
            当前没有可申请的（已启用的）根域名，请联系管理员添加。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="申请子域名" desc="选择根域名，填写前缀与目标，提交后等待审批或自动开通" />
      <div className="card p-5 max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">根域名</label>
            <select className="input" value={zoneId} onChange={(e) => onZoneChange(e.target.value)}>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.root_domain}
                  {z.auto_approve ? '（自动审批）' : ''}
                </option>
              ))}
            </select>
            <FieldError msg={err.zone_id} />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label">子域名前缀</label>
              <input
                className="input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toLowerCase())}
                placeholder="例如 myapp"
              />
              <FieldError msg={err.prefix} />
            </div>
            <div className="px-2 pb-2 text-gray-400">.</div>
            <div className="w-48">
              <label className="label">根域名</label>
              <div className="input bg-gray-50 text-gray-500">
                {selectedZone?.root_domain ?? ''}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">记录类型</label>
              <select
                className="input"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">TTL（秒）</label>
              <input
                className="input"
                type="number"
                min={60}
                max={86400}
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">目标内容</label>
            <input
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                recordType === 'CNAME'
                  ? 'example.com'
                  : recordType === 'A'
                  ? '1.2.3.4'
                  : recordType === 'AAAA'
                  ? '2001:db8::1'
                  : '文本记录'
              }
            />
            <FieldError msg={err.target} />
          </div>

          <div className="flex items-center gap-4">
            {canProxy && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={proxied}
                  onChange={(e) => setProxied(e.target.checked)}
                />
                启用 Cloudflare 代理（Proxied）
              </label>
            )}
          </div>

          <div>
            <label className="label">到期时间（可选）</label>
            <input
              className="input"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <div className="text-xs text-gray-400 mt-1">
              留空表示长期有效；到期后将由每日 Cron 自动删除 DNS 记录。
            </div>
          </div>

          {err.form && <div className="text-xs text-red-600">{err.form}</div>}

          <button className="btn-primary" disabled={loading}>
            {loading ? '提交中…' : '提交申请'}
          </button>
        </form>

        {result && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
            <div>
              完整域名：<span className="font-medium">{result.full_domain}</span>
            </div>
            <div className="mt-1">
              状态：
              <span className="font-medium">{result.status}</span>
              {result.status === 'active' && '（已自动开通）'}
              {result.status === 'pending' && '（等待管理员审批）'}
              {result.status === 'error' && '（DNS 创建失败，可在「我的子域名」重试）'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
