// 二级域名分发平台 — 演示服务器
// 用途：把构建好的前端（/workspace/dist）+ 一份内存版 mock 后端打包成
// 一个单端口 HTTP 服务，用于「发布为应用」预览 UI 与交互。
// 注意：这不是真实后端，数据仅存内存，重启即重置。真实部署请用 Cloudflare Workers 源码。

import { createServer } from 'http'
import { readFile, stat } from 'fs/promises'
import { extname, join, normalize, sep, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID, randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = normalize(join(__dirname, '..', 'dist'))
const PORT = Number(process.env.PORT) || 3000

const now = () => Math.floor(Date.now() / 1000)
const rand = (n = 10) => randomBytes(n).toString('hex')
const rid = () => 'rec_' + rand(8)
// 解析记录表（模拟 dns_records）：每条子域名可有多条记录，name ''/'@' 表示根解析
const dnsRecords = []
const mkRecord = (subId, userId, name, type, content, ttl = 300) => ({
  id: randomUUID(), subdomain_id: subId, user_id: userId, name,
  record_type: type, content, ttl, cf_record_id: rid(),
  status: 'active', error_message: null, created_at: now(), updated_at: now(),
})
const zid = () => 'zone_' + rand(8)

// ---------------- 内存数据 ----------------
const users = [
  { id: 'u_admin', email: 'admin@demo.com', role: 'admin', status: 'active', created_at: now() - 86400 * 60 },
  { id: 'u_user', email: 'user@demo.com', role: 'user', status: 'active', created_at: now() - 86400 * 30 },
  { id: 'u_bob', email: 'bob@example.com', role: 'user', status: 'active', created_at: now() - 86400 * 20 },
  { id: 'u_alice', email: 'alice@example.com', role: 'user', status: 'disabled', created_at: now() - 86400 * 15 },
]

const zones = [
  {
    id: 'z1', root_domain: 'example.com', cloudflare_zone_id: zid(),
    cloudflare_account_id: 'acct_demo_001', enabled: 1, auto_approve: 1,
    default_ttl: 3600, allowed_types: 'CNAME,A,AAAA,TXT',
    reserved_words: 'www,mail,api,admin,root,ns1,ns2,ftp,webmail,ns,mx',
    note: '主域名，自动审批', created_at: now() - 86400 * 40, updated_at: now() - 86400 * 5,
  },
  {
    id: 'z2', root_domain: 'example.net', cloudflare_zone_id: zid(),
    cloudflare_account_id: 'acct_demo_001', enabled: 1, auto_approve: 0,
    default_ttl: 600, allowed_types: 'CNAME,A,AAAA',
    reserved_words: 'www,mail,api,admin,root,ns1,ns2',
    note: '需手动审批', created_at: now() - 86400 * 35, updated_at: now() - 86400 * 10,
  },
  {
    id: 'z3', root_domain: 'example.org', cloudflare_zone_id: zid(),
    cloudflare_account_id: 'acct_demo_001', enabled: 0, auto_approve: 0,
    default_ttl: 3600, allowed_types: 'CNAME,A',
    reserved_words: 'www,mail,api,admin',
    note: '已禁用，暂停新申请', created_at: now() - 86400 * 20, updated_at: now() - 86400 * 2,
  },
]

const subdomains = [
  mkSub('foo', 'example.com', 'z1', 'CNAME', 'app.example.com', 'bob@example.com', 'active', now() - 86400 * 12, now() + 86400 * 60),
  mkSub('bar', 'example.com', 'z1', 'A', '203.0.113.10', 'alice@example.com', 'active', now() - 86400 * 9, null),
  mkSub('api', 'example.com', 'z1', 'CNAME', 'api.internal.example.com', 'bob@example.com', 'active', now() - 86400 * 5, now() + 86400 * 30),
  mkSub('blog', 'example.net', 'z2', 'CNAME', 'blog.gitpages.com', 'user@demo.com', 'pending', now() - 86400 * 2, null),
  mkSub('test', 'example.net', 'z2', 'A', '198.51.100.7', 'bob@example.com', 'pending', now() - 86400 * 1, null),
  mkSub('shop', 'example.com', 'z1', 'CNAME', 'shop.myshop.com', 'alice@example.com', 'rejected', now() - 86400 * 8, null, '与保留词冲突，已被占用'),
  mkSub('cdn', 'example.com', 'z1', 'A', '192.0.2.45', 'bob@example.com', 'error', now() - 86400 * 3, null, 'Cloudflare: (1004) DNS 记录无效，请检查目标地址'),
  mkSub('mail', 'example.org', 'z3', 'CNAME', 'mail.provider.com', 'user@demo.com', 'pending', now() - 86400 * 4, null),
]

const audit = [
  mkAudit('login', 'admin@demo.com', 'success', '管理员登录', '127.0.0.1'),
  mkAudit('zone_add', 'example.com', 'success', '新增根域名并校验 Zone ID', '127.0.0.1', 'example.com'),
  mkAudit('apply', 'foo.example.com', 'success', '用户提交申请', '127.0.0.1', 'example.com'),
  mkAudit('dns_create', 'foo.example.com', 'success', 'record_id=' + rid(), '127.0.0.1', 'example.com'),
  mkAudit('approve', 'blog.example.net', 'success', '管理员通过申请', '127.0.0.1', 'example.net'),
  mkAudit('reject', 'shop.example.com', 'success', '保留词冲突', '127.0.0.1', 'example.com'),
  mkAudit('dns_create', 'shop.example.com', 'failure', 'Cloudflare 创建失败', '127.0.0.1', 'example.com'),
  mkAudit('user_create', 'bob@example.com', 'success', '管理员创建用户', '127.0.0.1'),
  mkAudit('login', 'bob@example.com', 'success', '用户登录', '127.0.0.1'),
  mkAudit('apply', 'cdn.example.com', 'success', '用户提交申请', '127.0.0.1', 'example.com'),
  mkAudit('zone_update', 'example.net', 'success', '关闭自动审批', '127.0.0.1', 'example.net'),
  mkAudit('delete', 'old.example.com', 'success', '用户删除子域名', '127.0.0.1', 'example.com'),
]

const sessions = new Map() // token -> { email, expiresAt }
let registrationEnabled = false
let maxSubdomainsPerUser = 10
let maxApplicationsPerMonth = 30

function mkSub(prefix, root, zoneId, type, target, userId, status, createdAt, expiresAt, rejectReason = null, errorMessage = null) {
  const zone = zones.find((z) => z.id === zoneId)
  return {
    id: randomUUID(), user_id: userId, zone_id: zoneId, root_domain: root, prefix,
    full_domain: `${prefix}.${root}`, record_type: type, target, ttl: zone.default_ttl,
    status,
    dns_record_id: status === 'active' ? rid() : null,
    cloudflare_zone_id: zone.cloudflare_zone_id,
    expires_at: expiresAt, error_message: errorMessage, reject_reason: rejectReason,
    created_at: createdAt, updated_at: createdAt,
  }
}
function mkAudit(action, target, result, detail, ip, rootDomain = null, zoneId = null) {
  return {
    id: randomUUID(), actor_id: 'u_admin', actor_email: 'admin@demo.com',
    action, target, root_domain: rootDomain, zone_id: zoneId, result, detail,
    ip, created_at: now() - Math.floor(Math.random() * 86400 * 3),
  }
}
function zoneSummary(zoneId) {
  const subs = subdomains.filter((s) => s.zone_id === zoneId)
  return {
    total: subs.length,
    active: subs.filter((s) => s.status === 'active').length,
    pending: subs.filter((s) => s.status === 'pending').length,
  }
}
function findUser(email) {
  return users.find((u) => u.email === email)
}

// ---------------- HTTP 辅助 ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
}
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': CSP,
  })
  res.end(body)
}
const ok = (res, data) => sendJson(res, 200, { ok: true, data })
const fail = (res, code, message, status = 400) => sendJson(res, status, { ok: false, error: { code, message } })

