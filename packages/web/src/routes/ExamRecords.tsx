import { useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight, GraduationCap, Download, AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader } from '~/components/Loader'
import { useSelectedChannel } from '~/contexts/TelegramAuthContext'

interface ExamRecord {
  userId: number
  name: string
  completedAt: number
  score: number | null
  postId: number
}

interface ExamDay {
  key: string
  timestamp: number
  records: ExamRecord[]
}

function dayKeyOf(timestamp: number): { key: string; dayStart: number } {
  const date = new Date(timestamp)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    dayStart,
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function downloadResults(day: ExamDay, students: ExamRecord[]) {
  const date = new Date(day.timestamp)
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const rows = [
    ['الاسم', 'الدرجة'],
    ...students.map((s) => [s.name, s.score != null ? s.score.toString() : '']),
  ]
  // Quote fields; BOM so Excel opens the Arabic text as UTF-8
  const csv = '\uFEFF' + rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `نتائج-الاختبار-${isoDate}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ExamRecords() {
  const { chatId } = useSelectedChannel()
  const records = useQuery(api.queries.getExamRecords, { chatId })
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  if (records === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  // Group exam participations by day
  const days = new Map<string, ExamDay>()
  records.forEach((r: ExamRecord) => {
    const { key, dayStart } = dayKeyOf(r.completedAt)
    let day = days.get(key)
    if (!day) {
      day = { key, timestamp: dayStart, records: [] }
      days.set(key, day)
    }
    day.records.push(r)
  })

  const sortedDays = [...days.values()].sort((a, b) => b.timestamp - a.timestamp)
  const selectedDay = selectedDayKey ? days.get(selectedDayKey) : null

  // Day detail view: students and their scores
  if (selectedDay) {
    const students = [...selectedDay.records].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    const unscoredCount = students.filter((s) => s.score == null).length

    return (
      <div className="p-6 md:p-8 h-full flex flex-col">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDayKey(null)}
            className="mb-4 gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            <span>رجوع</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground mb-1">الاختبارات</h1>
              <h2 className="text-lg md:text-xl font-bold text-foreground/80">{formatDate(selectedDay.timestamp)}</h2>
            </div>
            <Button onClick={() => downloadResults(selectedDay, students)} className="gap-2">
              <Download className="h-4 w-4" />
              تحميل نتائج الاختبار
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-orange-500" />
                <span>الطالبات</span>
                <Badge variant="secondary">{students.length.toLocaleString('ar-EG')}</Badge>
                {unscoredCount > 0 && (
                  <span className="flex items-center gap-1 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {unscoredCount.toLocaleString('ar-EG')} بدون درجة
                  </span>
                )}
              </h3>
              <ul className="divide-y">
                {students.map((s, idx) => (
                  <li key={`${s.userId}-${idx}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="truncate">{s.name}</span>
                    {s.score != null ? (
                      <Badge className="bg-orange-500 hover:bg-orange-500 text-white shrink-0">
                        {s.score.toLocaleString('ar-EG')}
                      </Badge>
                    ) : (
                      <span className="flex items-center gap-1 text-sm font-medium text-destructive shrink-0">
                        <AlertTriangle className="h-4 w-4" />
                        بدون درجة
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Days list view
  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للصفحة الرئيسية</span>
          </Button>
        </Link>
        <h1 className="text-3xl font-black text-foreground mb-1">الاختبارات</h1>
        <p className="text-muted-foreground">أيام الاختبارات ونتائج الطالبات</p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {sortedDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">لا توجد اختبارات بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDays.map((day) => {
              const date = new Date(day.timestamp)
              const unscoredCount = day.records.filter((r) => r.score == null).length
              return (
                <Card
                  key={day.key}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                  onClick={() => setSelectedDayKey(day.key)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground truncate">
                          {date.toLocaleDateString('ar-EG', { weekday: 'long' })}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {date.toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      {unscoredCount > 0 && (
                        <AlertTriangle
                          className="h-5 w-5 text-destructive mr-auto shrink-0"
                          aria-label="يوجد طالبات بدون درجة"
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <Users className="h-4 w-4" />
                        {day.records.length.toLocaleString('ar-EG')} طالبات اختبرن
                      </span>
                      {unscoredCount > 0 && (
                        <span className="flex items-center gap-1 text-destructive font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          {unscoredCount.toLocaleString('ar-EG')} بدون درجة
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
