import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader } from '~/components/Loader'

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
  compensatingForDates?: number[] | null
}

// Color mapping for session types
const SESSION_TYPE_COLORS: Record<string, string> = {
  'تلاوة': 'bg-green-500',
  'تسميع': 'bg-blue-500',
  'تطبيق': 'bg-purple-500',
  'اختبار': 'bg-orange-500',
  'تعويض': 'bg-yellow-500',
}

export function StudentStats({ userId, onBack }: StudentStatsProps) {
  const user = useQuery(api.queries.getUser, { userId })
  const participations = useQuery(api.queries.getUserParticipations, { userId })
  const [currentDate, setCurrentDate] = useState(new Date())

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
    const date = new Date(p.completedAt)
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (!participationsByDate[dateKey]) {
      participationsByDate[dateKey] = []
    }
    participationsByDate[dateKey].push(p)
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

  // Arabic month names
  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })

  // Arabic day names (starting from Saturday)
  const dayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

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
                    <div
                      key={day}
                      className={`
                        rounded-lg border-2 p-1 flex flex-col items-center
                        transition-all
                        ${isToday ? 'border-primary' : 'border-border'}
                        ${hasParticipations ? 'hover:scale-105 cursor-pointer bg-muted/30' : 'bg-background'}
                      `}
                    >
                      <div className="text-xs font-medium mb-1">
                        {day.toLocaleString('ar-EG')}
                      </div>
                      {hasParticipations && (
                        <div className="flex flex-col gap-0.5 w-full items-center">
                          {dayParticipations.slice(0, 2).map((p, idx) => (
                            <div
                              key={idx}
                              className={`text-[10px] px-1 py-0.5 rounded text-white font-medium ${
                                SESSION_TYPE_COLORS[p.sessionType] || 'bg-gray-500'
                              }`}
                              title={p.sessionType}
                            >
                              {p.sessionType}
                            </div>
                          ))}
                          {dayParticipations.length > 2 && (
                            <div className="text-[10px] text-muted-foreground font-medium">
                              +{dayParticipations.length - 2}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Section - Placeholder */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">📊 الإحصائيات</h2>
            <div className="text-center py-8 text-muted-foreground">
              <p>قريباً - سيتم إضافة إحصائيات إضافية</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
