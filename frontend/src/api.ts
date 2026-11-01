import type { ApiError } from './types'

// 统一 API 客户端：同源部署，携带 Cookie，处理 401 跳登录。
class ApiClientError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // 未登录或会话过期：跳转登录页（公开页除外，避免 /setup 等页面被弹走）
    if (typeof window !== 'undefined') {
      const p = window.location.pathname
      const isPublic = p === '/' || p.startsWith('/login') || p.startsWith('/setup')
      if (!isPublic) {
        window.location.href = '/login'
      }
    }
    throw new ApiClientError('UNAUTHENTICATED', '未登录或会话已过期', 401)
  }

  let json: any = null
  try {
    json = await res.json()
  } catch {
    throw new ApiClientError('PARSE_ERROR', '响应解析失败', res.status)
  }

  if (!json || json.ok !== true) {
    const err: ApiError = json?.error ?? { code: 'ERROR', message: '请求失败' }
    throw new ApiClientError(err.code, err.message, res.status)
  }
  return json.data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}

export { ApiClientError }
