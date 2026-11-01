import { useEffect, useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, FieldError, Badge, Button, Input, Select } from '../../components/ui'
import { Turnstile, useTurnstileConfig } from '../../components/Turnstile'
import type { ApplyZone } from '../../types'

function validatePrefix(
  prefix: string,
  zone?: ApplyZone,
): { ok: boolean; msg?: string } {
  if (!prefix) return { ok: false }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix))
    return {
      ok: false,
      msg: '仅限小写字母、数字、连字符，且不能以连字符开头或结尾（1-63 位）',
    }
  if (zone) {
    const words = zone.reserved_words
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
    if (words.includes(prefix.toLowerCase()))
      return { ok: false, msg: `「${prefix}」为保留词，不可使用` }
  }
  return { ok: true }
}

export default function UserApply() {
  const { toast } = useToast()
  const [zones, setZones] = useState<ApplyZone[]>([])
  const [zoneId, setZoneId] = useState('')
  const [prefix, setPrefix] = useState('')
  const [recordType, setRecordType] = useState('CNAME')
  const [target, setTarget] = useState('')
  const [ttl, setTtl] = useState<number>(300)
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ full_domain: string; status: string } | null>(null)
  const [tsToken, setTsToken] = useState('')
  const [tsKey, setTsKey] = useState(0)
  const tsCfg = useTurnstileConfig()

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
  const prefixCheck = validatePrefix(prefix, selectedZone)

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
    const pc = validatePrefix(prefix, selectedZone)
    if (!pc.ok) next.prefix = pc.msg ?? '前缀不合法'
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
          expires_at: expiresAt
            ? Math.floor(new Date(expiresAt).getTime() / 1000)
            : null,
          cf_turnstile_token: tsToken || undefined,
        },
      )
      if (tsCfg?.enabled) {
        setTsToken('')
        setTsKey((k) => k + 1)
      }
      setResult(r)
      toast('申请已提交并自动开通', 'success')
      setPrefix('')
      setTarget('')
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
        <div className="card p-5 text-on-surface-variant text-sm">
          当前没有可申请的（已启用的）根域名，请联系管理员添加。
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="申请子域名"
        desc="选择根域名，填写前缀与目标，提交后自动开通（无需审批，可直接用于解析）"
      />
      <div className="card p-5 max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Select
              label="根域名"
              value={zoneId}
              onChange={onZoneChange}
              options={zones.map((z) => ({ value: z.id, label: z.root_domain }))}
            />
            <FieldError msg={err.zone_id} />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="子域名前缀"
                value={prefix}
                onChange={(v) => setPrefix(v.toLowerCase())}
                placeholder="例如 myapp"
              />
              {prefix && !prefixCheck.ok && (
                <FieldError msg={prefixCheck.msg} />
              )}
              {prefix && prefixCheck.ok && (
                <div
                  className="text-xs mt-1 flex items-center gap-1"
                  style={{ color: 'var(--ui-primary)' }}
                >
                  可用
                </div>
              )}
            </div>
            <div className="px-2 pb-2 text-on-surface-variant">.</div>
            <div className="w-48">
              <Input
                label="根域名"
                value={selectedZone?.root_domain ?? ''}
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                label="记录类型"
                value={recordType}
                onChange={setRecordType}
                options={allowedTypes.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div>
              <Input
                label="TTL（秒）"
                type="number"
                value={ttl}
                onChange={(v) => setTtl(Number(v))}
              />
            </div>
          </div>

          <div>
            <Input
              label="目标内容"
              value={target}
              onChange={setTarget}
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

          <div>
            <Input
              label="到期时间（可选）"
              type="datetime-local"
              value={expiresAt}
              onChange={setExpiresAt}
            />
            <div className="text-xs text-on-surface-variant mt-1">
              留空表示长期有效；到期后将由每日 Cron 自动删除 DNS 记录。
            </div>
          </div>

          {err.form && (
            <div className="text-xs" style={{ color: 'var(--ui-error)' }}>
              {err.form}
            </div>
          )}

          {tsCfg?.enabled && (
            <Turnstile key={tsKey} siteKey={tsCfg.siteKey} onToken={setTsToken} />
          )}

          <Button
            variant="primary"
            type="submit"
            disabled={loading || (tsCfg?.enabled === true && !tsToken)}
          >
            {loading ? '提交中…' : '提交申请'}
          </Button>
        </form>

        {result && (
          <div
            className="mt-4 p-4 rounded-md flex items-start gap-3"
            style={{
              background: 'var(--ui-surface-container-high)',
              color: 'var(--ui-on-surface)',
            }}
          >
            <div className="pt-0.5">
              <Badge value={result.status} />
            </div>
            <div className="text-sm">
              <div>
                完整域名：
                <span className="font-medium">{result.full_domain}</span>
              </div>
              <div className="mt-1 text-on-surface-variant">
                {result.status === 'active'
                  ? '已自动开通，可直接用于解析。'
                  : '已提交。'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
