-- =====================================================================
-- 二级域名分发平台 - D1 初始化迁移
-- 可重复执行：所有建表均使用 IF NOT EXISTS，索引使用 IF NOT EXISTS。
-- 执行顺序固定：users -> sessions -> zones -> subdomains -> audit_logs -> settings
-- =====================================================================

-- -------------------- users --------------------
CREATE TABLE IF NOT EXISTS users (
  id              TEXT    PRIMARY KEY,
  email           TEXT    NOT NULL,
  password_hash   TEXT    NOT NULL,
  salt            TEXT    NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'user',   -- admin | user
  status          TEXT    NOT NULL DEFAULT 'active', -- active | disabled
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX      IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX      IF NOT EXISTS idx_users_status   ON users(status);

-- -------------------- sessions --------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,                    -- session token
  user_id     TEXT    NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- -------------------- zones（根域名） --------------------
CREATE TABLE IF NOT EXISTS zones (
  id                TEXT    PRIMARY KEY,
  root_domain       TEXT    NOT NULL,                 -- 例如 example.com
  cloudflare_zone_id   TEXT NOT NULL,                 -- Cloudflare Zone ID
  cloudflare_account_id TEXT NOT NULL,                -- Cloudflare Account ID
  enabled           INTEGER NOT NULL DEFAULT 1,       -- 1 启用 / 0 禁用
  auto_approve      INTEGER NOT NULL DEFAULT 0,       -- 1 自动审批 / 0 手动
  default_ttl       INTEGER NOT NULL DEFAULT 300,
  allowed_types     TEXT    NOT NULL DEFAULT 'CNAME,A,AAAA,TXT',
  reserved_words    TEXT    NOT NULL DEFAULT 'www,mail,api,admin,root,ns1,ns2,ftp,webmail,ns,mx',
  note              TEXT    DEFAULT '',
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_root_domain ON zones(root_domain);
CREATE INDEX      IF NOT EXISTS idx_zones_zone_id     ON zones(cloudflare_zone_id);
CREATE INDEX      IF NOT EXISTS idx_zones_enabled     ON zones(enabled);

-- -------------------- subdomains（子域名申请） --------------------
CREATE TABLE IF NOT EXISTS subdomains (
  id                  TEXT    PRIMARY KEY,
  user_id             TEXT    NOT NULL,
  zone_id             TEXT    NOT NULL,               -- 关联 zones.id
  root_domain         TEXT    NOT NULL,               -- 冗余存储，便于筛选/展示
  prefix              TEXT    NOT NULL,               -- 子域名前缀
  full_domain         TEXT    NOT NULL,               -- 完整域名 prefix.root_domain
  record_type         TEXT    NOT NULL,               -- CNAME | A | AAAA | TXT
  target              TEXT    NOT NULL,               -- 目标内容
  ttl                 INTEGER NOT NULL,
  proxied             INTEGER NOT NULL DEFAULT 0,     -- 仅 A/AAAA/CNAME
  status              TEXT    NOT NULL DEFAULT 'pending',
  -- pending | active | rejected | deleting | expired | error
  dns_record_id       TEXT,                           -- Cloudflare DNS record id
  cloudflare_zone_id  TEXT    NOT NULL,               -- 所属 Zone 的 CF id
  expires_at          INTEGER,                        -- 可选到期时间
  error_message       TEXT,                           -- CF 原始错误摘要（已脱敏）
  reject_reason       TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subdomains_full_domain ON subdomains(full_domain);
CREATE INDEX      IF NOT EXISTS idx_subdomains_zone_id   ON subdomains(zone_id);
CREATE INDEX      IF NOT EXISTS idx_subdomains_user_id   ON subdomains(user_id);
CREATE INDEX      IF NOT EXISTS idx_subdomains_status    ON subdomains(status);
CREATE INDEX      IF NOT EXISTS idx_subdomains_root      ON subdomains(root_domain);

-- -------------------- audit_logs（审计日志） --------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT    PRIMARY KEY,
  actor_id     TEXT,                                 -- 操作者 user id
  actor_email  TEXT,                                 -- 操作者邮箱（冗余）
  action       TEXT    NOT NULL,                     -- login | register | apply | approve | reject | dns_create | dns_delete | user_change | zone_change | cron_expire ...
  target       TEXT,                                 -- 操作目标（如 full_domain / email / zone id）
  root_domain  TEXT,                                 -- 关联根域名
  zone_id      TEXT,                                 -- 关联 cloudflare_zone_id
  result       TEXT    NOT NULL DEFAULT 'success',   -- success | failure
  detail       TEXT,
  ip           TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_zone     ON audit_logs(zone_id);

-- -------------------- settings（系统设置） --------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT    PRIMARY KEY,
  value       TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- 默认设置：公开注册默认关闭
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES ('registration_enabled', '0', strftime('%s','now'));
