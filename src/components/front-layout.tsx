'use client'

import Link from 'next/link'
import { useBlog } from './blog-provider'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Menu, X, Pen, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { SiteIcon } from './site-icon'

interface FrontLayoutProps {
  children: React.ReactNode
  categories: { id: string; name: string; slug: string; _count?: { posts: number } }[]
  pages: { id: string; title: string; slug: string }[]
}

export function FrontLayout({ children, categories, pages }: FrontLayoutProps) {
  const { user, settings } = useBlog()
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <SiteIcon size={28} />
              <span className="text-xl font-bold text-primary">{settings.site_name}</span>
            </Link>

            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                首页
              </Link>
              {categories.slice(0, 5).map(cat => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
                {pages.map(page => (
                  <Link
                    key={page.id}
                    href={`/page/${page.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {page.title}
                  </Link>
                ))}
            </nav>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">切换主题</span>
              </Button>

              <Link href="/admin" className="hidden md:flex">
                <Button variant="outline" size="sm">
                  {user ? (
                    <>
                      <Pen className="h-4 w-4 mr-2" />
                      管理后台
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4 mr-2" />
                      登录
                    </>
                  )}
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t">
              <nav className="flex flex-col space-y-2">
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  首页
                </Link>
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}
                {pages.map(page => (
                  <Link
                    key={page.id}
                    href={`/page/${page.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {page.title}
                  </Link>
                ))}
                <div className="pt-2 border-t">
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      {user ? (
                        <>
                          <Pen className="h-4 w-4 mr-2" />
                          管理后台
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 mr-2" />
                          登录
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 pt-24">
        {children}
      </main>

      <footer className="border-t py-8 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {settings.site_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
