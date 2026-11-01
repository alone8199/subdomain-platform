import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api'
import { useToast } from '../context'
import { Icon, Button, Input } from '../components/ui'

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
      await api.post<{ initialized: boolean }>('/api/auth/setup', {
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
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ui-primary)', color: 'var(--ui-on-primary)' }}
          >
            <Icon name="public" size={22} />
          </div>
          <span className="text-lg font-medium text-on-surface">子域名分发平台</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-medium text-on-surface">初始化管理员</h1>
          <p className="text-sm text-on-surface-variant mt-1 mb-4">
            需要环境变量 <code>SETUP_TOKEN</code> 才能初始化
          </p>
          <form onSubmit={submit} className="space-y-3">
            <Input
              label="SETUP_TOKEN"
              type="password"
              value={token}
              onChange={setToken}
              placeholder="环境变量 SETUP_TOKEN 的值"
              required
            />
            {msg && (
              <div className="text-xs" style={{ color: 'var(--ui-primary)' }}>
                {msg}
              </div>
            )}
            {err && (
              <div className="text-xs" style={{ color: 'var(--ui-error)' }}>
                {err}
              </div>
            )}
            <Button variant="primary" type="submit" fullWidth disabled={loading}>
              {loading ? '初始化中…' : '初始化'}
            </Button>
          </form>
          <div className="mt-4 text-xs text-on-surface-variant">
            管理员邮箱与初始密码取自环境变量 ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD。
          </div>
        </div>
      </div>
    </div>
  )
}
