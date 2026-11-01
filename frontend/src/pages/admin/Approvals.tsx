import { useEffect, useState, useCallback } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import {
  PageHeader,
  Spinner,
  EmptyState,
  Modal,
  FieldError,
  Button,
  Input,
  Select,
  TextArea,
  Checkbox,
} from '../../components/ui'
import type { Subdomain, Zone } from '../../types'

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

export default function AdminApprovals() {
  const { toast } = useToast()
  const [list, setList] = useState<Subdomain[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneFilter, setZoneFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 拒绝弹窗
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [rejectErr, setRejectErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subs, z] = await Promise.all([
        api.get<Subdomain[]>('/api/admin/approvals' + (zoneFilter ? `?zone_id=${zoneFilter}` : '')),
        api.get<Zone[]>('/api/admin/zones'),
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

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const approve = async (id: string) => {
    try {
      await api.post(`/api/admin/approvals/${id}/approve`)
      toast('已通过', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const submitReject = async () => {
    if (!rejectId) return
    setRejectErr('')
    try {
      await api.post(`/api/admin/approvals/${rejectId}/reject`, { reason })
      toast('已拒绝', 'info')
      setRejectId(null)
      setReason('')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) setRejectErr(e.message)
    }
  }

  const bulkApprove = async () => {
    if (selected.size === 0) return
    try {
      const r = await api.post<{ results: { id: string; ok: boolean; message?: string }[] }>(
        '/api/admin/approvals/bulk-approve',
        { ids: Array.from(selected) },
      )
      const failed = r.results.filter((x) => !x.ok)
      toast(failed.length ? `完成，其中 ${failed.length} 个失败` : '批量通过成功', failed.length ? 'error' : 'success')
      setSelected(new Set())
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="申请审批" desc="手动审批模式下，pending 申请需在此通过或拒绝" />
      <div className="card">
        <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: 'var(--md-outline-variant)' }}>
          <div className="flex items-center gap-2">
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
          <Button variant="primary" size="sm" disabled={selected.size === 0} onClick={bulkApprove}>
            批量通过（{selected.size}）
          </Button>
        </div>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState title="没有待审批申请" hint="用户提交申请后会出现在这里。" />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th w-8"></th>
                  <th className="th">完整域名</th>
                  <th className="th">根域名</th>
                  <th className="th">类型</th>
                  <th className="th">目标</th>
                  <th className="th">申请人</th>
                  <th className="th">提交时间</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="td">
                      <Checkbox checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                    </td>
                    <td className="td font-medium">{s.full_domain}</td>
                    <td className="td">{s.root_domain}</td>
                    <td className="td">{s.record_type}</td>
                    <td className="td max-w-xs truncate">{s.target}</td>
                    <td className="td text-xs text-gray-500">{s.user_id}</td>
                    <td className="td text-xs text-gray-500">{fmt(s.created_at)}</td>
                    <td className="td whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button variant="primary" size="sm" onClick={() => approve(s.id)}>通过</Button>
                        <Button variant="danger" size="sm" onClick={() => setRejectId(s.id)}>拒绝</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!rejectId} title="拒绝申请" onClose={() => setRejectId(null)}
        footer={
          <>
            <Button variant="outlined" onClick={() => setRejectId(null)}>取消</Button>
            <Button variant="danger" onClick={submitReject}>确认拒绝</Button>
          </>
        }
      >
        <div>
          <TextArea
            label="拒绝原因"
            rows={3}
            value={reason}
            onChange={setReason}
            placeholder="请说明拒绝原因"
          />
          <FieldError msg={rejectErr} />
        </div>
      </Modal>
    </div>
  )
}
