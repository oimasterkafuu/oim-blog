'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FrontLayout } from './front-layout'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, MessageCircle, User, Search } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useBlog } from './blog-provider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  content?: string
  createdAt: string
  author: { id: string; name: string }
  category: { id: string; name: string; slug: string } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count?: { comments: number }
  viewCount: number
}

interface FrontHomeProps {
  categorySlug?: string
  tagSlug?: string
  searchQuery?: string
  initialPage?: number
}

export function FrontHome({ categorySlug, tagSlug, searchQuery, initialPage = 1 }: FrontHomeProps) {
  const { settings, categories, pages } = useBlog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchQuery || '')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(initialPage)
  const fetchingRef = useRef(false)

  const buildUrl = useCallback((page: number) => {
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set('q', searchQuery)
    }
    if (page > 1) {
      params.set('page', String(page))
    }
    const queryString = params.toString()
    if (categorySlug) {
      return queryString ? `/category/${categorySlug}?${queryString}` : `/category/${categorySlug}`
    }
    if (tagSlug) {
      return queryString ? `/tag/${tagSlug}?${queryString}` : `/tag/${tagSlug}`
    }
    if (searchQuery) {
      return queryString ? `/search?${queryString}` : '/search'
    }
    return queryString ? `/?${queryString}` : '/'
  }, [categorySlug, tagSlug, searchQuery])

  const fetchPosts = useCallback(async (page: number = 1, updateUrl: boolean = true) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    
    const params = new URLSearchParams()
    if (categorySlug) params.set('category', categorySlug)
    if (tagSlug) params.set('tag', tagSlug)
    if (searchQuery) params.set('search', searchQuery)
    params.set('limit', settings.posts_per_page || '10')
    params.set('page', String(page))

    try {
      const res = await fetch(`/api/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
      setCurrentPage(page)
      if (updateUrl) {
        router.push(buildUrl(page))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [categorySlug, tagSlug, searchQuery, settings.posts_per_page, router, buildUrl])

  useEffect(() => {
    const pageFromUrl = parseInt(searchParams.get('page') || '1')
    const pageToFetch = pageFromUrl !== currentPage ? pageFromUrl : initialPage
    fetchPosts(pageToFetch, false)
  }, [fetchPosts, searchParams, initialPage])

  const handleSearch = () => {
    if (searchInput.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchInput.trim())}`
    }
  }

  const getTitle = () => {
    if (searchQuery) return `搜索: ${searchQuery}`
    if (categorySlug) {
      const cat = categories.find(c => c.slug === categorySlug)
      return cat ? `分类: ${cat.name}` : '文章列表'
    }
    if (tagSlug) return `标签: ${tagSlug}`
    return '最新文章'
  }

  return (
    <FrontLayout categories={categories} pages={pages}>
      <div className="max-w-4xl mx-auto">
        {/* Search Bar */}
        <div className="flex gap-2 mb-8">
          <Input
            placeholder="搜索文章..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="max-w-sm"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-8">{getTitle()}</h1>

        {/* Posts */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">暂无文章</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <Link href={`/post/${post.slug}`}>
                    <h2 className="text-xl font-semibold hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                  </Link>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(post.createdAt), 'PPP', { locale: zhCN })}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {post.author.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {post.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {post._count?.comments || 0}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.coverImage && (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}
                  <p className="text-muted-foreground line-clamp-3">
                    {post.excerpt || post.content?.slice(0, 200) + '...'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {post.category && (
                      <Link href={`/category/${post.category.slug}`}>
                        <Badge variant="secondary">{post.category.name}</Badge>
                      </Link>
                    )}
                    {post.tags?.map(t => (
                      <Link key={t.tag.id} href={`/tag/${t.tag.slug}`}>
                        <Badge variant="outline">{t.tag.name}</Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPosts(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              上一页
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let page: number
              if (pagination.totalPages <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= pagination.totalPages - 2) {
                page = pagination.totalPages - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => fetchPosts(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPosts(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </FrontLayout>
  )
}
