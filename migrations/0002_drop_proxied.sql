-- 移除子域名的 Cloudflare 代理（Proxied / 橙色云）开关。
-- 平台不再创建/编辑时控制代理，DNS 记录默认走灰云（直连），
-- 是否启用 Cloudflare 代理由用户在 Cloudflare 控制台自行设置。
ALTER TABLE subdomains DROP COLUMN proxied;
