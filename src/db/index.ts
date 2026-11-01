import type { Env } from '../env'
import type {
  UserRow,
  SessionRow,
  ZoneRow,
  SubdomainRow,
  AuditRow,
} from '../types'

// 轻量 DB 访问层。D1 的 prepare().bind().all()/first()/run()。
export class Db {
  constructor(private db: D1Database) {}

  // 单行查询
  async get<T = any>(
    sql: string,
    ...params: any[]
  ): Promise<T | null> {
    const r = await this.db.prepare(sql).bind(...params).first<T>()
    return (r as T) ?? null
  }

  // 多行查询
  async all<T = any>(
    sql: string,
    ...params: any[]
  ): Promise<T[]> {
    const r = await this.db.prepare(sql).bind(...params).all<T>()
    return (r.results as T[]) ?? []
  }

  // 执行写操作
  async run(
    sql: string,
    ...params: any[]
  ): Promise<D1Result> {
    return this.db.prepare(sql).bind(...params).run()
  }

  // 批量执行（事务）
  async batch(
    statements: { sql: string; params: any[] }[],
  ): Promise<D1Result[]> {
    const stmts = statements.map((s) =>
      this.db.prepare(s.sql).bind(...s.params),
    )
    return this.db.batch(stmts)
  }
}

export function db(env: Env): Db {
  return new Db(env.DB)
}

// -------------------- Users --------------------
export async function getUserByEmail(
  d: Db,
  email: string,
): Promise<UserRow | null> {
  return d.get<UserRow>(
    'SELECT * FROM users WHERE email = ?',
    email.toLowerCase(),
  )
}

export async function getUserById(
  d: Db,
  id: string,
): Promise<UserRow | null> {
  return d.get<UserRow>('SELECT * FROM users WHERE id = ?', id)
}

export async function toPublicUser(u: UserRow) {
  const { password_hash, salt, ...rest } = u
  void password_hash
  void salt
  return rest
}

// -------------------- Sessions --------------------
export async function getSession(
  d: Db,
  token: string,
): Promise<SessionRow | null> {
  return d.get<SessionRow>(
    'SELECT * FROM sessions WHERE id = ?',
    token,
  )
}

export async function deleteSession(d: Db, token: string) {
  await d.run('DELETE FROM sessions WHERE id = ?', token)
}

// -------------------- Zones --------------------
export async function getZoneById(
  d: Db,
  id: string,
): Promise<ZoneRow | null> {
  return d.get<ZoneRow>('SELECT * FROM zones WHERE id = ?', id)
}

export async function getZoneByRootDomain(
  d: Db,
  root: string,
): Promise<ZoneRow | null> {
  return d.get<ZoneRow>(
    'SELECT * FROM zones WHERE root_domain = ?',
    root.toLowerCase(),
  )
}

// -------------------- Subdomains --------------------
export async function getSubdomainById(
  d: Db,
  id: string,
): Promise<SubdomainRow | null> {
  return d.get<SubdomainRow>('SELECT * FROM subdomains WHERE id = ?', id)
}

export async function getSubdomainByFullDomain(
  d: Db,
  full: string,
): Promise<SubdomainRow | null> {
  return d.get<SubdomainRow>(
    'SELECT * FROM subdomains WHERE full_domain = ?',
    full.toLowerCase(),
  )
}

export type { UserRow, SessionRow, ZoneRow, SubdomainRow, AuditRow }
