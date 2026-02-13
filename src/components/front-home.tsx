'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FrontLayout } from './front-layout'
import { Card, CardContent } from '@/components/ui/card'
import { useBlog } from './blog-provider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { PostCard, Post } from './post-card'

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
              <PostCard key={post.id} post={post} />
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