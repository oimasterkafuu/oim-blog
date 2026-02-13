'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { FrontLayout } from './front-layout'
import { MarkdownRenderer } from './markdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Eye, MessageCircle, User, ArrowLeft, Tag, FolderOpen } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useBlog } from './blog-provider'
import { toast } from 'sonner'

interface Post {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  createdAt: string
  updatedAt: string
  allowComment: boolean
  viewCount: number
  author: { id: string; name: string; email: string }
  category: { id: string; name: string; slug: string } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count?: { comments: number }
}

interface Comment {
  id: string
  content: string
  authorName: string
  authorEmail: string
  authorUrl: string | null
  createdAt: string
  replies?: Comment[]
}

interface FrontPostProps {
  slug: string
}

export function FrontPost({ slug }: FrontPostProps) {
  const { user, settings, categories, pages } = useBlog()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentForm, setCommentForm] = useState({
    authorName: '',
    authorEmail: '',
    authorUrl: '',
    content: ''
  })

  useEffect(() => {
    if (user) {
      setCommentForm(prev => ({
        ...prev,
        authorName: user.name,
        authorEmail: user.email,
        authorUrl: '/'
      }))
    } else {
      const savedName = localStorage.getItem('comment_author_name')
      const savedEmail = localStorage.getItem('comment_author_email')
      const savedUrl = localStorage.getItem('comment_author_url')
      if (savedName || savedEmail || savedUrl) {
        setCommentForm(prev => ({
          ...prev,
          authorName: savedName || '',
          authorEmail: savedEmail || '',
          authorUrl: savedUrl || ''
        }))
      }
    }
  }, [user])
  const [commentPagination, setCommentPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [currentCommentPage, setCurrentCommentPage] = useState(1)
  const fetchingRef = useRef(false)

  const fetchPost = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const res = await fetch(`/api/posts/${slug}`)
      const data = await res.json()
      if (data.post) {
        setPost(data.post)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [slug])

  const fetchComments = useCallback(async (page: number = 1) => {
    if (!post) return
    setCommentsLoading(true)

    const params = new URLSearchParams()
    params.set('postId', post.id)
    params.set('limit', settings.comments_per_page || '20')
    params.set('page', String(page))

    try {
      const res = await fetch(`/api/comments?${params}`)
      const data = await res.json()
      setComments(data.comments || [])
      setCommentPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
      setCurrentCommentPage(page)
    } catch (error) {
      console.error(error)
    } finally {
      setCommentsLoading(false)
    }
  }, [post, settings.comments_per_page])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  useEffect(() => {
    if (post) {
      fetchComments(1)
    }
  }, [post, fetchComments])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!post) return

    if (!commentForm.authorName || !commentForm.authorEmail || !commentForm.content) {
      toast.error('请填写完整信息')
      return
    }

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...commentForm,
          postId: post.id
        })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        if (!user) {
          localStorage.setItem('comment_author_name', commentForm.authorName)
          localStorage.setItem('comment_author_email', commentForm.authorEmail)
          localStorage.setItem('comment_author_url', commentForm.authorUrl)
        }
        setCommentForm(prev => ({ ...prev, content: '' }))
        fetchComments(currentCommentPage)
        fetchPost()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('发表评论失败')
    }
  }

  if (loading) {
    return (
      <FrontLayout categories={categories} pages={pages}>
        <div className="max-w-4xl mx-auto animate-pulse">
          <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </FrontLayout>
    )
  }

  if (!post) {
    return (
      <FrontLayout categories={categories} pages={pages}>
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold mb-4">文章不存在</h1>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </FrontLayout>
    )
  }

  return (
    <FrontLayout categories={categories} pages={pages}>
      <article className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回首页
        </Link>

        {/* Post Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
              {post.viewCount} 次阅读
            </span>
          </div>

          {/* Category and Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {post.category && (
              <Link href={`/category/${post.category.slug}`}>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {post.category.name}
                </Badge>
              </Link>
            )}
            {post.tags?.map(t => (
              <Link key={t.tag.id} href={`/tag/${t.tag.slug}`}>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {t.tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        </header>

        {/* Cover Image */}
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-64 md:h-96 object-cover rounded-lg mb-8"
          />
        )}

        {/* Post Content */}
        <div className="mb-12">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* Comments Section */}
        <section className="border-t pt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            评论 ({commentPagination.total || post._count?.comments || 0})
          </h2>

          {/* Comment Form */}
          {post.allowComment ? (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">发表评论</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitComment} className="space-y-4">
                  {!user && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="authorName">姓名 *</Label>
                        <Input
                          id="authorName"
                          value={commentForm.authorName}
                          onChange={e => setCommentForm({ ...commentForm, authorName: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="authorEmail">邮箱 *</Label>
                        <Input
                          id="authorEmail"
                          type="email"
                          value={commentForm.authorEmail}
                          onChange={e => setCommentForm({ ...commentForm, authorEmail: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="authorUrl">网站</Label>
                        <Input
                          id="authorUrl"
                          type="url"
                          value={commentForm.authorUrl}
                          onChange={e => setCommentForm({ ...commentForm, authorUrl: e.target.value })}
                          placeholder="https://"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="content">评论内容 *</Label>
                    <Textarea
                      id="content"
                      rows={4}
                      value={commentForm.content}
                      onChange={e => setCommentForm({ ...commentForm, content: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit">发表评论</Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground mb-8">评论已关闭</p>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载评论中...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无评论</div>
          ) : (
            <>
              <div className="space-y-6">
                {comments.map(comment => (
                  <Card key={comment.id}>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-2">
                        {comment.authorUrl && comment.authorUrl !== '/' ? (
                          <a
                            href={comment.authorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {comment.authorName}
                          </a>
                        ) : comment.authorUrl === '/' ? (
                          <a
                            href="/"
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {comment.authorName}
                          </a>
                        ) : (
                          <span className="font-medium">{comment.authorName}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.createdAt), 'PPP', { locale: zhCN })}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{comment.content}</p>

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-8 mt-4 space-y-4 border-l-2 pl-4">
                          {comment.replies.map(reply => (
                            <div key={reply.id}>
                              <div className="flex items-center gap-2 mb-1">
                                {reply.authorUrl && reply.authorUrl !== '/' ? (
                                  <a
                                    href={reply.authorUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:text-primary transition-colors"
                                  >
                                    {reply.authorName}
                                  </a>
                                ) : reply.authorUrl === '/' ? (
                                  <a
                                    href="/"
                                    className="font-medium hover:text-primary transition-colors"
                                  >
                                    {reply.authorName}
                                  </a>
                                ) : (
                                  <span className="font-medium">{reply.authorName}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(reply.createdAt), 'PPP', { locale: zhCN })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Comment Pagination */}
              {commentPagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchComments(currentCommentPage - 1)}
                    disabled={currentCommentPage <= 1}
                  >
                    上一页
                  </Button>
                  {Array.from({ length: Math.min(5, commentPagination.totalPages) }, (_, i) => {
                    let page: number
                    if (commentPagination.totalPages <= 5) {
                      page = i + 1
                    } else if (currentCommentPage <= 3) {
                      page = i + 1
                    } else if (currentCommentPage >= commentPagination.totalPages - 2) {
                      page = commentPagination.totalPages - 4 + i
                    } else {
                      page = currentCommentPage - 2 + i
                    }
                    return (
                      <Button
                        key={page}
                        variant={page === currentCommentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => fetchComments(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchComments(currentCommentPage + 1)}
                    disabled={currentCommentPage >= commentPagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </article>
    </FrontLayout>
  )
}
