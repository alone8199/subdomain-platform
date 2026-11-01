import { useState, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import { useToast } from '../context'

interface NavItem {
  to: string
  label: string
}

export function AppLayout({
  nav,
  children,
}: {
  nav: NavItem[]
  children: ReactNode
}) {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast('已退出登录', 'info')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* 侧边栏（桌面固定，移动折叠） */}
      <aside
        className={`${
          open ? 'block' : 'hidden'
        } md:block fixed md:static z-30 w-56 bg-white border-r border-gray-200 h-screen overflow-y-auto`}
      >
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-800">域名分发平台</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {user?.role === 'admin' ? '管理员后台' : '用户中心'}
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 z-20">
          <button
            className="md:hidden btn-secondary btn-sm"
            onClick={() => setOpen((v) => !v)}
          >
            菜单
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button className="btn-secondary btn-sm" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export function UserLayout({ children }: { children: ReactNode }) {
  const nav: NavItem[] = [
    { to: '/u/dashboard', label: '概览' },
    { to: '/u/apply', label: '申请子域名' },
    { to: '/u/subdomains', label: '我的子域名' },
    { to: '/u/settings', label: '账户设置' },
  ]
  return <AppLayout nav={nav}>{children}</AppLayout>
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const nav: NavItem[] = [
    { to: '/a/dashboard', label: '仪表盘' },
    { to: '/a/zones', label: '根域名管理' },
    { to: '/a/approvals', label: '申请审批' },
    { to: '/a/subdomains', label: '全部子域名' },
    { to: '/a/users', label: '用户管理' },
    { to: '/a/settings', label: '系统设置' },
    { to: '/a/audit', label: '审计日志' },
  ]
  return <AppLayout nav={nav}>{children}</AppLayout>
}
