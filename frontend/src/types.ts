// 前端共享类型（与后端 DTO 对齐）
export type Role = 'admin' | 'user'
export type UserStatus = 'active' | 'disabled'
export type SubdomainStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'deleting'
  | 'expired'
  | 'error'

export interface User {
  id: string
  email: string
  role: Role
  status: UserStatus
  created_at: number
}

export interface Zone {
  id: string
  root_domain: string
  cloudflare_zone_id: string
  cloudflare_account_id: string
  enabled: number
  auto_approve: number
  default_ttl: number
  allowed_types: string
  reserved_words: string
  note: string
  created_at: number
  updated_at: number
  summary?: {
    total: number
    active: number
    pending: number
  }
}

// 申请时可用的根域名（精简字段）
export interface ApplyZone {
  id: string
  root_domain: string
  allowed_types: string
  default_ttl: number
  auto_approve: number
  reserved_words: string
}

export interface Subdomain {
  id: string
  user_id: string
  zone_id: string
  root_domain: string
  prefix: string
  full_domain: string
  record_type: string
  target: string
  ttl: number
  proxied: number
  status: SubdomainStatus
  dns_record_id: string | null
  cloudflare_zone_id: string
  expires_at: number | null
  error_message: string | null
  reject_reason: string | null
  created_at: number
  updated_at: number
}

export interface AuditLog {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target: string | null
  root_domain: string | null
  zone_id: string | null
  result: 'success' | 'failure'
  detail: string | null
  ip: string | null
  created_at: number
}

export interface ApiError {
  code: string
  message: string
}
