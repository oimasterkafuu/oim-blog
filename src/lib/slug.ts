import { pinyin } from 'pinyin-pro'

export const RESERVED_PATHS = [
  'admin',
  'api',
  'post',
  'category',
  'tag',
  'page',
  'search',
  'login',
  'logout',
  'register',
  'settings',
  'dashboard',
  'posts',
  'categories',
  'tags',
  'pages',
  'comments',
  'init',
  'backup',
  'restore',
  'auth',
  'user',
  'ai',
  'slug'
]

// 验证 slug 是否只包含安全的英文字符
export function isValidSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.trim() === '') {
    return { valid: false, error: '别名不能为空' }
  }

  // 检查是否包含中文字符
  if (/[\u4e00-\u9fa5]/.test(slug)) {
    return { valid: false, error: '别名不能包含中文字符，请使用英文、数字或连字符' }
  }

  // 检查是否包含需要转译的字符（只允许字母、数字、连字符）
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    return { valid: false, error: '别名只能包含英文字母、数字和连字符（-）' }
  }

  // 检查是否以连字符开头或结尾
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: '别名不能以连字符开头或结尾' }
  }

  // 检查连续连字符
  if (/--/.test(slug)) {
    return { valid: false, error: '别名不能包含连续的连字符' }
  }

  return { valid: true }
}

export function generateSlug(title: string): string {
  const slug = pinyin(title, {
    pattern: 'pinyin',
    toneType: 'none',
    type: 'array'
  })
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || 'untitled'
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_PATHS.includes(slug.toLowerCase())
}

export async function checkSlugConflict(slug: string, db: any, excludeId?: string): Promise<{ conflict: boolean; type?: string; message?: string }> {
  if (isReservedSlug(slug)) {
    return { conflict: true, type: 'reserved', message: `别名 "${slug}" 是系统保留路径，请使用其他别名` }
  }

  const existingPost = await db.post.findFirst({
    where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }
  })
  if (existingPost) {
    return { conflict: true, type: 'post', message: '该别名已被文章使用' }
  }

  const existingCategory = await db.category.findUnique({ where: { slug } })
  if (existingCategory) {
    return { conflict: true, type: 'category', message: '该别名已被分类使用' }
  }

  const existingTag = await db.tag.findUnique({ where: { slug } })
  if (existingTag) {
    return { conflict: true, type: 'tag', message: '该别名已被标签使用' }
  }

  const existingPage = await db.page.findUnique({ where: { slug } })
  if (existingPage) {
    return { conflict: true, type: 'page', message: '该别名已被独立页面使用' }
  }

  return { conflict: false }
}
