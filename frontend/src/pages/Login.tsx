import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api'
import { useAuth, useToast } from '../context'
import { Icon } from '../components/ui'

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
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--md-primary)', color: 'var(--md-on-primary)' }}
          >
            <Icon name="public" size={22} />
          </div>
          <span className="text-lg font-medium text-on-surface">子域名分发平台</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-medium text-on-surface">登录</h1>
          <p className="text-sm text-on-surface-variant mt-1 mb-4">
            使用邮箱与密码登录你的账户
          </p>
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
            {err && (
              <div className="text-xs" style={{ color: 'var(--md-error)' }}>
                {err}
              </div>
            )}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
          <div className="mt-4 text-xs text-on-surface-variant text-center">
            首次部署请先到 <a className="text-primary" href="/setup">/setup</a>{' '}
            初始化管理员
          </div>
        </div>
      </div>
    </div>
  )
}
