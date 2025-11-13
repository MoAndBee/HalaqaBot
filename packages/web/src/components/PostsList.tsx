import { Link } from 'wouter'
import type { Post } from '~/api/posts'

interface PostsListProps {
  posts: Post[]
}

export function PostsList({ posts }: PostsListProps) {
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-2xl text-slate-400 font-medium">No posts found</p>
          <p className="text-base text-slate-500 mt-3">
            Posts will appear here once users react to messages in the bot
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {posts.map((post) => (
        <Link
          key={`${post.chatId}-${post.postId}`}
          href={`/posts/${post.chatId}/${post.postId}`}
        >
          <a className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 hover:bg-slate-800 hover:border-slate-600 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-pointer block">
          <div className="flex flex-col gap-4">
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wide">Post ID</div>
            <div className="text-4xl font-black text-white">{post.postId}</div>
            <div className="text-base text-slate-300 mt-2">
              Chat: {post.chatId}
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-700">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span className="text-slate-300 font-semibold text-lg">
                {post.userCount} {post.userCount === 1 ? 'user' : 'users'}
              </span>
            </div>
          </div>
          </a>
        </Link>
      ))}
    </div>
  )
}
