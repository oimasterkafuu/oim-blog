import path from 'path'
import { existsSync } from 'fs'

function getProjectRoot(): string {
  const cwd = process.cwd()
  
  // 如果当前目录是 .next/standalone，则返回项目根目录（去掉 .next/standalone）
  if (cwd.includes('.next' + path.sep + 'standalone')) {
    return path.dirname(path.dirname(cwd))
  }
  
  // 兼容 Windows 路径分隔符
  if (cwd.replace(/\\/g, '/').includes('.next/standalone')) {
    const parts = cwd.replace(/\\/g, '/').split('/')
    const standaloneIndex = parts.indexOf('.next')
    if (standaloneIndex !== -1) {
      return parts.slice(0, standaloneIndex).join('/')
    }
  }
  
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
