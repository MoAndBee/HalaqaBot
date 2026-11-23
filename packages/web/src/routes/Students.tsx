import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight, Copy, Search, User, UserMinus, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'
import { StudentStats } from '~/components/StudentStats'
import { AddStudentModal } from '~/components/AddStudentModal'
import { RemoveStudentModal } from '~/components/RemoveStudentModal'
import { foldArabic } from '~/lib/manual-list'
import { useSelectedChannel } from '~/contexts/TelegramAuthContext'

const fold = (value: string) => foldArabic(value.toLowerCase())

export default function Students() {
  const { chatId } = useSelectedChannel()
  const roster = useQuery(api.students.getRoster, { chatId })
  const [searchQuery, setSearchQuery] = useState('')
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [toRemove, setToRemove] = useState<{ userId: number; name: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedUserId) inputRef.current?.focus()
  }, [selectedUserId])

  const duplicateCount = useMemo(
    () => roster?.filter((s) => s.duplicateKey !== null).length ?? 0,
    [roster]
  )

  // The roster arrives alphabetical; the duplicates view keeps each pair together
  const shown = useMemo(() => {
    if (!roster) return undefined
    const query = fold(searchQuery.trim())
    let list = roster.filter(
      (s) =>
        !query ||
        [s.name, s.telegramName, s.username ?? ''].some((field) => fold(field).includes(query))
    )
    if (duplicatesOnly) {
      list = list
        .filter((s) => s.duplicateKey !== null)
        .sort((a, b) => a.duplicateKey!.localeCompare(b.duplicateKey!, 'ar') || a.name.localeCompare(b.name, 'ar'))
    }
    return list
  }, [roster, searchQuery, duplicatesOnly])

  if (selectedUserId) {
    return <StudentStats userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
  }

  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للصفحة الرئيسية</span>
          </Button>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-foreground">
            الطالبات
            {roster && <span className="mr-2 text-lg font-bold text-muted-foreground">({roster.length})</span>}
          </h1>
          <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            إضافة طالبة
          </Button>
        </div>
      </div>

      <div className="relative mb-3">
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

      <div className="mb-6 flex items-center gap-2">
        <Button
          variant={duplicatesOnly ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          aria-pressed={duplicatesOnly}
          onClick={() => setDuplicatesOnly((on) => !on)}
          disabled={duplicateCount === 0 && !duplicatesOnly}
        >
          <Copy className="h-4 w-4" />
          حسابات مكررة ({duplicateCount})
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {!shown ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <User className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">
              {roster!.length === 0 ? 'لا توجد طالبات في هذه الدورة بعد' : 'لا يوجد نتائج'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shown.map((student) => (
              <Card
                key={student.userId}
                className="cursor-pointer transition-all hover:shadow-lg"
                onClick={() => setSelectedUserId(student.userId)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground mb-1 truncate">{student.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2 truncate">
                        {student.isManual ? 'مسجلة يدوياً' : student.telegramName}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {student.username && (
                          <Badge variant="secondary" className="text-xs">@{student.username}</Badge>
                        )}
                        {student.duplicateKey !== null && (
                          <Badge className="text-xs border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400 shadow-none">
                            حساب مكرر محتمل
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`إزالة ${student.name} من الدورة`}
                      title="إزالة من الدورة"
                      onClick={(e) => {
                        e.stopPropagation()
                        setToRemove({ userId: student.userId, name: student.name })
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddStudentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} chatId={chatId} />
      <RemoveStudentModal student={toRemove} chatId={chatId} onClose={() => setToRemove(null)} />
    </div>
  )
}
