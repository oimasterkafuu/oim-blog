import { FrontHome } from '@/components/front-home'

export default function SearchPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return <SearchContent searchParams={searchParams} />
}

async function SearchContent({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const params = await searchParams
  const query = params.q || ''
  const page = parseInt(params.page || '1')
  
  return <FrontHome searchQuery={query} initialPage={page} />
}
