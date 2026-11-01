import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { api } from './api'
import type { User } from './types'

// ---------------- Toast ----------------
type ToastType = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  type: ToastType
  message: string
}
interface ToastCtx {
  toast: (message: string, type?: ToastType) => void
}
const ToastContext = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// ---------------- Auth ----------------
interface AuthCtx {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3500)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const u = await api.get<User>('/api/auth/me')
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // ignore
    }
    setUser(null)
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ToastContext.Provider value={{ toast }}>
      <AuthContext.Provider value={{ user, loading, refresh, logout }}>
        {children}
        <ToastContainer items={toasts} />
      </AuthContext.Provider>
    </ToastContext.Provider>
  )
}

function ToastContainer({ items }: { items: ToastItem[] }) {
  const color: Record<ToastType, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  }
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`${color[t.type]} text-white text-sm px-4 py-2 rounded-md shadow-md max-w-sm`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
