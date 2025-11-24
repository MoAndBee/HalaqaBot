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
          <p className="text-xl text-gray-600 dark:text-slate-400">لا توجد منشورات</p>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">
            ستظهر المنشورات هنا بمجرد تفاعل المستخدمين مع الرسائل في البوت
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {posts.map((post) => {
        const date = new Date(post.createdAt)
        const formattedDate = date.toLocaleDateString('ar-EG', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })

        return (
          <Link
            key={`${post.chatId}-${post.postId}`}
            href={`/posts/${post.chatId}/${post.postId}`}
          >
            <a className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-slate-750 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer block">
            <div className="flex flex-col gap-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formattedDate}</div>
              <div className="text-sm text-gray-600 dark:text-slate-400">معرف المنشور: {post.postId}</div>
              <div className="text-sm text-gray-600 dark:text-slate-400">
                المحادثة: {post.chatId}
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-slate-400"
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
                <span className="text-gray-700 dark:text-slate-300 font-medium">
                  {post.userCount} مستخدم
                </span>
                <Link
                  href={`/posts/${post.chatId}/${post.postId}/summary`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <a
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    title="عرض ملخص المشاركة"
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </a>
                </Link>
              </div>
            </div>
            </a>
          </Link>
        )
      })}
    </div>
  )
}
