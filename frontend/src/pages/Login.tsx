import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api'
import { useAuth, useToast } from '../context'
import { PageHeader } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const { refresh } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      await api.post('/api/auth/login', { email, password })
      await refresh()
      toast('登录成功', 'success')
      // 跳转由 RootRedirect 或刷新后的角色决定
      const u = await api.get<{ role: string }>('/api/auth/me')
      navigate(u.role === 'admin' ? '/a/dashboard' : '/u/dashboard', {
        replace: true,
      })
    } catch (e) {
      if (e instanceof ApiClientError) setErr(e.message)
      else setErr('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="card w-full max-w-sm p-6">
        <PageHeader title="登录" desc="二级域名分发平台" />
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">邮箱</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label">密码</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <div className="mt-4 text-xs text-gray-400 text-center">
          首次部署请先到 <a className="text-brand-600" href="/setup">/setup</a> 初始化管理员
        </div>
      </div>
    </div>
  )
}
