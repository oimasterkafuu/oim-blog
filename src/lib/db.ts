import { PrismaClient } from '@prisma/client'
import { PATHS } from './paths'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 始终使用 PATHS.dbFile 计算的绝对路径，避免环境变量中的相对路径在 standalone 模式下出错
const dbUrl = `file:${PATHS.dbFile}`

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasourceUrl: dbUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db