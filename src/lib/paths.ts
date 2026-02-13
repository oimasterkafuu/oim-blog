import path from 'path'
import { existsSync } from 'fs'

function getProjectRoot(): string {
  const cwd = process.cwd()
  
  if (process.env.NODE_ENV === 'production') {
    const possiblePaths = [
      path.resolve(cwd, '..'),
      path.resolve(cwd, '..', '..'),
      cwd,
    ]
    
    for (const p of possiblePaths) {
      if (existsSync(path.join(p, 'db')) && existsSync(path.join(p, 'prisma'))) {
        return p
      }
    }
  }
  
  return cwd
}

const PROJECT_ROOT = getProjectRoot()

export const PATHS = {
  projectRoot: PROJECT_ROOT,
  dbDir: path.join(PROJECT_ROOT, 'db'),
  uploadsDir: path.join(PROJECT_ROOT, 'uploads'),
  dbFile: path.join(PROJECT_ROOT, 'db', 'data.db'),
}

export function getDatabaseUrl(): string {
  return `file:${PATHS.dbFile}`
}
