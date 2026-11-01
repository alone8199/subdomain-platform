import { useEffect, useState, useCallback } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import {
  PageHeader,
  Spinner,
  EmptyState,
  Badge,
  Modal,
  ConfirmButton,
  FieldError,
  Button,
  Input,
  Checkbox,
} from '../../components/ui'
import type { Zone } from '../../types'

function zoneIdShort(id: string) {
  return id.length > 10 ? id.slice(0, 6) + '…' + id.slice(-4) : id
}

export default function AdminZones() {
  const { toast } = useToast()
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)

  // 新增表单
  const [showAdd, setShowAdd] = useState(false)
  const [rootDomain, setRootDomain] = useState('')
  const [addErr, setAddErr] = useState('')

  // 编辑表单
  const [edit, setEdit] = useState<Zone | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const z = await api.get<Zone[]>('/api/admin/zones')
      setZones(z)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addZone = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddErr('')
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(rootDomain)) {
      setAddErr('根域名格式不正确（如 example.com）')
      return
    }
    try {
      await api.post('/api/admin/zones', { root_domain: rootDomain.trim().toLowerCase() })
      toast('根域名已添加并校验', 'success')
      setShowAdd(false)
      setRootDomain('')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) setAddErr(e.message)
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    try {
      await api.put(`/api/admin/zones/${edit.id}`, {
        enabled: !!edit.enabled,
        default_ttl: edit.default_ttl,
        allowed_types: edit.allowed_types,
        reserved_words: edit.reserved_words,
        note: edit.note,
      })
      toast('已保存', 'success')
      setEdit(null)
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const remove = async (id: string) => {
    try {
      await api.del(`/api/admin/zones/${id}`)
      toast('已删除', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const verify = async (id: string) => {
    try {
      const r = await api.post<{ match: boolean; cloudflare_zone_id: string }>(
        `/api/admin/zones/${id}/verify`,
      )
      toast(r.match ? '校验通过，Zone ID 一致' : '校验通过，但 Zone ID 不一致，请核对', r.match ? 'success' : 'info')
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="根域名管理" desc="接入多个根域名，各自独立配置与状态" />
      <div className="card">
        <div className="p-3 border-b flex justify-end" style={{ borderColor: 'var(--ui-outline-variant)' }}>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            添加根域名
          </Button>
        </div>
        {loading ? (
          <Spinner />
        ) : zones.length === 0 ? (
          <EmptyState
            title="还没有根域名"
            hint="点击右上角「添加根域名」，填写已托管到 Cloudflare 的域名，系统会校验 Token 权限并保存 Zone ID。"
          />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">根域名</th>
                  <th className="th">Zone ID</th>
                  <th className="th">启用</th>
                  <th className="th">自动审批</th>
                  <th className="th">总数</th>
                  <th className="th">活跃</th>
                  <th className="th">待审批</th>
                  <th className="th">创建时间</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td className="td font-medium">{z.root_domain}</td>
                    <td className="td text-xs text-gray-500">{zoneIdShort(z.cloudflare_zone_id)}</td>
                    <td className="td">
                      {z.enabled ? <Badge value="active" /> : <Badge value="disabled" />}
                    </td>
                    <td className="td">{z.auto_approve ? '开' : '关'}</td>
                    <td className="td">{z.summary?.total ?? 0}</td>
                    <td className="td">{z.summary?.active ?? 0}</td>
                    <td className="td">{z.summary?.pending ?? 0}</td>
                    <td className="td text-xs text-gray-500">
                      {new Date(z.created_at * 1000).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="td whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button variant="outlined" size="sm" onClick={() => setEdit(z)}>
                          编辑
                        </Button>
                        <Button variant="outlined" size="sm" onClick={() => verify(z.id)}>
                          校验
                        </Button>
                        <ConfirmButton
                          label="删除"
                          confirmText={`确认删除根域名 ${z.root_domain}？若其下仍有活跃/待处理子域名将被阻止。`}
                          onConfirm={() => remove(z.id)}
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

      {/* 新增 */}
      <Modal open={showAdd} title="添加根域名" onClose={() => setShowAdd(false)}
        footer={
          <>
            <Button variant="outlined" onClick={() => setShowAdd(false)}>取消</Button>
            <Button variant="primary" onClick={addZone}>添加</Button>
          </>
        }
      >
        <div>
          <Input
            label="根域名"
            value={rootDomain}
            onChange={setRootDomain}
            placeholder="example.com"
          />
          <FieldError msg={addErr} />
          <div className="text-xs text-gray-400 mt-2">
            系统会通过 Cloudflare API 校验该域名是否已在你的账户中，并保存 Zone ID。Token 需具备 Zone:Read 与 DNS:Edit 权限。
          </div>
        </div>
      </Modal>

      {/* 编辑 */}
      <Modal open={!!edit} title="编辑根域名" onClose={() => setEdit(null)}
        footer={
          <>
            <Button variant="outlined" onClick={() => setEdit(null)}>取消</Button>
            <Button variant="primary" onClick={saveEdit}>保存</Button>
          </>
        }
      >
        {edit && (
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="text-sm text-gray-500">根域名：{edit.root_domain}</div>
            <Checkbox
              checked={!!edit.enabled}
              onChange={(v) => setEdit({ ...edit, enabled: v ? 1 : 0 })}
              label="启用（禁用后不可再申请，已有子域名不受影响）"
            />
            <Input
              label="默认 TTL（秒）"
              type="number"
              value={edit.default_ttl}
              onChange={(v) => setEdit({ ...edit, default_ttl: Number(v) })}
            />
            <Input
              label="允许记录类型（逗号分隔）"
              value={edit.allowed_types}
              onChange={(v) => setEdit({ ...edit, allowed_types: v })}
            />
            <Input
              label="保留词（逗号分隔）"
              value={edit.reserved_words}
              onChange={(v) => setEdit({ ...edit, reserved_words: v })}
            />
            <Input
              label="备注"
              value={edit.note}
              onChange={(v) => setEdit({ ...edit, note: v })}
            />
          </form>
        )}
      </Modal>
    </div>
  )
}