function readBody(req) {
  return new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => (d += c))
    req.on('end', () => {
      try { resolve(d ? JSON.parse(d) : {}) } catch { resolve({}) }
    })
  })
}
function getCookie(req, name) {
  const h = req.headers.cookie || ''
  const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[1]) : null
}
function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`)
}

// ---------------- API ----------------
async function handleApi(req, res, url) {
  const seg = url.pathname.split('/').filter(Boolean) // ['api','admin','zones', ...]
  const method = req.method.toUpperCase()
  const q = url.searchParams
  const sessionEmail = (() => {
    const t = getCookie(req, 'session')
    const s = t && sessions.get(t)
    if (s && s.expiresAt > now()) return s.email
    return null
  })()
  const currentUser = sessionEmail ? findUser(sessionEmail) : null

  // 健康检查
  if (seg[1] === 'health') return ok(res, { time: now(), env: 'demo' })

  // 认证
  if (seg[1] === 'auth') {
    if (seg[2] === 'login' && method === 'POST') {
      const { email, password } = await readBody(req)
      if (!email || !password) return fail(res, 'INVALID', '请输入邮箱和密码', 422)
      let u = findUser(email)
      if (!u) { u = { id: 'u_' + rand(4), email, role: 'user', status: 'active', created_at: now() }; users.push(u) }
      const token = rand(16)
      sessions.set(token, { email: u.email, expiresAt: now() + 604800 })
      setCookie(res, 'session', token, 604800)
      audit.unshift(mkAudit('login', u.email, 'success', '演示登录', getCookie(req, 'cf-ip') || '127.0.0.1'))
      return ok(res, sanitizeUser(u))
    }
    if (seg[2] === 'logout' && method === 'POST') {
      const t = getCookie(req, 'session')
      if (t) sessions.delete(t)
      setCookie(res, 'session', '', 0)
      return ok(res, {})
    }
    if (seg[2] === 'me' && method === 'GET') {
      if (!currentUser) return fail(res, 'UNAUTHENTICATED', '未登录或会话已过期', 401)
      return ok(res, sanitizeUser(currentUser))
    }
    return fail(res, 'NOT_FOUND', '接口不存在', 404)
  }

  if (!currentUser) return fail(res, 'UNAUTHENTICATED', '未登录或会话已过期', 401)

  // 用户中心
  if (seg[1] === 'user') {
    if (seg[2] === 'stats' && method === 'GET') {
      const mine = subdomains.filter((s) => s.user_id === currentUser.email)
      const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000)
      return ok(res, {
        total: mine.length,
        active: mine.filter((s) => s.status === 'active').length,
        pending: mine.filter((s) => s.status === 'pending').length,
        limit: maxSubdomainsPerUser,
        monthly_limit: maxApplicationsPerMonth,
        monthly_used: mine.filter((s) => s.created_at >= monthStart).length,
      })
    }
    if (seg[2] === 'zones' && method === 'GET') {
      const list = zones.filter((z) => z.enabled === 1).map((z) => ({
        id: z.id, root_domain: z.root_domain, allowed_types: z.allowed_types,
        default_ttl: z.default_ttl, auto_approve: z.auto_approve,
      }))
      return ok(res, list)
    }
    if (seg[2] === 'subdomains' && !seg[3] && method === 'GET') {
      let list = subdomains.filter((s) => s.user_id === currentUser.email)
      const zf = q.get('zone_id')
      if (zf) list = list.filter((s) => s.zone_id === zf)
      return ok(res, list)
    }
    if (seg[2] === 'subdomains' && !seg[3] && method === 'POST') {
      const b = await readBody(req)
      const zone = zones.find((z) => z.id === b.zone_id)
      if (!zone) return fail(res, 'ZONE_NOT_FOUND', '根域名不存在', 404)
      if (zone.enabled !== 1) return fail(res, 'ZONE_DISABLED', '该根域名已禁用', 409)
      const prefix = String(b.prefix || '').toLowerCase().trim()
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(prefix)) return fail(res, 'PREFIX_INVALID', '前缀格式不正确', 422)
      const reserved = (zone.reserved_words || '').split(',').map((s) => s.trim()).filter(Boolean)
      if (reserved.includes(prefix)) return fail(res, 'RESERVED', '该前缀为保留词', 422)
      const full = `${prefix}.${zone.root_domain}`
      if (subdomains.some((s) => s.full_domain === full && s.status !== 'rejected')) return fail(res, 'DOMAIN_TAKEN', '该域名已被占用', 409)
      // 平台限制：每用户数量 + 每月申请次数
      const owned = subdomains.filter((s) => s.user_id === currentUser.email && s.status !== 'rejected').length
      if (owned >= maxSubdomainsPerUser) return fail(res, 'LIMIT_REACHED', `已达到每用户子域名数量上限（${maxSubdomainsPerUser} 个）`, 429)
      const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000)
      const monthCount = subdomains.filter((s) => s.user_id === currentUser.email && s.created_at >= monthStart).length
      if (monthCount >= maxApplicationsPerMonth) return fail(res, 'MONTH_LIMIT', `本月申请次数已达上限（${maxApplicationsPerMonth} 次）`, 429)
      // 自动通过：创建即 active 并写 DNS 记录
      const sub = mkSub(prefix, zone.root_domain, zone.id, b.record_type || 'CNAME', b.target, currentUser.email, 'active', now(), b.expires_at ?? null)
      sub.dns_record_id = rid()
      subdomains.push(sub)
      // 根解析记录同步登记（name=''）
      dnsRecords.push(mkRecord(sub.id, currentUser.email, '', b.record_type || 'CNAME', b.target, sub.ttl))
      audit.unshift(mkAudit('apply', full, 'success', '用户提交申请（自动通过）', '127.0.0.1', zone.root_domain, zone.cloudflare_zone_id))
      audit.unshift(mkAudit('dns_create', full, 'success', 'record_id=' + sub.dns_record_id, '127.0.0.1', zone.root_domain, zone.cloudflare_zone_id))
      return ok(res, sub)
    }
    if (seg[2] === 'subdomains' && seg[3]) {
      const id = seg[3]
      const sub = subdomains.find((s) => s.id === id)
      if (!sub) return fail(res, 'NOT_FOUND', '子域名不存在', 404)
      if (sub.user_id !== currentUser.email) return fail(res, 'FORBIDDEN', '无权操作该资源', 403)
      // ---- 解析记录管理 ----
      if (seg[4] === 'records') {
        const rid2 = seg[5]
        if (!rid2 && method === 'GET') {
          return ok(res, dnsRecords.filter((r) => r.subdomain_id === id))
        }
        if (!rid2 && method === 'POST') {
          const b = await readBody(req)
          const type = String(b.record_type || 'A').toUpperCase()
          if (!['A', 'AAAA', 'CNAME', 'TXT'].includes(type)) return fail(res, 'TYPE_NOT_ALLOWED', '记录类型仅支持 A/AAAA/CNAME/TXT', 422)
          const name = String(b.name || '').toLowerCase().trim()
          if (name && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?){0,2}$/.test(name))
            return fail(res, 'INVALID_NAME', '记录名格式不正确（每段仅字母数字连字符，最多 3 级）', 422)
          const full2 = name ? `${name}.${sub.full_domain}` : sub.full_domain
          const rows = dnsRecords.filter((r) => r.subdomain_id === id && r.name === name)
          const hasCname = rows.some((r) => r.record_type === 'CNAME')
          if ((type === 'CNAME' || hasCname) && rows.length > 0)
            return fail(res, 'RECORD_EXISTS', `${full2} 已存在解析记录（CNAME 不可与其他记录共存）`, 409)
          if (rows.some((r) => r.record_type === type))
            return fail(res, 'RECORD_EXISTS', `${full2} 已存在 ${type} 记录`, 409)
          if (dnsRecords.filter((r) => r.subdomain_id === id).length >= 20)
            return fail(res, 'RECORD_LIMIT', '每个子域名最多 20 条解析记录', 429)
          if (!b.content) return fail(res, 'INVALID_CONTENT', '请填写记录值', 422)
          const rec = mkRecord(id, currentUser.email, name, type, String(b.content), Number(b.ttl) || 300)
          dnsRecords.push(rec)
          audit.unshift(mkAudit('record_create', full2, 'success', `type=${type}`, '127.0.0.1', sub.root_domain, sub.cloudflare_zone_id))
          return ok(res, rec, 201)
        }
        const rec = dnsRecords.find((r) => r.id === rid2 && r.subdomain_id === id)
        if (!rec) return fail(res, 'NOT_FOUND', '解析记录不存在', 404)
        if (seg[6] === 'delete' && method === 'POST') {
          const i = dnsRecords.indexOf(rec); dnsRecords.splice(i, 1)
          return ok(res, { deleted: true })
        }
        if (!seg[6] && method === 'PUT') {
          const b = await readBody(req)
          if (b.content != null) rec.content = b.content
          if (b.ttl != null) rec.ttl = Number(b.ttl)
          rec.updated_at = now()
          return ok(res, rec)
        }
      }
      if (seg[4] === 'delete' && method === 'POST') {
        const i = subdomains.indexOf(sub); subdomains.splice(i, 1)
        // 级联删除解析记录
        for (let j = dnsRecords.length - 1; j >= 0; j--) {
          if (dnsRecords[j].subdomain_id === id) dnsRecords.splice(j, 1)
        }
        audit.unshift(mkAudit('delete', sub.full_domain, 'success', '用户删除子域名', '127.0.0.1', sub.root_domain, sub.cloudflare_zone_id))
        return ok(res, {})
      }
      if (seg[4] === 'retry' && method === 'POST') {
        sub.status = 'active'; sub.dns_record_id = rid(); sub.error_message = null; sub.updated_at = now()
        return ok(res, sub)
      }
      if (!seg[4] && method === 'PUT') {
        const b = await readBody(req)
        if (b.target != null) sub.target = b.target
        if (b.ttl != null) sub.ttl = b.ttl
        sub.updated_at = now()
        return ok(res, sub)
      }
    }
    if (seg[2] === 'settings' && seg[3] === 'password' && method === 'POST') {
      const b = await readBody(req)
      if (!b.old_password || !b.new_password) return fail(res, 'INVALID', '请填写完整', 422)
      if (String(b.new_password).length < 8) return fail(res, 'WEAK', '新密码至少 8 位', 422)
      return ok(res, {})
    }
    return fail(res, 'NOT_FOUND', '接口不存在', 404)
  }

  // 管理员
  if (seg[1] === 'admin') {
    if (currentUser.role !== 'admin') return fail(res, 'FORBIDDEN', '需要管理员权限', 403)
    if (seg[2] === 'stats' && method === 'GET') {
      return ok(res, {
        users: users.length,
        zones: zones.length,
        active: subdomains.filter((s) => s.status === 'active').length,
        pending: subdomains.filter((s) => s.status === 'pending').length,
        per_zone: zones.map((z) => ({ zone_id: z.id, root_domain: z.root_domain, ...zoneSummary(z.id) })),
      })
    }
    if (seg[2] === 'zones' && method === 'GET') {
      const list = zones.map((z) => ({ ...z, summary: zoneSummary(z.id) }))
      return ok(res, list)
    }
    if (seg[2] === 'zones' && method === 'POST') {
      const b = await readBody(req)
      const rd = String(b.root_domain || '').trim().toLowerCase()
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(rd)) return fail(res, 'INVALID', '根域名格式不正确', 422)
      if (zones.some((z) => z.root_domain === rd)) return fail(res, 'EXISTS', '该根域名已存在', 409)
      const z = {
        id: 'z' + rand(4), root_domain: rd, cloudflare_zone_id: zid(), cloudflare_account_id: 'acct_demo_001',
        enabled: 1, auto_approve: 0, default_ttl: 3600, allowed_types: 'CNAME,A,AAAA,TXT',
        reserved_words: 'www,mail,api,admin,root,ns1,ns2,ftp,webmail,ns,mx', note: '',
        created_at: now(), updated_at: now(),
      }
      zones.push(z)
      audit.unshift(mkAudit('zone_add', rd, 'success', '新增根域名并校验 Zone ID', '127.0.0.1', rd, z.cloudflare_zone_id))
      return ok(res, { ...z, summary: zoneSummary(z.id) })
    }
    if (seg[2] === 'zones' && seg[3]) {
      const z = zones.find((x) => x.id === seg[3])
      if (!z) return fail(res, 'NOT_FOUND', '根域名不存在', 404)
      if (seg[4] === 'verify' && method === 'POST') {
        return ok(res, { match: true, cloudflare_zone_id: z.cloudflare_zone_id })
      }
      if (!seg[4] && method === 'PUT') {
        const b = await readBody(req)
        if (b.enabled != null) z.enabled = b.enabled ? 1 : 0
        if (b.auto_approve != null) z.auto_approve = b.auto_approve ? 1 : 0
        if (b.default_ttl != null) z.default_ttl = b.default_ttl
        if (b.allowed_types != null) z.allowed_types = b.allowed_types
        if (b.reserved_words != null) z.reserved_words = b.reserved_words
        if (b.note != null) z.note = b.note
        z.updated_at = now()
        audit.unshift(mkAudit('zone_update', z.root_domain, 'success', '更新根域名配置', '127.0.0.1', z.root_domain, z.cloudflare_zone_id))
        return ok(res, { ...z, summary: zoneSummary(z.id) })
      }
      if (!seg[4] && method === 'DELETE') {
        const blocking = subdomains.filter((s) => s.zone_id === z.id && ['pending', 'active', 'deleting', 'error'].includes(s.status))
        if (blocking.length > 0) return fail(res, 'ZONE_HAS_SUBDOMAINS', `该根域名下仍有 ${blocking.length} 个子域名，无法删除`, 409)
        zones.splice(zones.indexOf(z), 1)
        return ok(res, {})
      }
    }
    if (seg[2] === 'approvals' && method === 'GET') {
      let list = subdomains.filter((s) => s.status === 'pending')
      const zf = q.get('zone_id')
      if (zf) list = list.filter((s) => s.zone_id === zf)
      return ok(res, list)
    }
    if (seg[2] === 'approvals' && seg[3] === 'bulk-approve' && method === 'POST') {
      const b = await readBody(req)
      const ids = Array.isArray(b.ids) ? b.ids : []
      const results = ids.map((id) => {
        const s = subdomains.find((x) => x.id === id)
        if (!s || s.status !== 'pending') return { id, ok: false, message: '状态已变更' }
        s.status = 'active'; s.dns_record_id = rid(); s.updated_at = now()
        audit.unshift(mkAudit('approve', s.full_domain, 'success', '批量通过', '127.0.0.1', s.root_domain, s.cloudflare_zone_id))
        return { id, ok: true }
      })
      return ok(res, { results })
    }
    if (seg[2] === 'approvals' && seg[3]) {
      const id = seg[3]
      const s = subdomains.find((x) => x.id === id)
      if (!s) return fail(res, 'NOT_FOUND', '申请不存在', 404)
      if (seg[4] === 'approve' && method === 'POST') {
        if (s.status !== 'pending') return fail(res, 'NOT_PENDING', '仅 pending 可审批', 409)
        s.status = 'active'; s.dns_record_id = rid(); s.updated_at = now()
        audit.unshift(mkAudit('approve', s.full_domain, 'success', '管理员通过', '127.0.0.1', s.root_domain, s.cloudflare_zone_id))
        return ok(res, s)
      }
      if (seg[4] === 'reject' && method === 'POST') {
        const b = await readBody(req)
        if (!b.reason) return fail(res, 'INVALID', '请填写拒绝原因', 422)
        s.status = 'rejected'; s.reject_reason = b.reason; s.updated_at = now()
        audit.unshift(mkAudit('reject', s.full_domain, 'success', b.reason, '127.0.0.1', s.root_domain, s.cloudflare_zone_id))
        return ok(res, s)
      }
    }
    if (seg[2] === 'subdomains' && !seg[3] && method === 'GET') {
      let list = [...subdomains]
      const zf = q.get('zone_id'); if (zf) list = list.filter((s) => s.zone_id === zf)
      const st = q.get('status'); if (st) list = list.filter((s) => s.status === st)
      return ok(res, list)
    }
    if (seg[2] === 'subdomains' && seg[3]) {
      const id = seg[3]
      const s = subdomains.find((x) => x.id === id)
      if (!s) return fail(res, 'NOT_FOUND', '子域名不存在', 404)
      if (seg[4] === 'delete' && method === 'POST') {
        const i = subdomains.indexOf(s); subdomains.splice(i, 1)
        audit.unshift(mkAudit('delete', s.full_domain, 'success', '管理员删除', '127.0.0.1', s.root_domain, s.cloudflare_zone_id))
        return ok(res, {})
      }
      if (seg[4] === 'retry' && method === 'POST') {
        s.status = 'active'; s.dns_record_id = rid(); s.error_message = null; s.updated_at = now()
        return ok(res, s)
      }
      if (!seg[4] && method === 'PUT') {
        const b = await readBody(req)
        if (b.target != null) s.target = b.target
        if (b.ttl != null) s.ttl = b.ttl
        s.updated_at = now()
        audit.unshift(mkAudit('dns_update', s.full_domain, 'success', '更新 DNS 记录', '127.0.0.1', s.root_domain, s.cloudflare_zone_id))
        return ok(res, s)
      }
    }
    if (seg[2] === 'users' && method === 'GET') return ok(res, users)
    if (seg[2] === 'users' && method === 'POST') {
      const b = await readBody(req)
      if (!b.email || !b.password) return fail(res, 'INVALID', '请填写邮箱和密码', 422)
      if (findUser(b.email)) return fail(res, 'EXISTS', '用户已存在', 409)
      const u = { id: 'u_' + rand(4), email: b.email, role: b.role === 'admin' ? 'admin' : 'user', status: 'active', created_at: now() }
      users.push(u)
      audit.unshift(mkAudit('user_create', b.email, 'success', '管理员创建用户', '127.0.0.1'))
      return ok(res, sanitizeUser(u))
    }
    if (seg[2] === 'users' && seg[3]) {
      const u = users.find((x) => x.id === seg[3])
      if (!u) return fail(res, 'NOT_FOUND', '用户不存在', 404)
      if (seg[4] === 'reset-password' && method === 'POST') {
        const b = await readBody(req)
        if (!b.password || String(b.password).length < 8) return fail(res, 'WEAK', '密码至少 8 位', 422)
        return ok(res, {})
      }
      if (seg[4] === 'toggle-admin' && method === 'POST') {
        u.role = u.role === 'admin' ? 'user' : 'admin'
        return ok(res, sanitizeUser(u))
      }
      if (!seg[4] && method === 'PATCH') {
        const b = await readBody(req)
        if (b.disabled != null) u.status = b.disabled ? 'disabled' : 'active'
        if (b.role) u.role = b.role
        return ok(res, sanitizeUser(u))
      }
    }
    if (seg[2] === 'settings' && method === 'GET') return ok(res, { registration_enabled: registrationEnabled, max_subdomains_per_user: maxSubdomainsPerUser, max_applications_per_month: maxApplicationsPerMonth })
    if (seg[2] === 'settings' && method === 'PUT') {
      const b = await readBody(req)
      if (b.registration_enabled != null) registrationEnabled = !!b.registration_enabled
      if (b.max_subdomains_per_user != null) maxSubdomainsPerUser = Number(b.max_subdomains_per_user) || 10
      if (b.max_applications_per_month != null) maxApplicationsPerMonth = Number(b.max_applications_per_month) || 30
      return ok(res, { registration_enabled: registrationEnabled, max_subdomains_per_user: maxSubdomainsPerUser, max_applications_per_month: maxApplicationsPerMonth })
    }
    if (seg[2] === 'audit' && method === 'GET') {
      let list = [...audit]
      const zf = q.get('zone_id')
      if (zf) { const z = zones.find((x) => x.id === zf); if (z) list = list.filter((a) => a.root_domain === z.root_domain) }
      const lim = Math.min(Number(q.get('limit')) || 200, 200)
      return ok(res, list.slice(0, lim))
    }
    return fail(res, 'NOT_FOUND', '接口不存在', 404)
  }

  return fail(res, 'NOT_FOUND', '接口不存在', 404)
}

function sanitizeUser(u) {
  return { id: u.id, email: u.email, role: u.role, status: u.status, created_at: u.created_at }
}

// ---------------- 静态资源 + SPA 回退 ----------------
async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  // 防目录穿越
  const filePath = normalize(join(DIST, pathname))
  if (!filePath.startsWith(DIST + sep)) {
    res.writeHead(403); res.end('Forbidden'); return
  }
  try {
    const st = await stat(filePath)
    if (st.isDirectory()) throw new Error('dir')
    const data = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': CSP,
    })
    res.end(data)
  } catch {
    // SPA 回退：非 /api 路由一律返回 index.html，由前端路由处理
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP })
      res.end(html)
    } catch {
      res.writeHead(404); res.end('Not found')
    }
  }
}

// ---------------- 服务入口 ----------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url)
    } else {
      await serveStatic(req, res, url)
    }
  } catch (e) {
    console.error('[error]', e)
    if (!res.headersSent) fail(res, 'INTERNAL', '服务器内部错误', 500)
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[demo] subdomain-platform preview listening on 0.0.0.0:${PORT}`)
})
