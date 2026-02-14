'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useBlog } from '@/components/blog-provider'
import { AdminSidebar } from '@/components/admin-sidebar'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Menu } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useBlog()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user && pathname !== '/admin') {
      router.push('/admin')
    }
  }, [user, loading, router, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <>{children}</>
  }

  const getPageTitle = () => {
    if (pathname.includes('/dashboard')) return '仪表盘'
    if (pathname.includes('/posts')) return '文章管理'
    if (pathname.includes('/categories')) return '分类管理'
    if (pathname.includes('/tags')) return '标签管理'
    if (pathname.includes('/comments')) return '评论管理'
    if (pathname.includes('/pages')) return '独立页面'
    if (pathname.includes('/settings')) return '系统设置'
    return '管理后台'
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4 gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h1 className="text-lg font-semibold">{getPageTitle()}</h1>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
