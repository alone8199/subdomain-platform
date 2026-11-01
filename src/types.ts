// 共享领域类型
export type Role = 'admin' | 'user'
export type UserStatus = 'active' | 'disabled'

export type ZoneEnabled = 0 | 1

export type RecordType = 'CNAME' | 'A' | 'AAAA' | 'TXT'

export type SubdomainStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'deleting'
  | 'expired'
  | 'error'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  salt: string
  role: Role
  status: UserStatus
  created_at: number
  updated_at: number
}

export interface SessionRow {
  id: string
  user_id: string
  expires_at: number
  created_at: number
  ip?: string | null
  user_agent?: string | null
}

export interface ZoneRow {
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
}

export interface SubdomainRow {
  id: string
  user_id: string
  zone_id: string
  root_domain: string
  prefix: string
  full_domain: string
  record_type: RecordType
  target: string
  ttl: number
  status: SubdomainStatus
  dns_record_id: string | null
  cloudflare_zone_id: string
  expires_at: number | null
  error_message: string | null
  reject_reason: string | null
  created_at: number
  updated_at: number
}

export interface AuditRow {
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

// 公开返回的用户（不含密码/salt）
export type PublicUser = Omit<UserRow, 'password_hash' | 'salt'>
