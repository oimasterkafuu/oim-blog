import { PrismaClient } from '@prisma/client'
import { PATHS } from './paths'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbUrl = process.env.DATABASE_URL || `file:${PATHS.dbFile}`

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasourceUrl: dbUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db