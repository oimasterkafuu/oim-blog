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

export type SlugType = 'post' | 'category' | 'tag' | 'page'

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
  // 将标题按中文字符和英文单词分割
  // 匹配：中文字符 或 连续的英文字母/数字
  const segments = title.match(/[\u4e00-\u9fa5]+|[a-zA-Z0-9]+/g) || []

  const slugParts: string[] = []

  for (const segment of segments) {
    // 如果是中文，转换为拼音
    if (/[\u4e00-\u9fa5]/.test(segment)) {
      const pinyinArray = pinyin(segment, {
        pattern: 'pinyin',
        toneType: 'none',
        type: 'array'
      })
      slugParts.push(...pinyinArray.filter(p => p))
    } else {
      // 如果是英文/数字，保留完整单词
      slugParts.push(segment.toLowerCase())
    }
  }

  const slug = slugParts
    .join('-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return slug || 'untitled'
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_PATHS.includes(slug.toLowerCase())
}

export async function checkSlugConflict(
  slug: string,
  db: any,
  options?: { type?: SlugType; excludeId?: string }
): Promise<{ conflict: boolean; type?: string; message?: string }> {
  const { type, excludeId } = options || {}

  if (isReservedSlug(slug)) {
    return { conflict: true, type: 'reserved', message: `别名 "${slug}" 是系统保留路径，请使用其他别名` }
  }

  // 如果指定了类型，只检查该类型的冲突
  if (type === 'post') {
    const existingPost = await db.post.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (existingPost) {
      return { conflict: true, type: 'post', message: '该别名已被文章使用' }
    }
  } else if (type === 'category') {
    const existingCategory = await db.category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (existingCategory) {
      return { conflict: true, type: 'category', message: '该别名已被分类使用' }
    }
  } else if (type === 'tag') {
    const existingTag = await db.tag.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (existingTag) {
      return { conflict: true, type: 'tag', message: '该别名已被标签使用' }
    }
  } else if (type === 'page') {
    const existingPage = await db.page.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (existingPage) {
      return { conflict: true, type: 'page', message: '该别名已被独立页面使用' }
    }
  } else {
    // 未指定类型时，检查所有类型（向后兼容）
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
  }

  return { conflict: false }
}
