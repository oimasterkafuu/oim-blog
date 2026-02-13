import { FrontPost } from '@/components/front-post'

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => <FrontPost slug={slug} />)
}
