import { useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'

const PAGE_SIZE = 20

export default function Halaqas() {
  const [page, setPage] = useState(0)
  const result = useQuery(api.queries.getPaginatedPosts, { page, pageSize: PAGE_SIZE })

  if (result === undefined) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  const { posts, totalCount } = result
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronRight className="h-4 w-4" />
            <span>السابق</span>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            <span>التالي</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
