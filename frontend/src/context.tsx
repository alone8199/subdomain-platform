import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { api } from './api'
import { Icon } from './components/ui'
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

// ---------------- Theme（明暗 + 暖色调） ----------------
type Theme = 'light' | 'dark'
interface ThemeCtx {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}
const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})
export function useTheme() {
  return useContext(ThemeContext)
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
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored =
      typeof localStorage !== 'undefined'
        ? (localStorage.getItem('theme') as Theme | null)
        : null
    return stored === 'dark' || stored === 'light' ? stored : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // ignore
    }
  }, [theme])
  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = useCallback(
    () => setThemeState((p) => (p === 'dark' ? 'light' : 'dark')),
    [],
  )

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
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
      <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
        <AuthContext.Provider value={{ user, loading, refresh, logout }}>
          {children}
          <SnackbarContainer items={toasts} />
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </ToastContext.Provider>
  )
}

function SnackbarContainer({ items }: { items: ToastItem[] }) {
  const bg: Record<ToastType, string> = {
    success: 'var(--md-surface-container-high)',
    error: 'var(--md-error-container)',
    info: 'var(--md-surface-container-high)',
  }
  const fg: Record<ToastType, string> = {
    success: 'var(--md-on-surface)',
    error: 'var(--md-on-error-container)',
    info: 'var(--md-on-surface)',
  }
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center w-full max-w-sm px-3">
      {items.map((t) => (
        <div
          key={t.id}
          className="w-full rounded-full shadow-lg px-4 py-2.5 text-sm flex items-center gap-2"
          style={{ background: bg[t.type], color: fg[t.type] }}
        >
          {t.type === 'error' && <Icon name="warning" size={18} />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
