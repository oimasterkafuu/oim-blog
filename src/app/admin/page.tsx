'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBlog } from '@/components/blog-provider'
import { AdminLogin } from '@/components/admin-login'

export default function AdminPage() {
  const { user, loading } = useBlog()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/admin/dashboard')
    }
  }, [user, loading, router])

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

  if (user) {
    return null
  }

  return <AdminLogin />
}
