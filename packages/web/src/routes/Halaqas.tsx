import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'

export default function Halaqas() {
  const posts = useQuery(api.queries.getAllPosts) ?? []

  if (posts === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-3xl font-black text-foreground mb-6">الحلقات</h1>
      <div className="flex-1 min-h-0">
        <PostsList posts={posts} />
      </div>
    </div>
  )
}
