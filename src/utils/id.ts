// 生成唯一 ID（优先使用 Web Crypto 的 UUID）
export function newId(): string {
  // crypto.randomUUID 在 Workers 运行时可用
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // 兜底（理论上不会走到）
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  )
}

// 当前秒级时间戳
export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}
