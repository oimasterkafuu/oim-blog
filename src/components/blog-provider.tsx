'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Page {
  id: string
  title: string
  slug: string
}

interface BlogContextType {
  user: User | null
  setUser: (user: User | null) => void
  loading: boolean
  settings: Record<string, string>
  setSettings: (settings: Record<string, string>) => void
  categories: Category[]
  setCategories: (categories: Category[]) => void
  pages: Page[]
  setPages: (pages: Page[]) => void
}

const BlogContext = createContext<BlogContextType | null>(null)

const defaultSettings: Record<string, string> = {
  site_name: '我的博客',
  site_description: '一个简洁优雅的博客',
  site_keywords: '博客,技术,分享',
  posts_per_page: '10',
  comments_per_page: '20'
}

export function BlogProvider({ 
  children, 
  initialSettings,
  initialCategories,
  initialPages,
  initialUser
}: { 
  children: ReactNode
  initialSettings?: Record<string, string>
  initialCategories?: Category[]
  initialPages?: Page[]
  initialUser?: User | null
}) {
  const [user, setUser] = useState<User | null>(initialUser || null)
  const [loading, setLoading] = useState(!initialUser)
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings || defaultSettings)
  const [categories, setCategories] = useState<Category[]>(initialCategories || [])
  const [pages, setPages] = useState<Page[]>(initialPages || [])

  useEffect(() => {
    if (!initialUser) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => setUser(data.user))
        .catch(console.error)
        .finally(() => setLoading(false))
    }

    if (!initialSettings) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => setSettings(data.settings))
        .catch(console.error)
    }
  }, [initialUser, initialSettings])

  return (
    <BlogContext.Provider value={{ 
      user, setUser, loading, settings, setSettings, 
      categories, setCategories, pages, setPages 
    }}>
      {children}
    </BlogContext.Provider>
  )
}

export function useBlog() {
  const context = useContext(BlogContext)
  if (!context) {
    throw new Error('useBlog must be used within BlogProvider')
  }
  return context
}
