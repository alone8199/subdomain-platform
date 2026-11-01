import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from './context'
import { Spinner } from './components/ui'
import {
  UserLayout,
  AdminLayout,
} from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import UserDashboard from './pages/user/Dashboard'
import UserApply from './pages/user/Apply'
import UserSubdomains from './pages/user/MySubdomains'
import UserSettings from './pages/user/Settings'
import AdminDashboard from './pages/admin/Dashboard'
import AdminZones from './pages/admin/Zones'
import AdminApprovals from './pages/admin/Approvals'
import AdminSubdomains from './pages/admin/Subdomains'
import AdminUsers from './pages/admin/Users'
import AdminSettings from './pages/admin/Settings'
import AdminAudit from './pages/admin/Audit'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner label="验证登录状态…" />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function RoleRoute({ admin, children }: { admin: boolean; children: JSX.Element }) {
  const { user } = useAuth()
  if (admin && user?.role !== 'admin') return <Navigate to="/u/dashboard" replace />
  if (!admin && user?.role === 'admin') return <Navigate to="/a/dashboard" replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/a/dashboard' : '/u/dashboard'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />

      {/* 用户中心 */}
      <Route
        path="/u"
        element={
          <RequireAuth>
            <RoleRoute admin={false}>
              <UserLayout>
                <Outlet />
              </UserLayout>
            </RoleRoute>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/u/dashboard" replace />} />
        <Route path="dashboard" element={<UserDashboard />} />
        <Route path="apply" element={<UserApply />} />
        <Route path="subdomains" element={<UserSubdomains />} />
        <Route path="settings" element={<UserSettings />} />
      </Route>

      {/* 管理员后台 */}
      <Route
        path="/a"
        element={
          <RequireAuth>
            <RoleRoute admin={true}>
              <AdminLayout>
                <Outlet />
              </AdminLayout>
            </RoleRoute>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/a/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="zones" element={<AdminZones />} />
        <Route path="approvals" element={<AdminApprovals />} />
        <Route path="subdomains" element={<AdminSubdomains />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
