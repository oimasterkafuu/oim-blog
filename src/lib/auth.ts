import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

// 生成随机密钥
function generateRandomSecret(): Uint8Array {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return randomBytes
}

// 使用 globalThis 存储密钥，确保在开发模式下热重载时不会重新生成
const globalForSecret = globalThis as unknown as {
  jwtSecret: Uint8Array | undefined
}

const SECRET_KEY = globalForSecret.jwtSecret ?? generateRandomSecret()

if (process.env.NODE_ENV !== 'production') {
  globalForSecret.jwtSecret = SECRET_KEY
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

// 密码哈希（简单实现，生产环境应使用 bcrypt）
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'salt_key_for_blog')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

// JWT 相关
export async function createToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload.user as SessionUser
  } catch {
    return null
  }
}

// Session 管理
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function setSession(user: SessionUser) {
  const token = await createToken(user)
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// 数据库操作
export async function authenticateUser(login: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: login },
        { name: login }
      ]
    }
  })
  if (!user) return null

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
}

// 初始化管理员用户
export async function initAdmin(email: string, password: string, name?: string) {
  const existingAdmin = await db.user.findFirst({ where: { role: 'admin' } })
  if (existingAdmin) return existingAdmin

  const hashedPassword = await hashPassword(password)
  return db.user.create({
    data: {
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      role: 'admin'
    }
  })
}
