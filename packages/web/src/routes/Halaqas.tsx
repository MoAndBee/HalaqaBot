import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'

export default function Halaqas() {
  const posts = useQuery(api.queries.getAllPosts)

  if (posts === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للصفحة الرئيسية</span>
          </Button>
        </Link>
        <h1 className="text-3xl font-black text-foreground">الحلقات</h1>
      </div>
      <div className="flex-1 min-h-0">
        <PostsList posts={posts} />
      </div>
    </div>
  )
}
