// 使用 Web Crypto PBKDF2 进行密码哈希，绝不明文存储，不使用简单 SHA。
const ITERATIONS = 100_000
const KEYLEN = 32 // 256-bit
const DIGEST = 'SHA-256'

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return toHex(arr.buffer)
}

export function generateSalt(): string {
  return randomHex(16) // 128-bit salt
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: ITERATIONS,
      hash: DIGEST,
    },
    keyMaterial,
    KEYLEN * 8,
  )
  return toHex(bits)
}

// 恒定时间比较，避免时序侧信道
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password, salt)
  if (hash.length !== expectedHash.length) return false
  const a = new TextEncoder().encode(hash)
  const b = new TextEncoder().encode(expectedHash)
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}
