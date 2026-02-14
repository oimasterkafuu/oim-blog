import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

// 生成随机密钥
function generateRandomSecret(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// 从数据库获取或创建 JWT secret
async function getJwtSecret(): Promise<Uint8Array> {
  const setting = await db.setting.findUnique({
    where: { key: 'jwt_secret' }
  })

  if (setting?.value) {
    // 将十六进制字符串转换为 Uint8Array
    const hexString = setting.value
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hexString.substring(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  // 如果不存在，生成新的 secret 并存储
  const newSecret = generateRandomSecret()
  await db.setting.create({
    data: {
      key: 'jwt_secret',
      value: newSecret
    }
  })

  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(newSecret.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
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
  const secretKey = await getJwtSecret()
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const secretKey = await getJwtSecret()
    const { payload } = await jwtVerify(token, secretKey)
    return payload.user as SessionUser
  } catch {
    return null
  }
}

// Token 刷新：如果 token 即将过期（剩余时间少于1天），则签发新 token
export async function refreshToken(token: string): Promise<string | null> {
  try {
    const secretKey = await getJwtSecret()
    const { payload } = await jwtVerify(token, secretKey)
    const user = payload.user as SessionUser
    
    // 检查过期时间
    const exp = payload.exp
    if (!exp) return null
    
    const now = Math.floor(Date.now() / 1000)
    const oneDay = 24 * 60 * 60
    
    // 如果剩余时间少于1天，刷新 token
    if (exp - now < oneDay) {
      return createToken(user)
    }
    
    return null // 不需要刷新
  } catch {
    return null // token 无效
  }
}

// Session 管理
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  
  // 尝试刷新 token（如果即将过期）
  const refreshedToken = await refreshToken(token)
  if (refreshedToken) {
    cookieStore.set('session', refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })
  }
  
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

// 更新 JWT Secret 并重新签发当前用户的 session
export async function rotateSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return false
  
  try {
    // 使用旧 secret 验证 token（需要存储旧 secret 或使用试错机制）
    // 这里简化为：如果验证失败，不强制登出，保留原 token
    const user = await verifyToken(token)
    if (!user) return false
    
    // 使用新 secret 重新签发
    const newToken = await createToken(user)
    cookieStore.set('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })
    return true
  } catch {
    return false
  }
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
