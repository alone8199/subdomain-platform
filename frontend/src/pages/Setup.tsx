import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api'
import { useToast } from '../context'
import { PageHeader } from '../components/ui'

export default function Setup() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setLoading(true)
    try {
      const r = await api.post<{ initialized: boolean }>('/api/auth/setup', {
        setupToken: token,
      })
      setMsg('管理员初始化成功，请使用环境变量中的管理员邮箱与密码登录。')
      toast('初始化成功', 'success')
      setTimeout(() => navigate('/login'), 800)
    } catch (e) {
      if (e instanceof ApiClientError) setErr(e.message)
      else setErr('初始化失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="card w-full max-w-sm p-6">
        <PageHeader title="初始化管理员" desc="需要 SETUP_TOKEN（来自环境变量）" />
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">SETUP_TOKEN</label>
            <input
              className="input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="环境变量 SETUP_TOKEN 的值"
              required
            />
          </div>
          {msg && <div className="text-xs text-green-600">{msg}</div>}
          {err && <div className="text-xs text-red-600">{err}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '初始化中…' : '初始化'}
          </button>
        </form>
        <div className="mt-4 text-xs text-gray-400">
          管理员邮箱与初始密码取自环境变量 ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD。
        </div>
      </div>
    </div>
  )
}
