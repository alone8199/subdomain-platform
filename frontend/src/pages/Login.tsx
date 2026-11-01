import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../api'
import { useAuth, useToast } from '../context'
import { Icon, Button, Input } from '../components/ui'
import { Turnstile, useTurnstileConfig } from '../components/Turnstile'

const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,31}$/

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [tsToken, setTsToken] = useState('')
  const [tsKey, setTsKey] = useState(0) // 变更可重置验证组件
  const tsCfg = useTurnstileConfig()
  const { refresh } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const resetTs = () => {
    if (tsCfg?.enabled) {
      setTsToken('')
      setTsKey((k) => k + 1)
    }
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setErr('')
    resetTs()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (mode === 'register') {
      if (!USERNAME_RE.test(username)) {
        setErr('用户名仅允许字母、数字、下划线、连字符，长度 2-32，且以字母或数字开头')
        return
      }
      if (password.length < 8) {
        setErr('密码至少 8 位')
        return
      }
      if (password !== confirm) {
        setErr('两次输入的密码不一致')
        return
      }
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await api.post('/api/auth/login', {
          username,
          password,
          cf_turnstile_token: tsToken || undefined,
        })
        resetTs()
        await refresh()
        toast('登录成功', 'success')
        const u = await api.get<{ role: string }>('/api/auth/me')
        navigate(u.role === 'admin' ? '/a/dashboard' : '/u/dashboard', {
          replace: true,
        })
      } else {
        await api.post('/api/auth/register', {
          username,
          password,
          cf_turnstile_token: tsToken || undefined,
        })
        resetTs()
        toast('注册成功，请登录', 'success')
        setConfirm('')
        setPassword('')
        setMode('login')
      }
    } catch (e) {
      resetTs()
      if (e instanceof ApiClientError) setErr(e.message)
      else setErr(mode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试')
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
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-lg font-medium pb-1 border-b-2 transition-colors"
              style={{
                color: mode === 'login' ? 'var(--ui-primary)' : 'var(--ui-on-surface-variant)',
                borderColor: mode === 'login' ? 'var(--ui-primary)' : 'transparent',
              }}
            >
              登录
            </button>
            {tsCfg?.registrationEnabled && (
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-lg font-medium pb-1 border-b-2 transition-colors"
                style={{
                  color: mode === 'register' ? 'var(--ui-primary)' : 'var(--ui-on-surface-variant)',
                  borderColor: mode === 'register' ? 'var(--ui-primary)' : 'transparent',
                }}
              >
                注册
              </button>
            )}
          </div>

          {mode === 'login' ? (
            <>
              <p className="text-sm text-on-surface-variant mt-1 mb-4">
                使用用户名与密码登录你的账户
              </p>
              <form onSubmit={submit} className="space-y-3">
                <Input
                  label="用户名"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  autoComplete="username"
                  required
                />
                <Input
                  label="密码"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  required
                />
                {tsCfg?.enabled && (
                  <Turnstile
                    key={tsKey}
                    siteKey={tsCfg.siteKey}
                    onToken={setTsToken}
                  />
                )}
                {err && (
                  <div className="text-xs" style={{ color: 'var(--ui-error)' }}>
                    {err}
                  </div>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  fullWidth
                  disabled={loading || (tsCfg?.enabled === true && !tsToken)}
                >
                  {loading ? '登录中…' : '登录'}
                </Button>
              </form>
              {tsCfg?.registrationEnabled && (
                <div className="text-xs text-on-surface-variant mt-4 text-center">
                  还没有账号？
                  <button
                    type="button"
                    className="ml-1 font-medium"
                    style={{ color: 'var(--ui-primary)' }}
                    onClick={() => switchMode('register')}
                  >
                    立即注册
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-on-surface-variant mt-1 mb-4">
                创建一个新账号，即可申请子域名
              </p>
              <form onSubmit={submit} className="space-y-3">
                <Input
                  label="用户名"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  placeholder="字母/数字/下划线/连字符，2-32 位"
                  autoComplete="username"
                  required
                />
                <Input
                  label="密码"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="至少 8 位"
                  autoComplete="new-password"
                  required
                />
                <Input
                  label="确认密码"
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  required
                />
                {tsCfg?.enabled && (
                  <Turnstile
                    key={tsKey}
                    siteKey={tsCfg.siteKey}
                    onToken={setTsToken}
                  />
                )}
                {err && (
                  <div className="text-xs" style={{ color: 'var(--ui-error)' }}>
                    {err}
                  </div>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  fullWidth
                  disabled={loading || (tsCfg?.enabled === true && !tsToken)}
                >
                  {loading ? '注册中…' : '注册'}
                </Button>
              </form>
              <div className="text-xs text-on-surface-variant mt-4 text-center">
                已有账号？
                <button
                  type="button"
                  className="ml-1 font-medium"
                  style={{ color: 'var(--ui-primary)' }}
                  onClick={() => switchMode('login')}
                >
                  去登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
