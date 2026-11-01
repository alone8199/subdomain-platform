import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

/* Cloudflare Turnstile 人机验证组件（零依赖，按需加载官方脚本） */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
    __turnstileReady?: () => void
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve) => {
    if (window.__turnstileReady) {
      // 已有加载中的脚本，等它的回调
      const prev = window.__turnstileReady
      window.__turnstileReady = () => {
        prev()
        resolve()
      }
      return
    }
    window.__turnstileReady = () => resolve()
    const s = document.createElement('script')
    s.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__turnstileReady'
    s.async = true
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let cancelled = false
    loadTurnstileScript().then(() => {
      if (cancelled || !elRef.current || !window.turnstile) return
      if (widgetId.current !== null) return
      widgetId.current = window.turnstile.render(elRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      })
    })
    return () => {
      cancelled = true
      if (widgetId.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          /* 已被移除 */
        }
        widgetId.current = null
      }
    }
  }, [siteKey])

  return <div ref={elRef} className="min-h-[65px]" />
}

export interface TurnstileConfig {
  enabled: boolean
  siteKey: string
}

// 获取平台人机验证配置（未启用时组件不渲染）
export function useTurnstileConfig(): TurnstileConfig | null {
  const [cfg, setCfg] = useState<TurnstileConfig | null>(null)
  useEffect(() => {
    api
      .get<{ enabled: boolean; site_key: string }>('/api/auth/turnstile')
      .then((r) =>
        setCfg(
          r.enabled && r.site_key
            ? { enabled: true, siteKey: r.site_key }
            : { enabled: false, siteKey: '' },
        ),
      )
      .catch(() => setCfg({ enabled: false, siteKey: '' }))
  }, [])
  return cfg
}
