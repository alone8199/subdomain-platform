import type { Context } from 'hono'

// 从请求中提取客户端 IP（摘要），用于审计日志。
// Cloudflare 会通过 CF-Connecting-IP 头提供真实客户端 IP。
export function clientIp(c: Context): string {
  const cf = c.req.header('CF-Connecting-IP')
  if (cf) return cf
  const xff = c.req.header('X-Forwarded-For')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
