import { useState } from 'react'
import { api, ApiClientError } from '../../api'
import { useToast } from '../../context'
import { PageHeader, FieldError } from '../../components/ui'

export default function UserSettings() {
  const { toast } = useToast()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const [okMsg, setOkMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr({})
    setOkMsg('')
    if (newPassword.length < 8) {
      setErr({ new_password: '新密码至少 8 位' })
      return
    }
    setLoading(true)
    try {
      await api.post('/api/user/settings/password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      setOkMsg('密码已更新')
      toast('密码已更新', 'success')
      setOldPassword('')
      setNewPassword('')
    } catch (e) {
      if (e instanceof ApiClientError) setErr({ form: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="账户设置" />
      <div className="card p-5 max-w-md">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">原密码</label>
            <input
              className="input"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">新密码</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <FieldError msg={err.new_password} />
          </div>
          {err.form && <div className="text-xs text-red-600">{err.form}</div>}
          {okMsg && <div className="text-xs text-green-600">{okMsg}</div>}
          <button className="btn-primary" disabled={loading}>
            {loading ? '保存中…' : '保存'}
          </button>
        </form>
      </div>
    </div>
  )
}
