import { useState, ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth, useTheme } from '../context'
import { Icon } from './ui'

const USER_NAV = [
  { to: '/u/dashboard', label: '概览', icon: 'home' },
  { to: '/u/apply', label: '申请子域名', icon: 'dns' },
  { to: '/u/subdomains', label: '我的子域名', icon: 'public' },
  { to: '/u/settings', label: '账户设置', icon: 'settings' },
]
const ADMIN_NAV = [
  { to: '/a/dashboard', label: '仪表盘', icon: 'home' },
  { to: '/a/zones', label: '根域名', icon: 'dns' },
  { to: '/a/approvals', label: '申请审批', icon: 'approval' },
  { to: '/a/subdomains', label: '子域名', icon: 'public' },
  { to: '/a/users', label: '用户', icon: 'people' },
  { to: '/a/settings', label: '系统设置', icon: 'settings' },
  { to: '/a/audit', label: '审计日志', icon: 'history' },
]

function Brand() {
  return (
    <div
      className="flex items-center gap-2 px-5 h-14 border-b border-outline-variant"
      style={{ borderColor: 'var(--md-outline-variant)' }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'var(--md-primary)', color: 'var(--md-on-primary)' }}
      >
        <Icon name="public" size={18} />
      </div>
      <span className="font-medium text-on-surface">子域名分发</span>
    </div>
  )
}

function NavItems({
  items,
  onNavigate,
}: {
  items: { to: string; label: string; icon: string }[]
  onNavigate: () => void
}) {
  return (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors hover-bg-high"
          style={({ isActive }) =>
            isActive
              ? {
                  background: 'var(--md-primary-container)',
                  color: 'var(--md-on-primary-container)',
                }
              : { color: 'var(--md-on-surface-variant)' }
          }
        >
          <Icon name={it.icon} size={20} />
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      className="w-10 h-10 rounded-full flex items-center justify-center hover-bg-high"
      style={{ color: 'var(--md-on-surface-variant)' }}
    >
      <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} />
    </button>
  )
}

function RailContent({
  items,
  onNavigate,
}: {
  items: { to: string; label: string; icon: string }[]
  onNavigate: () => void
}) {
  const { user, logout } = useAuth()
  return (
    <>
      <Brand />
      <NavItems items={items} onNavigate={onNavigate} />
      <div
        className="px-4 py-3 text-xs border-t"
        style={{
          borderColor: 'var(--md-outline-variant)',
          color: 'var(--md-on-surface-variant)',
        }}
      >
        <div className="truncate">{user?.email}</div>
        <button
          onClick={logout}
          className="mt-2 flex items-center gap-1 hover-bg-high rounded-full px-2 py-1"
          style={{ color: 'var(--md-on-surface-variant)' }}
        >
          <Icon name="logout" size={16} /> 退出登录
        </button>
      </div>
    </>
  )
}

function Shell({
  role,
  children,
}: {
  role: 'user' | 'admin'
  children: ReactNode
}) {
  const items = role === 'admin' ? ADMIN_NAV : USER_NAV
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  const title =
    (role === 'admin' ? ADMIN_NAV : USER_NAV).find((i) => pathname.startsWith(i.to))
      ?.label ?? '子域名分发'

  return (
    <div className="min-h-screen bg-surface">
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[248px] bg-surface-container-lowest border-r border-outline-variant">
        <RailContent items={items} onNavigate={() => setDrawer(false)} />
      </aside>

      {drawer && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'var(--md-scrim)' }}
          onClick={() => setDrawer(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-[248px] bg-surface-container-lowest border-r border-outline-variant flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <RailContent items={items} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="md:ml-[248px]">
        <header
          className="sticky top-0 z-30 bg-surface border-b h-14 flex items-center justify-between px-4"
          style={{ borderColor: 'var(--md-outline-variant)' }}
        >
          <div className="flex items-center gap-2">
            <button
              className="md:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover-bg-high"
              style={{ color: 'var(--md-on-surface-variant)' }}
              onClick={() => setDrawer(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="font-medium text-on-surface">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

export function UserLayout({ children }: { children: ReactNode }) {
  return <Shell role="user">{children}</Shell>
}
export function AdminLayout({ children }: { children: ReactNode }) {
  return <Shell role="admin">{children}</Shell>
}
