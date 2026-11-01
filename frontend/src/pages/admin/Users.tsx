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
} from '../../components/ui'
import type { User } from '../../types'

export default function AdminUsers() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [addErr, setAddErr] = useState('')

  // 重置密码弹窗
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetErr, setResetErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const u = await api.get<User[]>('/api/admin/users')
      setUsers(u)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddErr('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setAddErr('邮箱格式不正确')
      return
    }
    if (password.length < 8) {
      setAddErr('密码至少 8 位')
      return
    }
    try {
      await api.post('/api/admin/users', { email, password, role })
      toast('用户已创建', 'success')
      setShowAdd(false)
      setEmail('')
      setPassword('')
      setRole('user')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) setAddErr(e.message)
    }
  }

  const patchUser = async (id: string, body: { status?: string; role?: string }) => {
    try {
      await api.patch(`/api/admin/users/${id}`, body)
      toast('已更新', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  const resetPassword = async () => {
    if (!resetId) return
    setResetErr('')
    if (resetPw.length < 8) {
      setResetErr('密码至少 8 位')
      return
    }
    try {
      await api.post(`/api/admin/users/${resetId}/reset-password`, { password: resetPw })
      toast('密码已重置', 'success')
      setResetId(null)
      setResetPw('')
    } catch (e) {
      if (e instanceof ApiClientError) setResetErr(e.message)
    }
  }

  const toggleAdmin = async (id: string) => {
    try {
      await api.post(`/api/admin/users/${id}/toggle-admin`)
      toast('角色已切换', 'success')
      load()
    } catch (e) {
      if (e instanceof ApiClientError) toast(e.message, 'error')
    }
  }

  return (
    <div>
      <PageHeader title="用户管理" desc="创建用户、启用/禁用、重置密码、调整角色" />
      <div className="card">
        <div className="p-3 border-b border-gray-100 flex justify-end">
          <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>创建用户</button>
        </div>
        {loading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <EmptyState title="暂无用户" />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="th">邮箱</th>
                  <th className="th">角色</th>
                  <th className="th">状态</th>
                  <th className="th">创建时间</th>
                  <th className="th">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="td font-medium">{u.email}</td>
                    <td className="td"><Badge value={u.role} /></td>
                    <td className="td"><Badge value={u.status} /></td>
                    <td className="td text-xs text-gray-500">{new Date(u.created_at * 1000).toLocaleDateString('zh-CN')}</td>
                    <td className="td whitespace-nowrap">
                      <div className="flex gap-1 flex-wrap">
                        <button className="btn-secondary btn-sm" onClick={() => patchUser(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}>
                          {u.status === 'active' ? '禁用' : '启用'}
                        </button>
                        <button className="btn-secondary btn-sm" onClick={() => toggleAdmin(u.id)}>
                          {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                        </button>
                        <button className="btn-secondary btn-sm" onClick={() => { setResetId(u.id); setResetPw('') }}>
                          重置密码
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} title="创建用户" onClose={() => setShowAdd(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>取消</button>
            <button className="btn-primary" onClick={addUser}>创建</button>
          </>
        }
      >
        <form onSubmit={addUser} className="space-y-3">
          <div>
            <label className="label">邮箱</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">密码</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">角色</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <FieldError msg={addErr} />
        </form>
      </Modal>

      <Modal open={!!resetId} title="重置密码" onClose={() => setResetId(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResetId(null)}>取消</button>
            <button className="btn-primary" onClick={resetPassword}>确认</button>
          </>
        }
      >
        <div>
          <label className="label">新密码</label>
          <input className="input" type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
          <FieldError msg={resetErr} />
        </div>
      </Modal>
    </div>
  )
}
