import { Link } from 'wouter'
import { Users, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Post } from '~/api/posts'

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
            <Card className="cursor-pointer hover:bg-accent/50 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{formattedDate}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">معرف المنشور: {post.postId}</p>
                <p className="text-sm text-muted-foreground">المحادثة: {post.chatId}</p>
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{post.userCount} مستخدم</span>
                  </div>
                  <Link
                    href={`/posts/${post.chatId}/${post.postId}/summary`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <span
                      className="text-primary hover:text-primary/80 transition-colors inline-flex"
                      title="عرض ملخص المشاركة"
                    >
                      <Eye className="h-5 w-5" />
                    </span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
