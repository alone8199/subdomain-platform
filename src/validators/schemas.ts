import { z } from 'zod'

// -------------------- 通用 --------------------
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('邮箱格式不正确')
  .max(254)

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(128, '密码过长')

// -------------------- 认证 --------------------
export const setupSchema = z.object({
  setupToken: z.string().min(1, '缺少 SETUP_TOKEN'),
})

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码'),
})

// -------------------- 根域名（Zone） --------------------
export const recordTypeSchema = z.enum(['CNAME', 'A', 'AAAA', 'TXT'])

export const zoneCreateSchema = z.object({
  root_domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
      '根域名格式不正确（如 example.com）',
    ),
  enabled: z.boolean().optional().default(true),
  auto_approve: z.boolean().optional().default(false),
  default_ttl: z.number().int().min(60).max(86400).optional().default(300),
  allowed_types: z
    .string()
    .optional()
    .default('CNAME,A,AAAA,TXT'),
  reserved_words: z
    .string()
    .optional()
    .default('www,mail,api,admin,root,ns1,ns2,ftp,webmail,ns,mx'),
  note: z.string().max(500).optional().default(''),
})

export const zoneUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  auto_approve: z.boolean().optional(),
  default_ttl: z.number().int().min(60).max(86400).optional(),
  allowed_types: z.string().optional(),
  reserved_words: z.string().optional(),
  note: z.string().max(500).optional(),
})

// -------------------- 子域名申请 --------------------
export const subdomainApplySchema = z.object({
  zone_id: z.string().min(1, '请选择根域名'),
  prefix: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      '前缀仅允许小写字母、数字、连字符，且不能以连字符开头或结尾，长度 1-63',
    )
    .max(63),
  record_type: recordTypeSchema.default('CNAME'),
  target: z.string().trim().min(1, '请填写目标内容').max(1024),
  ttl: z.number().int().min(60).max(86400).optional(),
  proxied: z.boolean().optional().default(false),
  expires_at: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
})

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, '请填写拒绝原因').max(500),
})

// -------------------- 用户管理 --------------------
export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['user', 'admin']).optional().default('user'),
})

export const userUpdateSchema = z.object({
  status: z.enum(['active', 'disabled']).optional(),
  role: z.enum(['user', 'admin']).optional(),
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
})

// -------------------- 设置 --------------------
export const settingsUpdateSchema = z.object({
  registration_enabled: z.boolean().optional(),
})
