'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Eye, MessageCircle, User } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MarkdownRenderer } from './markdown'

export interface Post {
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

interface PostCardProps {
  post: Post
  showCategory?: boolean
  highlightTagSlug?: string
}

export function PostCard({ post, showCategory = true, highlightTagSlug }: PostCardProps) {
  const excerptContent = post.excerpt || post.content?.slice(0, 200) + '...' || ''

  return (
    <Card className="hover:shadow-lg transition-shadow">
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
        <div className="text-muted-foreground line-clamp-3">
          <MarkdownRenderer content={excerptContent} className="!my-0 prose-sm" />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {showCategory && post.category && (
            <Link href={`/category/${post.category.slug}`}>
              <Badge variant="secondary">{post.category.name}</Badge>
            </Link>
          )}
          {post.tags?.map(t => (
            <Link key={t.tag.id} href={`/tag/${t.tag.slug}`}>
              <Badge variant={t.tag.slug === highlightTagSlug ? 'default' : 'outline'}>
                {t.tag.name}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
