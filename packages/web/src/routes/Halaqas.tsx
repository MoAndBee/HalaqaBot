import { Link } from 'wouter'
import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'

const PAGE_SIZE = 10

export default function Halaqas() {
  const posts = useQuery(api.queries.getAllPosts)
  const [page, setPage] = useState(0)

  if (posts === undefined) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  const totalPages = Math.ceil(posts.length / PAGE_SIZE)
  const paginatedPosts = posts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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
        <PostsList posts={paginatedPosts} />
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
