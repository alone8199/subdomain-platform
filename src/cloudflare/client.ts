// Cloudflare API 客户端封装。
// 所有敏感信息（token）仅在本文件内使用，绝不写入日志或返回给前端。
// 最小权限：Zone:Read、DNS:Edit。

const API_BASE = 'https://api.cloudflare.com/client/v4'
const TIMEOUT_MS = 15_000

export interface CfDnsRecord {
  id: string
  type: string
  name: string
  content: string
  ttl: number
  proxied: boolean
  zone_id: string
  zone_name?: string
}

export interface CfZone {
  id: string
  name: string
  status: string
  paused: boolean
}

export class CloudflareError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'CloudflareError'
  }
}

export class CloudflareApi {
  constructor(
    private token: string,
    private accountId: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (e: any) {
      clearTimeout(timer)
      // 网络/超时错误，脱敏后抛出（不暴露 token）
      throw new CloudflareError(
        `Cloudflare 请求失败（${e?.name === 'AbortError' ? '超时' : '网络错误'}）`,
        0,
      )
    }
    clearTimeout(timer)

    let json: any = null
    try {
      json = await res.json()
    } catch {
      json = null
    }

    if (!res.ok || !json?.success) {
      // 提取错误摘要，主动脱敏（移除任何可能包含 token 的内容）
      const raw = json?.errors ?? json?.messages ?? []
      const summary = Array.isArray(raw)
        ? raw
            .map((x: any) => (typeof x === 'string' ? x : x?.message || x?.code))
            .filter(Boolean)
            .join('; ')
        : String(raw)
      throw new CloudflareError(
        summary ? `Cloudflare 错误: ${summary}` : `Cloudflare HTTP ${res.status}`,
        res.status,
      )
    }
    return json.result as T
  }

  // 通过根域名查询 Zone ID，并校验 token 权限
  async getZoneByName(domain: string): Promise<CfZone> {
    const data = await this.request<{ result: CfZone[] }>(
      'GET',
      `/zones?name=${encodeURIComponent(domain)}&status=active`,
    )
    const zone = data.result?.find(
      (z) => z.name.toLowerCase() === domain.toLowerCase(),
    )
    if (!zone) {
      throw new CloudflareError(
        `在账户中未找到活跃 Zone: ${domain}（请确认域名已托管到 Cloudflare 且 Token 拥有 Zone:Read）`,
        404,
      )
    }
    return zone
  }

  // 列出某 Zone 下指定名称的 DNS 记录（用于冲突检测）
  async listDnsByName(
    zoneId: string,
    name: string,
  ): Promise<CfDnsRecord[]> {
    const data = await this.request<{ result: CfDnsRecord[] }>(
      'GET',
      `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`,
    )
    return data.result ?? []
  }

  // 创建 DNS 记录
  async createDns(
    zoneId: string,
    record: {
      type: string
      name: string
      content: string
      ttl: number
      proxied: boolean
    },
  ): Promise<CfDnsRecord> {
    return this.request<CfDnsRecord>(
      'POST',
      `/zones/${zoneId}/dns_records`,
      record,
    )
  }

  // 更新 DNS 记录
  async updateDns(
    zoneId: string,
    recordId: string,
    record: {
      type: string
      name: string
      content: string
      ttl: number
      proxied: boolean
    },
  ): Promise<CfDnsRecord> {
    return this.request<CfDnsRecord>(
      'PATCH',
      `/zones/${zoneId}/dns_records/${recordId}`,
      record,
    )
  }

  // 删除 DNS 记录
  async deleteDns(zoneId: string, recordId: string): Promise<void> {
    await this.request<unknown>(
      'DELETE',
      `/zones/${zoneId}/dns_records/${recordId}`,
    )
  }
}

export function makeCf(env: { CF_API_TOKEN: string; CF_ACCOUNT_ID: string }) {
  return new CloudflareApi(env.CF_API_TOKEN, env.CF_ACCOUNT_ID)
}
