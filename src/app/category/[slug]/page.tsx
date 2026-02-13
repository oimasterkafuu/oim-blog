import { FrontCategory } from '@/components/front-category'

export default function CategoryPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  return Promise.all([params, searchParams]).then(([{ slug }, search]) => (
    <FrontCategory slug={slug} initialPage={parseInt(search.page || '1')} />
  ))
}
