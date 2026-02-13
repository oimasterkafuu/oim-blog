'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FrontLayout } from './front-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBlog } from './blog-provider'
import { PostCard, Post } from './post-card'

interface FrontTagProps {
  slug: string
  initialPage?: number
}

export function FrontTag({ slug, initialPage = 1 }: FrontTagProps) {
  const { settings, categories, pages } = useBlog()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [tagName, setTagName] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(initialPage)
  const fetchingRef = useRef(false)

  const fetchPosts = useCallback(async (page: number = 1, updateUrl: boolean = true) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    const params = new URLSearchParams()
    params.set('tag', slug)
    params.set('limit', settings.posts_per_page || '10')
    params.set('page', String(page))

    try {
      const res = await fetch(`/api/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
      setCurrentPage(page)
      if (updateUrl) {
        const url = page > 1 ? `/tag/${slug}?page=${page}` : `/tag/${slug}`
        router.push(url)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [slug, settings.posts_per_page, router])

  useEffect(() => {
    fetchingRef.current = false
    const pageFromUrl = parseInt(searchParams.get('page') || '1')
    const pageToFetch = pageFromUrl !== currentPage ? pageFromUrl : initialPage
    fetchPosts(pageToFetch, false)
  }, [fetchPosts, searchParams, initialPage])

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(tagData => {
        const tag = (tagData.tags || []).find((t: any) => t.slug === slug)
        if (tag) setTagName(tag.name)
      })
  }, [slug])

  return (
    <FrontLayout categories={categories} pages={pages}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">标签: {tagName || slug}</h1>

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
            <p className="text-muted-foreground">该标签下暂无文章</p>
            <Link href="/" className="text-primary hover:underline mt-4 inline-block">返回首页</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <PostCard key={post.id} post={post} highlightTagSlug={slug} />
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