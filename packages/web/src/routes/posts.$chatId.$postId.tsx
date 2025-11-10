import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import { getPostUsers, updateUserPosition } from '~/api/posts'

export const Route = createFileRoute('/posts/$chatId/$postId')({
  component: PostDetail,
  pendingComponent: () => <Loader />,
  loader: async ({ params }) => {
    const chatId = Number(params.chatId)
    const postId = Number(params.postId)
    
    const users = await getPostUsers({ data: { chatId, postId } })
    return { chatId, postId, users }
  },
})

function PostDetail() {
  const { chatId, postId, users } = Route.useLoaderData()

  const handleReorder = async (userId: number, newPosition: number) => {
    await updateUserPosition({
      data: {
        chatId,
        postId,
        userId,
        newPosition,
      },
    })
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Posts
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Post {postId}</h1>
            <p className="text-slate-400 mt-1">Chat ID: {chatId}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Total Users</div>
            <div className="text-2xl font-bold text-white">{users.length}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <UserList
          chatId={chatId}
          postId={postId}
          users={users}
          onReorder={handleReorder}
        />
      </div>
    </div>
  )
}
