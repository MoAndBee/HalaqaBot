import { Link } from 'wouter'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Users } from 'lucide-react'

export default function Home() {
  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-3xl font-black text-foreground mb-8">الصفحة الرئيسية</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <Link href="/halaqas">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 h-48">
            <CardContent className="flex flex-col items-center justify-center h-full p-6">
              <BookOpen className="h-16 w-16 mb-4 text-primary" />
              <h2 className="text-2xl font-bold text-foreground mb-2">الحلقات</h2>
              <p className="text-muted-foreground text-center">عرض وإدارة الحلقات</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/students">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 h-48">
            <CardContent className="flex flex-col items-center justify-center h-full p-6">
              <Users className="h-16 w-16 mb-4 text-primary" />
              <h2 className="text-2xl font-bold text-foreground mb-2">الطالبات</h2>
              <p className="text-muted-foreground text-center">البحث عن الطالبات وعرض إحصائياتهن</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
