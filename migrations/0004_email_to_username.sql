-- 邮箱字段统一改为用户名
ALTER TABLE users RENAME COLUMN email TO username;
ALTER TABLE audit_logs RENAME COLUMN actor_email TO actor_name;

DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
