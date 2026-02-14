'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, FolderOpen, Tag, MessageCircle, Eye } from 'lucide-react'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    posts: 0,
    categories: 0,
    tags: 0,
    comments: 0,
    views: 0,
    publishedPosts: 0,
    pendingComments: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/posts?limit=1000').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/tags').then(r => r.json()),
      fetch('/api/comments?limit=1000').then(r => r.json())
    ]).then(([postData, catData, tagData, commentData]) => {
      const posts = postData.posts || []
      const comments = commentData.comments || []
      
      setStats({
        posts: posts.length,
        categories: catData.categories?.length || 0,
        tags: tagData.tags?.length || 0,
        comments: comments.length,
        views: posts.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0),
        publishedPosts: posts.filter((p: any) => p.status === 'published').length,
        pendingComments: comments.filter((c: any) => c.status === 'pending').length
      })
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { title: '文章总数', value: stats.posts, subValue: `${stats.publishedPosts} 已发布`, icon: FileText, color: 'text-blue-500' },
    { title: '分类数量', value: stats.categories, icon: FolderOpen, color: 'text-green-500' },
    { title: '标签数量', value: stats.tags, icon: Tag, color: 'text-purple-500' },
    { title: '评论总数', value: stats.comments, subValue: `${stats.pendingComments} 待审核`, icon: MessageCircle, color: 'text-orange-500' },
    { title: '总浏览量', value: stats.views, icon: Eye, color: 'text-pink-500' }
  ]

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表盘</h2>
      
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.subValue && (
                <p className="text-xs text-muted-foreground">{stat.subValue}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a href="/admin/posts?edit=new" className="text-primary hover:underline">+ 撰写新文章</a>
            <a href="/admin/categories?action=new" className="text-primary hover:underline">+ 添加新分类</a>
            <a href="/admin/tags?action=new" className="text-primary hover:underline">+ 添加新标签</a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">框架版本</span>
                <span>Next.js 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">数据库</span>
                <span>SQLite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UI组件</span>
                <span>shadcn/ui</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
