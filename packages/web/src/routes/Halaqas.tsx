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
  // cursors[0] = null (first page), cursors[1] = cursor for page 2, etc.
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [page, setPage] = useState(0)

  const result = useQuery(api.queries.getPaginatedPosts, {
    paginationOpts: { numItems: PAGE_SIZE, cursor: cursors[page] },
  })

  if (result === undefined) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  const goNext = () => {
    if (!result.isDone && result.continueCursor) {
      setCursors((prev) => {
        const next = [...prev]
        if (next.length <= page + 1) next.push(result.continueCursor)
        return next
      })
      setPage((p) => p + 1)
    }
  }

  const goPrev = () => {
    if (page > 0) setPage((p) => p - 1)
  }

  const hasNext = !result.isDone
  const hasPrev = page > 0

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
        <PostsList posts={result.page} />
      </div>
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={!hasPrev}>
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page + 1}</span>
          <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext}>
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
