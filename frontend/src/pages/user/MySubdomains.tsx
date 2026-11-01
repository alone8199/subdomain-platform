import { useEffect, useState, useCallback } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import {
  PageHeader,
  Spinner,
  EmptyState,
  Badge,
  ConfirmButton,
  Modal,
  FieldError,
  Button,
  Input,
  Select,
} from '../../components/ui'
import type { Subdomain, ApplyZone, DnsRecord } from '../../types'

function fmt(ts: number | null) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

const RECORD_TYPE_OPTIONS = [
  { value: 'A', label: 'A — 指向 IPv4 地址' },
  { value: 'AAAA', label: 'AAAA — 指向 IPv6 地址' },
  { value: 'CNAME', label: 'CNAME — 指向另一个域名' },
  { value: 'TXT', label: 'TXT — 文本记录（验证用）' },
]

function recordFullName(sub: Subdomain, r: DnsRecord) {
  return r.name ? `${r.name}.${sub.full_domain}` : sub.full_domain
}

export default function MySubdomains() {
  const { toast } = useToast()
  const [list, setList] = useState<Subdomain[]>([])
  const [zones, setZones] = useState<ApplyZone[]>([])
  const [zoneFilter, setZoneFilter] = useState('')
  const [loading, setLoading] = useState(true)

  // 解析管理态
  const [mgrSub, setMgrSub] = useState<Subdomain | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  // 表单：编辑模式（recId 非空）只改内容/TTL；添加模式可填名称/类型
  const [formRecId, setFormRecId] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('A')
  const [formContent, setFormContent] = useState('')
  const [formTtl, setFormTtl] = useState('300')
  const [formErr, setFormErr] = useState<string | null>(null)
  const [formSaving, setFormSaving] = useState(false)

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

  // ---- 解析管理 ----
  const loadRecords = useCallback(async (subId: string) => {
    setRecordsLoading(true)
    try {
      const rows = await api.get<DnsRecord[]>(`/api/user/subdomains/${subId}/records`)
      setRecords(rows)
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    } finally {
      setRecordsLoading(false)
    }
  }, [toast])

  const openMgr = (s: Subdomain) => {
    setMgrSub(s)
    resetForm()
    loadRecords(s.id)
  }

  const closeMgr = () => {
    setMgrSub(null)
    setRecords([])
  }

  const resetForm = () => {
    setFormRecId('')
    setFormName('')
    setFormType('A')
    setFormContent('')
    setFormTtl('300')
    setFormErr(null)
  }

  const startEditRecord = (r: DnsRecord) => {
    setFormRecId(r.id)
    setFormName(r.name)
    setFormType(r.record_type)
    setFormContent(r.content)
    setFormTtl(String(r.ttl))
    setFormErr(null)
  }

  const submitRecord = async () => {
    if (!mgrSub) return
    setFormSaving(true)
    setFormErr(null)
    try {
      const ttlNum = Number(formTtl)
      if (!formContent.trim()) throw new Error('请填写记录值')
      if (!Number.isInteger(ttlNum) || ttlNum < 60 || ttlNum > 86400) {
        throw new Error('TTL 需为 60-86400 之间的整数')
      }
      if (formRecId) {
        await api.put(`/api/user/subdomains/${mgrSub.id}/records/${formRecId}`, {
          content: formContent.trim(),
          ttl: ttlNum,
        })
        toast('记录已更新并同步 DNS', 'success')
      } else {
        await api.post(`/api/user/subdomains/${mgrSub.id}/records`, {
          name: formName.trim(),
          record_type: formType,
          content: formContent.trim(),
          ttl: ttlNum,
        })
        toast('解析记录已添加并同步 DNS', 'success')
      }
      resetForm()
      loadRecords(mgrSub.id)
      load()
    } catch (e) {
      if (e instanceof ApiClientError) setFormErr(e.message)
      else if (e instanceof Error) setFormErr(e.message)
    } finally {
      setFormSaving(false)
    }
  }

  const removeRecord = async (rid: string) => {
    if (!mgrSub) return
    try {
      await api.post(`/api/user/subdomains/${mgrSub.id}/records/${rid}/delete`)
      toast('记录已删除', 'success')
      loadRecords(mgrSub.id)
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="我的子域名" desc="申请到的子域名可自由配置解析（根解析与子域解析）" />
      <div className="card">
        <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--ui-outline-variant)' }}>
          <Select
            label="按根域名筛选"
            className="w-48"
            value={zoneFilter}
            onChange={setZoneFilter}
            options={[
              { value: '', label: '全部' },
              ...zones.map((z) => ({ value: z.id, label: z.root_domain })),
            ]}
          />
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
                  <th className="th">根记录</th>
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
                    <td className="td max-w-xs truncate">
                      {s.record_type} → {s.target}
                    </td>
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
                        <Button variant="outlined" size="sm" onClick={() => copy(s.full_domain)}>
                          复制
                        </Button>
                        {s.status === 'active' && (
                          <Button variant="primary" size="sm" onClick={() => openMgr(s)}>
                            解析管理
                          </Button>
                        )}
                        {s.status === 'error' && (
                          <Button variant="outlined" size="sm" onClick={() => retry(s.id)}>
                            重试
                          </Button>
                        )}
                        <ConfirmButton
                          label="删除"
                          confirmText={`确认删除 ${s.full_domain}？其下所有解析记录（含子域解析）将同时移除。`}
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

      {/* 解析管理弹窗 */}
      <Modal
        open={!!mgrSub}
        title={`解析管理 — ${mgrSub?.full_domain ?? ''}`}
        onClose={closeMgr}
        width="wide"
      >
        <div className="space-y-4">
          <div className="text-xs text-on-surface-variant leading-relaxed">
            对该子域名独立配置解析：名称<strong>留空</strong>即根解析（指向{' '}
            <code>{mgrSub?.full_domain}</code> 本身）；填 <code>www</code> 即创建{' '}
            <code>www.{mgrSub?.full_domain ?? ''}</code>，支持多级（如 <code>a.b</code>）。
          </div>

          {/* 记录列表 */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--ui-outline-variant)' }}>
            {recordsLoading ? (
              <Spinner />
            ) : records.length === 0 ? (
              <div className="p-4 text-sm text-on-surface-variant text-center">
                暂无解析记录，在下方添加第一条。
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="th">名称</th>
                    <th className="th">类型</th>
                    <th className="th">记录值</th>
                    <th className="th">TTL</th>
                    <th className="th">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="td font-medium">
                        {r.name ? r.name : '@'}
                        {!r.name && <span className="text-xs text-on-surface-variant ml-1">（根解析）</span>}
                        {r.status === 'error' && (
                          <div className="text-xs text-red-600">{r.error_message}</div>
                        )}
                      </td>
                      <td className="td">{r.record_type}</td>
                      <td className="td max-w-xs truncate">{r.content}</td>
                      <td className="td">{r.ttl}</td>
                      <td className="td whitespace-nowrap">
                        <div className="flex gap-1">
                          <Button variant="outlined" size="sm" onClick={() => startEditRecord(r)}>
                            编辑
                          </Button>
                          <ConfirmButton
                            label="删除"
                            confirmText={`确认删除 ${recordFullName(mgrSub!, r)} 的 ${r.record_type} 记录？`}
                            onConfirm={() => removeRecord(r.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 添加 / 编辑表单 */}
          <div className="border rounded-lg p-4 space-y-3" style={{ borderColor: 'var(--ui-outline-variant)' }}>
            <div className="text-sm font-medium text-on-surface">
              {formRecId ? '编辑解析记录' : '添加解析记录'}
              {formRecId && (
                <span className="text-xs text-on-surface-variant font-normal ml-2">
                  名称与类型不可修改，如需变更请删除后重建
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!formRecId && (
                <Input
                  label={`名称（相对 ${mgrSub?.full_domain ?? ''}）`}
                  value={formName}
                  onChange={setFormName}
                  placeholder="留空 = 根解析；填 www = www.子域名"
                />
              )}
              {!formRecId && (
                <Select
                  label="记录类型"
                  value={formType}
                  onChange={setFormType}
                  options={RECORD_TYPE_OPTIONS}
                />
              )}
              <Input
                label={formType === 'A' ? '记录值（IPv4 地址）' : formType === 'AAAA' ? '记录值（IPv6 地址）' : formType === 'CNAME' ? '记录值（目标域名）' : '记录值（文本内容）'}
                value={formContent}
                onChange={setFormContent}
                placeholder={formType === 'A' ? '76.76.21.21' : formType === 'CNAME' ? 'cname.vercel-dns.com' : '内容'}
              />
              <Input
                label="TTL（秒）"
                value={formTtl}
                onChange={setFormTtl}
                inputMode="numeric"
              />
            </div>
            <FieldError msg={formErr} />
            <div className="flex gap-2">
              <Button variant="primary" onClick={submitRecord} disabled={formSaving}>
                {formSaving ? '同步中…' : formRecId ? '保存修改' : '添加记录'}
              </Button>
              {formRecId && (
                <Button variant="outlined" onClick={resetForm}>
                  取消编辑
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
