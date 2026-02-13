export interface ParsedSearch {
  includeTerms: string[]
  exactTerms: string[]
  excludeTerms: string[]
}

export function parseSearchQuery(query: string): ParsedSearch {
  const includeTerms: string[] = []
  const exactTerms: string[] = []
  const excludeTerms: string[] = []
  
  const exactPhraseRegex = /"([^"]+)"/g
  let match
  let processedQuery = query
  
  while ((match = exactPhraseRegex.exec(query)) !== null) {
    exactTerms.push(match[1].toLowerCase())
    processedQuery = processedQuery.replace(match[0], ' ')
  }
  
  const terms = processedQuery.split(/\s+/).filter(t => t.length > 0)
  
  for (const term of terms) {
    if (term.startsWith('-') && term.length > 1) {
      excludeTerms.push(term.slice(1).toLowerCase())
    } else if (term.length > 0) {
      includeTerms.push(term.toLowerCase())
    }
  }
  
  return { includeTerms, exactTerms, excludeTerms }
}

export function calculateMatchScore(
  post: {
    title: string
    content?: string | null
    excerpt?: string | null
    category?: { name: string } | null
    tags?: { tag: { name: string } }[]
  },
  parsed: ParsedSearch
): number {
  let score = 0
  
  const titleLower = post.title.toLowerCase()
  const contentLower = (post.content || '').toLowerCase()
  const excerptLower = (post.excerpt || '').toLowerCase()
  const categoryNameLower = post.category?.name?.toLowerCase() || ''
  const tagNames = post.tags?.map(t => t.tag.name.toLowerCase()) || []
  
  for (const term of parsed.includeTerms) {
    if (titleLower.includes(term)) score += 10
    if (excerptLower.includes(term)) score += 5
    if (contentLower.includes(term)) score += 2
    if (categoryNameLower.includes(term)) score += 3
    for (const tagName of tagNames) {
      if (tagName.includes(term)) score += 3
    }
  }
  
  for (const phrase of parsed.exactTerms) {
    if (titleLower.includes(phrase)) score += 15
    if (excerptLower.includes(phrase)) score += 8
    if (contentLower.includes(phrase)) score += 4
    if (categoryNameLower.includes(phrase)) score += 5
    for (const tagName of tagNames) {
      if (tagName.includes(phrase)) score += 5
    }
  }
  
  return score
}

export function matchesExcludeTerms(
  post: {
    title: string
    content?: string | null
    excerpt?: string | null
    category?: { name: string } | null
    tags?: { tag: { name: string } }[]
  },
  excludeTerms: string[]
): boolean {
  if (excludeTerms.length === 0) return false
  
  const allText = [
    post.title,
    post.content || '',
    post.excerpt || '',
    post.category?.name || '',
    ...(post.tags?.map(t => t.tag.name) || [])
  ].join(' ').toLowerCase()
  
  for (const term of excludeTerms) {
    if (allText.includes(term)) {
      return true
    }
  }
  
  return false
}
