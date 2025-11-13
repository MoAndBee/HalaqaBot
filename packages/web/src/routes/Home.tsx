import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'

export default function Home() {
  const posts = useQuery(api.queries.getAllPosts) ?? []

  if (posts === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 md:p-10 h-full flex flex-col">
      <h1 className="text-4xl sm:text-5xl font-black text-white mb-8">Posts</h1>
      <div className="flex-1 min-h-0">
        <PostsList posts={posts} />
      </div>
    </div>
  )
}
