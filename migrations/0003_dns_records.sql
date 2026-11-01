-- 子域名解析记录表：每条申请的子域名（如 test.neob.asia）可拥有多条 DNS 记录，
-- 支持根解析（@ = test.neob.asia 本身）与子域解析（www / a.test.neob.asia 等）。
CREATE TABLE IF NOT EXISTS dns_records (
  id TEXT PRIMARY KEY,
  subdomain_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',        -- 相对名：'' 或 '@' 表示子域本身；'www' 表示 www.test.neob.asia
  record_type TEXT NOT NULL,            -- A / AAAA / CNAME / TXT
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 300,
  cf_record_id TEXT,                    -- Cloudflare DNS 记录 ID
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dns_records_sub ON dns_records(subdomain_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_user ON dns_records(user_id);
