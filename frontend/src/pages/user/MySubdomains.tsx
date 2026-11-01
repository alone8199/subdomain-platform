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

  // 编辑态
  const [editId, setEditId] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editTtl, setEditTtl] = useState('')
  const [editRecType, setEditRecType] = useState('')
  const [editErr, setEditErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  const openEdit = (s: Subdomain) => {
    setEditId(s.id)
    setEditTarget(s.target)
    setEditTtl(String(s.ttl))
    setEditRecType(s.record_type)
    setEditErr(null)
  }

  const saveEdit = async () => {
    setSaving(true)
    setEditErr(null)
    try {
      const ttlNum = Number(editTtl)
      if (!editTarget.trim()) throw new Error('请填写目标内容')
      if (!Number.isInteger(ttlNum) || ttlNum < 60 || ttlNum > 86400) {
        throw new Error('TTL 需为 60-86400 之间的整数')
      }
      await api.put(`/api/user/subdomains/${editId}`, {
        target: editTarget.trim(),
        ttl: ttlNum,
      })
      toast('已保存并同步 DNS', 'success')
      setEditId('')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) setEditErr(e.message)
      else if (e instanceof Error) setEditErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="我的子域名" desc="查看、复制、编辑、删除你申请的子域名" />
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
                        <Button variant="outlined" size="sm" onClick={() => copy(s.full_domain)}>
                          复制
                        </Button>
                        {s.status === 'active' && (
                          <Button variant="outlined" size="sm" onClick={() => openEdit(s)}>
                            编辑
                          </Button>
                        )}
                        {s.status === 'error' && (
                          <Button variant="outlined" size="sm" onClick={() => retry(s.id)}>
                            重试
                          </Button>
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

      <Modal
        open={!!editId}
        title="编辑子域名"
        onClose={() => setEditId('')}
        footer={
          <>
            <Button variant="outlined" onClick={() => setEditId('')}>
              取消
            </Button>
            <Button variant="primary" onClick={saveEdit} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="目标内容"
            value={editTarget}
            onChange={setEditTarget}
            placeholder="例如 1.2.3.4 或 target.example.com"
          />
          <Input
            label="TTL（秒）"
            value={editTtl}
            onChange={setEditTtl}
            inputMode="numeric"
          />
          <FieldError msg={editErr} />
        </div>
      </Modal>
    </div>
  )
}
