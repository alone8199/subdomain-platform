import type { Context } from 'hono'

// 统一响应结构: { ok, data, error }
// 注：Hono 的 c.json 第二个参数要求状态码联合类型，这里用 as any 放宽（值为标准 HTTP 状态码）。
export function ok<T>(c: Context, data: T, status: number = 200) {
  return c.json({ ok: true, data }, status as any)
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: number = 400,
) {
  return c.json({ ok: false, error: { code, message } }, status as any)
}
