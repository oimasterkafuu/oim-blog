import { FrontTag } from '@/components/front-tag'

export default function TagPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  return Promise.all([params, searchParams]).then(([{ slug }, search]) => (
    <FrontTag slug={slug} initialPage={parseInt(search.page || '1')} />
  ))
}
