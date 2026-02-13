import { FrontPage } from '@/components/front-page'

export default function PagePage({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => <FrontPage slug={slug} />)
}
