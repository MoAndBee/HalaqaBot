import { createFileRoute } from '@tanstack/react-router'
import { Loader } from '~/components/Loader'
import { PostsList } from '~/components/PostsList'
import { getPosts } from '~/api/posts'

export const Route = createFileRoute('/')({
  component: Home,
  pendingComponent: () => <Loader />,
  loader: async () => {
    const posts = await getPosts({ data: undefined })
    return { posts }
  },
})

function Home() {
  const { posts } = Route.useLoaderData()

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-3xl font-black text-white mb-6">Posts</h1>
      <div className="flex-1 min-h-0">
        <PostsList posts={posts} />
      </div>
    </div>
  )
}
