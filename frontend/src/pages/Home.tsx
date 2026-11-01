import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../context'
import { Icon, Button } from '../components/ui'

const FEATURES = [
  {
    icon: 'bolt',
    title: '申请即开通',
    desc: '提交子域名申请后自动创建 DNS 记录并激活，无需等待人工审批，秒级可用。',
  },
  {
    icon: 'dns',
    title: '多根域名管理',
    desc: '接入任意数量的根域名，独立配置允许的记录类型、TTL 与保留词。',
  },
  {
    icon: 'speed',
    title: 'Cloudflare 边缘解析',
    desc: 'DNS 记录直接创建在你的 Cloudflare Zone 中，全球边缘节点承载解析。',
  },
  {
    icon: 'lock',
    title: '配额与安全',
    desc: '按用户限制子域名数量与每月申请次数，保留词保护，全程审计日志。',
  },
  {
    icon: 'schedule',
    title: '到期自动回收',
    desc: '为子域名设置有效期，每日定时任务自动清理过期记录，释放资源。',
  },
  {
    icon: 'dark_mode',
    title: '明暗双主题',
    desc: '精心设计的玻璃拟态界面，浅色通透、深色沉浸，一键切换跟随喜好。',
  },
]

export default function Home() {
  const { user, loading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // 已登录用户直接进对应工作台
  useEffect(() => {
    if (!loading && user) {
      navigate(user.role === 'admin' ? '/a/dashboard' : '/u/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  return (
    <div className="min-h-screen bg-surface">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ui-primary)', color: 'var(--ui-on-primary)' }}
          >
            <Icon name="public" size={18} />
          </div>
          <span className="font-medium text-on-surface">子域名分发平台</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover-bg-high transition-colors"
            style={{ color: 'var(--ui-on-surface-variant)' }}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          <Button variant="primary" onClick={() => navigate('/login')}>
            登录
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-4 pt-16 pb-12 md:pt-24">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs mb-6"
          style={{
            background: 'var(--ui-primary-container)',
            color: 'var(--ui-on-primary-container)',
          }}
        >
          <Icon name="bolt" size={14} />
          自动开通 · 秒级生效
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-on-surface leading-tight">
          你的二级域名
          <br />
          <span
            style={{
              background: 'var(--ui-gradient)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            一申请就能用
          </span>
        </h1>
        <p className="mt-5 text-base md:text-lg text-on-surface-variant max-w-xl mx-auto">
          基于 Cloudflare Workers 的子域名分发平台。选择根域名、填写前缀、提交即自动创建
          DNS 记录，解析直达 Cloudflare 全球边缘网络。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="primary" onClick={() => navigate('/login')}>
            立即开始
            <Icon name="arrow_forward" size={18} />
          </Button>
          <Button variant="outlined" onClick={() => navigate('/login')}>
            管理员登录
          </Button>
        </div>
      </section>

      {/* 特性卡片 */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: 'var(--ui-primary-container)',
                  color: 'var(--ui-on-primary-container)',
                }}
              >
                <Icon name={f.icon} size={20} />
              </div>
              <h3 className="font-medium text-on-surface mb-1">{f.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 底部 */}
      <footer className="border-t py-6 text-center text-xs text-on-surface-variant"
        style={{ borderColor: 'var(--ui-outline-variant)' }}
      >
        子域名分发平台 · Powered by Cloudflare Workers
      </footer>
    </div>
  )
}
