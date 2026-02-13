import { FrontHome } from '@/components/front-home'
import { FrontPost } from '@/components/front-post'
import { FrontPage } from '@/components/front-page'

export default function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return <BlogContent searchParams={searchParams} />
}

async function BlogContent({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams

  const postSlug = params.post
  const pageSlug = params.page && isNaN(Number(params.page)) ? params.page : undefined
  const categorySlug = params.category
  const tagSlug = params.tag
  const searchQuery = params.search
  const page = parseInt(params.page || '1')

  if (postSlug) {
    return <FrontPost slug={postSlug} />
  }
  if (pageSlug) {
    return <FrontPage slug={pageSlug} />
  }
  return <FrontHome categorySlug={categorySlug} tagSlug={tagSlug} searchQuery={searchQuery} initialPage={page} />
}
