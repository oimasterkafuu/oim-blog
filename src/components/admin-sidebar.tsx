'use client'

import { useBlog } from './blog-provider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  LayoutDashboard, 
  FileText, 
  FolderOpen, 
  Tag, 
  MessageCircle, 
  File, 
  Settings, 
  LogOut,
  Pen,
  X,
  Upload
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
}

const menuItems = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard, href: '/admin/dashboard' },
  { id: 'posts', label: '文章管理', icon: FileText, href: '/admin/posts' },
  { id: 'categories', label: '分类管理', icon: FolderOpen, href: '/admin/categories' },
  { id: 'tags', label: '标签管理', icon: Tag, href: '/admin/tags' },
  { id: 'comments', label: '评论管理', icon: MessageCircle, href: '/admin/comments' },
  { id: 'pages', label: '独立页面', icon: File, href: '/admin/pages' },
  { id: 'files', label: '文件管理', icon: Upload, href: '/admin/files' },
  { id: 'settings', label: '系统设置', icon: Settings, href: '/admin/settings' },
]

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const { user, setUser, settings } = useBlog()
  const pathname = usePathname()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/'
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Pen className="h-6 w-6 text-primary" />
              <span className="font-bold">{settings.site_name}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {menuItems.map(item => (
              <Link key={item.id} href={item.href}>
                <Button
                  variant={isActive(item.href) ? 'secondary' : 'ghost'}
                  className={cn(
                    "w-full justify-start cursor-pointer",
                    isActive(item.href) && "bg-secondary"
                  )}
                  onClick={onClose}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-muted-foreground text-xs">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                前台
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-1" />
              登出
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
