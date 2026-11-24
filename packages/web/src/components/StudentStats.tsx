import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { useSelectedChannel } from '~/contexts/TelegramAuthContext'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader } from '~/components/Loader'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  SESSION_TYPES,
  SESSION_TYPE_ABBREVIATIONS,
  SESSION_TYPE_COLORS,
  SESSION_TYPE_ORDER,
} from '@/lib/session-types'
import { computeMonthlyAbsence, dayKey } from '@/lib/absence'

const fullDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

interface StudentStatsProps {
  userId: number
  onBack: () => void
}

interface Participation {
  completedAt: number
  sessionType: string
  chatId: number
  postId: number
  sessionNumber: number
  notes?: string | null
  score?: number | null
  compensatingForDates?: number[] | null
}

export function StudentStats({ userId, onBack }: StudentStatsProps) {
  // Convex only shows a student through a chat this admin runs.
  const { chatId } = useSelectedChannel()
  const user = useQuery(api.queries.getUser, { userId, chatId })
  const participations = useQuery(api.queries.getUserParticipations, { userId, chatId })
  const [currentDate, setCurrentDate] = useState(new Date())
  // Only the shown month's exam days are needed, in local time
  const absenceInputs = useQuery(api.exams.getAbsenceInputs, {
    userId,
    chatId,
    from: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime(),
    to: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).getTime(),
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Loading state - queries haven't returned yet
  if (user === undefined || participations === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  // User not found in database
  if (!user) {
    return (
      <div className="p-6 md:p-8 h-full flex flex-col">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-2">
          <ArrowRight className="h-4 w-4" />
          <span>رجوع</span>
        </Button>
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">الطالبة غير موجودة</h2>
          <p className="text-muted-foreground">لم يتم العثور على بيانات هذه الطالبة</p>
        </div>
      </div>
    )
  }

  // Get current month and year
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday, 6 = Saturday

  // Adjust for RTL: In Arabic, week starts on Saturday (6)
  // We want Sat=0, Sun=1, Mon=2, ..., Fri=6
  const adjustedStartingDay = (startingDayOfWeek + 1) % 7

  // Group participations by date (day level)
  const participationsByDate: Record<string, Participation[]> = {}
  participations.forEach((p) => {
    // For compensation participations, show on compensated dates instead of participation date
    if (p.compensatingForDates && p.compensatingForDates.length > 0) {
      p.compensatingForDates.forEach((compensationDate) => {
        const date = new Date(compensationDate)
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (!participationsByDate[dateKey]) {
          participationsByDate[dateKey] = []
        }
        participationsByDate[dateKey].push(p)
      })
    } else {
      // Regular participations show on their completedAt date
      const date = new Date(p.completedAt)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!participationsByDate[dateKey]) {
        participationsByDate[dateKey] = []
      }
      participationsByDate[dateKey].push(p)
    }
  })

  // Sort participations within each day by type for visual consistency
  Object.keys(participationsByDate).forEach((dateKey) => {
    participationsByDate[dateKey].sort((a, b) => {
      const orderA = SESSION_TYPE_ORDER[a.sessionType] || 999
      const orderB = SESSION_TYPE_ORDER[b.sessionType] || 999
      return orderA - orderB
    })
  })

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToCurrentMonth = () => {
    setCurrentDate(new Date())
  }

  const absence = absenceInputs
    ? computeMonthlyAbsence({
        year,
        month,
        today: dayKey(Date.now()),
        participations,
        courseExamTimes: absenceInputs.examTimes,
        markedExams: absenceInputs.exams,
        removedAt: absenceInputs.removedAt,
      })
    : null
  const missedUnits = absence?.units.filter((u) => !u.present) ?? []
  const percent = (fraction: number) =>
    `${Math.round(fraction * 100).toLocaleString('ar-EG')}٪`
  const shortDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Arabic month names
  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

  // Arabic day names (starting from Saturday)
  const dayNames = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة']

  // Build calendar grid
  const calendarDays = []

  // Add empty cells for days before the first of the month
  for (let i = 0; i < adjustedStartingDay; i++) {
    calendarDays.push(null)
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 gap-2">
          <ArrowRight className="h-4 w-4" />
          <span>رجوع</span>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-black text-foreground">
            {user.realName || user.telegramName}
          </h1>
          {user.username && (
            <Badge variant="secondary">@{user.username}</Badge>
          )}
        </div>
        <p className="text-muted-foreground">{user.telegramName}</p>
      </div>

      {/* Calendar Section */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">📅 سجل المشاركات</h2>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{monthName}</h3>
                <Button variant="ghost" size="sm" onClick={goToCurrentMonth}>
                  اليوم
                </Button>
              </div>

              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div>
              {/* Day names header */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-bold text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="aspect-square" />
                  }

                  const dateKey = `${year}-${month}-${day}`
                  const dayParticipations = participationsByDate[dateKey] || []
                  const hasParticipations = dayParticipations.length > 0

                  // Check if today
                  const today = new Date()
                  const isToday =
                    day === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear()

                  return (
                    <button
                      type="button"
                      key={day}
                      disabled={!hasParticipations}
                      onClick={() => setSelectedDay(day)}
                      className={`
                        rounded-lg border-2 p-0.5 sm:p-1 flex flex-col items-center min-w-0
                        transition-all min-h-[60px] disabled:cursor-default
                        ${isToday ? 'border-primary' : 'border-border'}
                        ${hasParticipations ? 'hover:scale-105 cursor-pointer bg-muted/30' : 'bg-background'}
                      `}
                    >
                      <div className="text-xs font-medium mb-1">
                        {day.toLocaleString('ar-EG')}
                      </div>
                      {hasParticipations && (
                        <div className="flex flex-col gap-0.5 w-full items-stretch">
                          {dayParticipations.map((p, idx) => {
                            const showScore = p.sessionType === 'اختبار' && p.score != null
                            return (
                              <div
                                key={idx}
                                className={`text-[11px] leading-4 sm:text-xs sm:leading-5 rounded text-white font-medium whitespace-nowrap overflow-hidden text-center ${
                                  SESSION_TYPE_COLORS[p.sessionType] || 'bg-gray-500'
                                }`}
                              >
                                <span className="md:hidden">
                                  {SESSION_TYPE_ABBREVIATIONS[p.sessionType] ?? p.sessionType}
                                </span>
                                <span className="hidden md:inline">
                                  {p.sessionType}
                                  {showScore && ` ${p.score!.toLocaleString('ar-EG')}`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {SESSION_TYPES.map((type) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 text-xs leading-5 text-white font-medium ${SESSION_TYPE_COLORS[type]}`}
                    >
                      {SESSION_TYPE_ABBREVIATIONS[type]}
                    </span>
                    <span className="text-muted-foreground">{type}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">اضغطي على اليوم لعرض التفاصيل</p>
            </div>
          </CardContent>
        </Card>

        {/* Day details */}
        <Dialog
          open={selectedDay !== null}
          onOpenChange={(open) => !open && setSelectedDay(null)}
        >
          <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
            <DialogHeader className="text-right sm:text-right">
              <DialogTitle>
                {selectedDay !== null && fullDate(new Date(year, month, selectedDay).getTime())}
              </DialogTitle>
            </DialogHeader>
            <ul className="space-y-3">
              {selectedDay !== null &&
                (participationsByDate[`${year}-${month}-${selectedDay}`] || []).map((p, idx) => {
                  const isCompensation = !!p.compensatingForDates?.length
                  return (
                    <li key={idx} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded px-2 text-sm leading-6 text-white font-bold ${
                            SESSION_TYPE_COLORS[p.sessionType] || 'bg-gray-500'
                          }`}
                        >
                          {p.sessionType}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          الحلقة {p.sessionNumber.toLocaleString('ar-EG')}
                        </span>
                        {p.score != null && (
                          <Badge variant="secondary">
                            الدرجة: {p.score.toLocaleString('ar-EG')}
                          </Badge>
                        )}
                      </div>
                      {isCompensation && (
                        <p className="text-sm text-muted-foreground">
                          تعويض، أُدّي يوم {fullDate(p.completedAt)}
                        </p>
                      )}
                      {p.notes && <p className="text-sm whitespace-pre-wrap">{p.notes}</p>}
                    </li>
                  )
                })}
            </ul>
          </DialogContent>
        </Dialog>

        {/* Absence rate for the month shown above. Rules: lib/absence.ts */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-1">📊 نسبة الغياب</h2>
            <p className="text-sm text-muted-foreground mb-4">{monthName}</p>
            {absence === null ? (
              <div className="flex justify-center py-6">
                <Loader />
              </div>
            ) : absence.rate === null ? (
              <p className="text-center py-6 text-muted-foreground">لا توجد أيام محسوبة في هذا الشهر</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-black text-destructive">{percent(absence.rate)}</div>
                    <div className="text-sm text-muted-foreground">نسبة الغياب</div>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <div className="text-3xl font-black text-green-600">{percent(1 - absence.rate)}</div>
                    <div className="text-sm text-muted-foreground">نسبة الحضور</div>
                  </div>
                </div>
                <p className="text-center font-medium">
                  غابت {absence.absent.toLocaleString('ar-EG')} من {absence.required.toLocaleString('ar-EG')}
                </p>
                {missedUnits.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">الغياب</h3>
                    <ul className="space-y-1 text-sm">
                      {missedUnits.map((u) => (
                        <li key={u.days.join(',')} className="flex flex-wrap items-center gap-2">
                          {u.kind === 'exam' && (
                            <span className={`rounded px-1.5 text-xs leading-5 text-white font-medium ${SESSION_TYPE_COLORS['اختبار']}`}>
                              {u.name ?? 'اختبار'}
                            </span>
                          )}
                          <span>{u.days.map(shortDate).join(' أو ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  كل يوم قبل اليوم يُحسب. يحضر اليوم بتسميع أو اختبار أو تعويض عنه. الاختبار يُحسب مرة واحدة ولو امتد عدة أيام، ويكفي أن تختبر في أحد أيامه، ولا يُحسب إلا بعد انتهاء آخر أيامه.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
