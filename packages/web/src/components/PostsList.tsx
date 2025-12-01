import { Link } from 'wouter'
import { Users, Eye } from 'lucide-react'
import type { Post } from '~/api/posts'
import { Card, CardContent } from './ui/card'

interface PostsListProps {
  posts: Post[]
}

export function PostsList({ posts }: PostsListProps) {
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">لا توجد منشورات</p>
          <p className="text-sm text-muted-foreground mt-2">
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
            <a className="block">
              <Card className="hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="text-2xl font-bold">{formattedDate}</div>
                    <div className="text-sm text-muted-foreground">معرف المنشور: {post.postId}</div>
                    <div className="text-sm text-muted-foreground">
                      المحادثة: {post.chatId}
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">
                        {post.userCount} مستخدم
                      </span>
                      <Link
                        href={`/posts/${post.chatId}/${post.postId}/summary`}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <a
                          className="text-primary hover:underline transition-colors"
                          title="عرض ملخص المشاركة"
                        >
                          <Eye className="h-5 w-5" />
                        </a>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          </Link>
        )
      })}
    </div>
  )
}
