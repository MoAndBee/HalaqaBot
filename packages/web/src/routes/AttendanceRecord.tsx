import { useState } from 'react'
import { Link } from 'wouter'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { ArrowRight, CalendarDays, Check, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader } from '~/components/Loader'
import { useSelectedChannel } from '~/contexts/TelegramAuthContext'

interface RosterUser {
  userId: number
  telegramName: string | null
  realName: string | null
  username: string | null
}

interface AttendanceParticipation {
  userId: number
  completedAt: number
  sessionType: string
  compensatingForDates: number[] | null
  postId: number
}

interface DayRecord {
  key: string
  timestamp: number
  // performedAt is set for compensations: when the make-up was actually done
  attendees: Map<number, { isCompensation: boolean; performedAt?: number }>
}

function dayKeyOf(timestamp: number): { key: string; dayStart: number } {
  const date = new Date(timestamp)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    dayStart,
  }
}

function displayName(user: RosterUser | undefined, userId: number): string {
  if (!user) return `#${userId}`
  return user.realName || user.telegramName || (user.username ? `@${user.username}` : `#${userId}`)
}

export default function AttendanceRecord() {
  const { chatId } = useSelectedChannel()
  const data = useQuery(api.queries.getTasmeeAttendance, { chatId })
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  const usersById = new Map<number, RosterUser>(
    data.roster.map((u: RosterUser) => [u.userId, u])
  )

  // Group تسميع attendance by day. Compensation entries count toward the days
  // they compensate (same convention as the per-student calendar).
  const days = new Map<string, DayRecord>()
  const markAttendance = (
    timestamp: number,
    userId: number,
    isCompensation: boolean,
    performedAt?: number
  ) => {
    const { key, dayStart } = dayKeyOf(timestamp)
    let record = days.get(key)
    if (!record) {
      record = { key, timestamp: dayStart, attendees: new Map() }
      days.set(key, record)
    }
    // A direct تسميع wins over a compensation mark for the same day
    const existing = record.attendees.get(userId)
    if (!existing || (existing.isCompensation && !isCompensation)) {
      record.attendees.set(userId, { isCompensation, performedAt })
    }
  }

  data.participations.forEach((p: AttendanceParticipation) => {
    if (p.compensatingForDates && p.compensatingForDates.length > 0) {
      p.compensatingForDates.forEach((d) => markAttendance(d, p.userId, true, p.completedAt))
    } else {
      markAttendance(p.completedAt, p.userId, false)
    }
  })

  const sortedDays = [...days.values()].sort((a, b) => b.timestamp - a.timestamp)
  const selectedDay = selectedDayKey ? days.get(selectedDayKey) : null

  // Day detail view
  if (selectedDay) {
    const allMarked = [...selectedDay.attendees.entries()]
      .map(([userId, info]) => ({
        userId,
        isCompensation: info.isCompensation,
        performedAt: info.performedAt,
        name: displayName(usersById.get(userId), userId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

    const attendees = allMarked.filter((a) => !a.isCompensation)
    const compensators = allMarked.filter((a) => a.isCompensation)

    const absentees = data.roster
      .filter((u: RosterUser) => !selectedDay.attendees.has(u.userId))
      .map((u: RosterUser) => ({ userId: u.userId, name: displayName(u, u.userId) }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ar'))

    const date = new Date(selectedDay.timestamp)
    const formattedDate = date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

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
          <h1 className="text-2xl md:text-3xl font-black text-foreground mb-1">سجل الحضور - تسميع</h1>
          <h2 className="text-lg md:text-xl font-bold text-foreground/80">{formattedDate}</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-auto space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <span>حضرن</span>
                <Badge variant="secondary">{attendees.length.toLocaleString('ar-EG')}</Badge>
              </h3>
              {attendees.length === 0 ? (
                <p className="text-muted-foreground">لا يوجد حضور في هذا اليوم</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {attendees.map((a) => (
                    <li
                      key={a.userId}
                      className="flex items-center gap-2 rounded-lg border p-2 bg-green-500/5 border-green-500/30"
                    >
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="truncate">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-yellow-600" />
                <span>عوّضن</span>
                <Badge variant="secondary">{compensators.length.toLocaleString('ar-EG')}</Badge>
              </h3>
              {compensators.length === 0 ? (
                <p className="text-muted-foreground">لا توجد تعويضات لهذا اليوم</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {compensators.map((a) => (
                    <li
                      key={a.userId}
                      className="flex flex-col gap-1 rounded-lg border p-2 bg-yellow-500/5 border-yellow-500/30"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <span className="truncate">{a.name}</span>
                      </span>
                      {a.performedAt && (
                        <span className="text-xs text-muted-foreground pr-6">
                          عوّضت يوم{' '}
                          {new Date(a.performedAt).toLocaleDateString('ar-EG', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <X className="h-5 w-5 text-red-600" />
                <span>لم يحضرن</span>
                <Badge variant="secondary">{absentees.length.toLocaleString('ar-EG')}</Badge>
              </h3>
              {absentees.length === 0 ? (
                <p className="text-muted-foreground">حضرت جميع الطالبات 🎉</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {absentees.map((a: { userId: number; name: string }) => (
                    <li
                      key={a.userId}
                      className="flex items-center gap-2 rounded-lg border p-2 bg-red-500/5 border-red-500/20"
                    >
                      <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="truncate text-muted-foreground">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
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
        <h1 className="text-3xl font-black text-foreground mb-1">سجل الحضور</h1>
        <p className="text-muted-foreground">أيام التسميع ومن حضرن ومن لم يحضرن</p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {sortedDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarDays className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">لا توجد مشاركات تسميع بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDays.map((day) => {
              const date = new Date(day.timestamp)
              const marked = [...day.attendees.values()]
              const attendedCount = marked.filter((m) => !m.isCompensation).length
              const compensatedCount = marked.length - attendedCount
              const absentCount = data.roster.length - marked.length
              return (
                <Card
                  key={day.key}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                  onClick={() => setSelectedDayKey(day.key)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CalendarDays className="h-5 w-5 text-primary" />
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
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <Check className="h-4 w-4" />
                        {attendedCount.toLocaleString('ar-EG')} حضرن
                      </span>
                      <span className="flex items-center gap-1 text-yellow-600 font-medium">
                        <RefreshCw className="h-4 w-4" />
                        {compensatedCount.toLocaleString('ar-EG')} عوّضن
                      </span>
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <X className="h-4 w-4" />
                        {absentCount.toLocaleString('ar-EG')} لم يحضرن
                      </span>
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
