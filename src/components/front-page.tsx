'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { FrontLayout } from './front-layout'
import { MarkdownRenderer } from './markdown'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useBlog } from './blog-provider'

interface Page {
  id: string
  title: string
  slug: string
  content: string
  status: string
}

interface FrontPageProps {
  slug: string
}

export function FrontPage({ slug }: FrontPageProps) {
  const { categories, pages } = useBlog()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const res = await fetch(`/api/pages/${slug}`)
      const data = await res.json()
      if (data.page && data.page.status === 'published') {
        setPage(data.page)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [slug])

  useEffect(() => {
    fetchPage()
  }, [fetchPage])

  if (loading) {
    return (
      <FrontLayout categories={categories} pages={pages}>
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </FrontLayout>
    )
  }

  if (!page) {
    return (
      <FrontLayout categories={categories} pages={pages}>
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">页面不存在</h1>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </FrontLayout>
    )
  }

  return (
    <FrontLayout categories={categories} pages={pages}>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回首页
        </Link>

        {/* Page Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">{page.title}</h1>
        </header>

        {/* Page Content */}
        <MarkdownRenderer content={page.content} />
      </div>
    </FrontLayout>
  )
}
