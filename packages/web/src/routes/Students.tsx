import { useState, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Search, User, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'
import { StudentStats } from '~/components/StudentStats'

export default function Students() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const searchResults = useQuery(api.queries.searchUsers, { query: debouncedQuery })

  useEffect(() => {
    if (!selectedUserId) {
      inputRef.current?.focus()
    }
  }, [selectedUserId])

  const handleSelectStudent = (userId: number) => {
    setSelectedUserId(userId)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const handleBack = () => {
    setSelectedUserId(null)
  }

  // If a student is selected, show their stats
  if (selectedUserId) {
    return <StudentStats userId={selectedUserId} onBack={handleBack} />
  }

  // Otherwise show search interface
  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للصفحة الرئيسية</span>
          </Button>
        </Link>
        <h1 className="text-3xl font-black text-foreground">الطالبات</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="ابحث عن طالبة بالاسم أو المعرف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-12 text-lg h-12"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {debouncedQuery.trim() === '' ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Search className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">ابدأ الكتابة للبحث عن طالبة</p>
          </div>
        ) : !searchResults ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">لا يوجد نتائج</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((user: { userId: number; telegramName: string; realName?: string | null; username?: string | null }) => (
              <Card
                key={user.userId}
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                onClick={() => handleSelectStudent(user.userId)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground mb-1 truncate">
                        {user.realName || user.telegramName}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2 truncate">
                        {user.telegramName}
                      </p>
                      {user.username && (
                        <Badge variant="secondary" className="text-xs">
                          @{user.username}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
