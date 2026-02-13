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
