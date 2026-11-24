import { useState } from 'react'
import { Link } from 'wouter'
import { useMutation, useQuery } from 'convex/react'
import { api, type Id } from '@halakabot/db'
import {
  ArrowRight,
  GraduationCap,
  Copy,
  AlertTriangle,
  Users,
  ClipboardPaste,
  CalendarRange,
  Pencil,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Loader } from '~/components/Loader'
import { useSelectedChannel } from '~/contexts/TelegramAuthContext'
import { BulkScoreModal } from '~/components/BulkScoreModal'
import { compareArabicNames } from '~/lib/arabic-sort'
import { dayKey } from '@/lib/absence'

interface ExamRecord {
  entryId: string
  userId: number
  name: string
  completedAt: number
  score: number | null
  postId: number
  sessionNumber: number
  channelId: number | null
}

/** An exam admins marked as held over one or more days. */
interface MarkedExam {
  examId: Id<'exams'>
  name: string
  days: string[]
}

/** One completed اختبار, without the student: enough to list and count exams. */
interface ExamSummary {
  completedAt: number
  scored: boolean
}

/** A calendar day with at least one اختبار. */
interface ExamDay {
  /** "YYYY-MM-DD", local */
  key: string
  timestamp: number
  count: number
  unscored: number
}

/** Exams shown per page of the list */
const PAGE_SIZE = 5

/**
 * One exam as admins score it: a marked exam with all its days, or an exam
 * day nobody marked, which is a one-day exam.
 */
interface ExamGroup {
  key: string
  exam: MarkedExam | null
  /** Its days that have records, oldest first */
  days: ExamDay[]
  /** Every calendar day of the exam, oldest first */
  dayKeys: string[]
  count: number
  unscored: number
}

/** Which days are being grouped into one exam, and under what name. */
interface ExamDraft {
  examId?: Id<'exams'>
  name: string
  days: Set<string>
}

/**
 * Which halaqa a student added through the bulk paste flow is filed against.
 * An exam can span several days and posts, so the busiest session wins — that
 * is the one an unrecorded student most likely sat in.
 */
function bulkTargetFor(records: ExamRecord[], chatId: number) {
  const counts = new Map<string, { record: ExamRecord; count: number }>()
  records.forEach((record) => {
    const key = `${record.postId}:${record.sessionNumber}`
    const seen = counts.get(key)
    if (seen) {
      seen.count++
    } else {
      counts.set(key, { record, count: 1 })
    }
  })

  const busiest = [...counts.values()].sort((a, b) => b.count - a.count)[0].record

  return {
    chatId,
    postId: busiest.postId,
    sessionNumber: busiest.sessionNumber,
    channelId: busiest.channelId,
    completedAt: busiest.completedAt,
  }
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The [from, to) time window of a local calendar day */
function dayRange(key: string) {
  const start = parseDayKey(key)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  return { from: start.getTime(), to: end.getTime() }
}

/** The days of the exam a list key points at: "exam:<id>" or "day:<YYYY-MM-DD>" */
function groupDayKeys(groupKey: string, exams: MarkedExam[] | undefined): string[] | null {
  if (groupKey.startsWith('day:')) return [groupKey.slice(4)]
  const exam = exams?.find((e) => `exam:${e.examId}` === groupKey)
  return exam ? exam.days : null
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDayShort = (key: string) =>
  parseDayKey(key).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })

/** "السبت ٢١ نوفمبر و الأحد ٢٢ نوفمبر ٢٠٢٦" style list of an exam's days */
function formatDays(keys: string[]): string {
  if (keys.length === 1) return formatDate(parseDayKey(keys[0]).getTime())
  return keys.map(formatDayShort).join('، ')
}

// Copy results as tab-separated text: pasting into Google Sheets or Excel
// splits each tab into its own column and each line into its own row.
// (File downloads don't work inside the Telegram Mini App WebView.)
// Students arrive already in alphabetical order for the exam, so «م» numbers
// them from 1 per exam. An exam over several days gets a day column.
async function copyResults(students: ExamRecord[], withDay: boolean) {
  const header = withDay ? ['م', 'الاسم', 'اليوم', 'الدرجة'] : ['م', 'الاسم', 'الدرجة']
  const rows = [
    header,
    ...students.map((s, idx) => [
      (idx + 1).toString(),
      s.name,
      ...(withDay ? [formatDayShort(dayKey(s.completedAt))] : []),
      s.score != null ? s.score.toString() : '',
    ]),
  ]
  const tsv = rows
    .map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n')

  try {
    await navigator.clipboard.writeText(tsv)
    toast.success('تم نسخ النتائج! الصقيها في Google Sheets أو Excel')
  } catch (error) {
    console.error('Copy failed:', error)
    toast.error('فشل النسخ')
  }
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message.replace(/^[\s\S]*ConvexError: /, '').split('\n')[0] : fallback

export default function ExamRecords() {
  const { chatId } = useSelectedChannel()
  // Only times and whether each is scored: names are fetched per opened exam
  const summaries = useQuery(api.queries.getExamSummaries, { chatId })
  const exams = useQuery(api.exams.getExams, { chatId })
  const saveExam = useMutation(api.exams.saveExam)
  const deleteExam = useMutation(api.exams.deleteExam)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
  const [isBulkScoreOpen, setIsBulkScoreOpen] = useState(false)
  const [draft, setDraft] = useState<ExamDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const selectedDayKeys = selectedGroupKey ? groupDayKeys(selectedGroupKey, exams) : null
  const selectedRecords = useQuery(
    api.queries.getExamRecords,
    selectedDayKeys ? { chatId, ranges: selectedDayKeys.map(dayRange) } : 'skip'
  )
  // Only needed once the paste modal is open, and it walks the channel's whole
  // participation history — don't pay for it on the exams list
  const channelStudents = useQuery(
    api.queries.getChannelStudents,
    isBulkScoreOpen ? { chatId } : 'skip'
  )

  if (summaries === undefined || exams === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  // Group exam participations by calendar day
  const days = new Map<string, ExamDay>()
  summaries.forEach((r: ExamSummary) => {
    const key = dayKey(r.completedAt)
    let day = days.get(key)
    if (!day) {
      day = { key, timestamp: parseDayKey(key).getTime(), count: 0, unscored: 0 }
      days.set(key, day)
    }
    day.count++
    if (!r.scored) day.unscored++
  })
  const sortedDays = [...days.values()].sort((a, b) => b.timestamp - a.timestamp)

  // Then days into exams: each marked exam, and each remaining day on its own
  const examByDay = new Map<string, MarkedExam>()
  exams.forEach((e: MarkedExam) => e.days.forEach((d) => examByDay.set(d, e)))
  const groups: ExamGroup[] = exams.map((e: MarkedExam) => {
    const examDays = e.days.map((d) => days.get(d)).filter((d): d is ExamDay => !!d)
    return {
      key: `exam:${e.examId}`,
      exam: e,
      days: examDays,
      dayKeys: e.days,
      count: examDays.reduce((n, d) => n + d.count, 0),
      unscored: examDays.reduce((n, d) => n + d.unscored, 0),
    }
  })
  sortedDays.forEach((day) => {
    if (!examByDay.has(day.key)) {
      groups.push({
        key: `day:${day.key}`,
        exam: null,
        days: [day],
        dayKeys: [day.key],
        count: day.count,
        unscored: day.unscored,
      })
    }
  })
  // Newest exam first, by its last day
  groups.sort((a, b) => (a.dayKeys[a.dayKeys.length - 1] < b.dayKeys[b.dayKeys.length - 1] ? 1 : -1))

  const selectedGroup = selectedGroupKey ? groups.find((g) => g.key === selectedGroupKey) : null

  const startDraft = (exam?: MarkedExam) => {
    setConfirmingDelete(false)
    setDraft(
      exam
        ? { examId: exam.examId, name: exam.name, days: new Set(exam.days) }
        : { name: '', days: new Set() }
    )
  }

  const toggleDraftDay = (key: string) => {
    if (!draft) return
    const next = new Set(draft.days)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setDraft({ ...draft, days: next })
  }

  const submitDraft = async () => {
    if (!draft) return
    if (!draft.name.trim()) {
      toast.error('اكتبي اسم الاختبار')
      return
    }
    if (draft.days.size === 0) {
      toast.error('اختاري يوماً واحداً على الأقل')
      return
    }
    setSaving(true)
    try {
      await saveExam({ chatId, examId: draft.examId, name: draft.name, days: [...draft.days] })
      toast.success('تم حفظ الاختبار')
      setDraft(null)
    } catch (error) {
      console.error('Save exam failed:', error)
      toast.error(errorText(error, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const removeDraftExam = async () => {
    if (!draft?.examId) return
    setSaving(true)
    try {
      await deleteExam({ chatId, examId: draft.examId })
      toast.success('تم حذف الاختبار')
      setDraft(null)
    } catch (error) {
      console.error('Delete exam failed:', error)
      toast.error(errorText(error, 'فشل الحذف'))
    } finally {
      setSaving(false)
      setConfirmingDelete(false)
    }
  }

  // Exam detail view: students and their scores, across all its days
  if (selectedGroup) {
    if (selectedRecords === undefined) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader />
        </div>
      )
    }
    const students = [...(selectedRecords as ExamRecord[])].sort((a, b) => compareArabicNames(a.name, b.name))
    const unscoredCount = students.filter((s) => s.score == null).length
    const multiDay = selectedGroup.dayKeys.length > 1

    return (
      <div className="p-6 md:p-8 h-full flex flex-col">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedGroupKey(null)}
            className="mb-4 gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            <span>رجوع</span>
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground mb-1">
                {selectedGroup.exam?.name ?? 'الاختبارات'}
              </h1>
              <h2 className="text-lg md:text-xl font-bold text-foreground/80">
                {formatDays(selectedGroup.dayKeys)}
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => copyResults(students, multiDay)}
                disabled={students.length === 0}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                نسخ نتائج الاختبار
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsBulkScoreOpen(true)}
                disabled={students.length === 0}
                className="gap-2"
              >
                <ClipboardPaste className="h-4 w-4" />
                إدخال الدرجات دفعة واحدة
              </Button>
            </div>
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
              {students.length === 0 ? (
                <p className="text-muted-foreground">لا توجد طالبات اختبرن في أيام هذا الاختبار</p>
              ) : (
                <ul className="divide-y">
                  {students.map((s, idx) => (
                    <li key={`${s.entryId}-${idx}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <span className="block truncate">{s.name}</span>
                        {multiDay && (
                          <span className="block text-xs text-muted-foreground">
                            {formatDayShort(dayKey(s.completedAt))}
                          </span>
                        )}
                      </div>
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
              )}
            </CardContent>
          </Card>
        </div>

        {students.length > 0 && (
          <BulkScoreModal
            isOpen={isBulkScoreOpen}
            onClose={() => setIsBulkScoreOpen(false)}
            roster={students.map((s) => ({
              entryId: s.entryId,
              userId: s.userId,
              name: s.name,
              score: s.score,
            }))}
            otherStudents={channelStudents ?? []}
            target={bulkTargetFor(students, chatId)}
          />
        )}
      </div>
    )
  }

  // Exams list view; while grouping days into an exam, the days list instead
  return (
    <div className="p-6 md:p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للصفحة الرئيسية</span>
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-foreground mb-1">الاختبارات</h1>
            <p className="text-muted-foreground">الاختبارات ونتائج الطالبات</p>
          </div>
          {!draft && sortedDays.length > 0 && (
            <Button variant="outline" onClick={() => startDraft()} className="gap-2">
              <CalendarRange className="h-4 w-4" />
              تحديد أيام اختبار واحد
            </Button>
          )}
        </div>
      </div>

      {draft && (
        <Card className="mb-4 border-primary">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              اختاري أيام هذا الاختبار من القائمة. تكفي الطالبة أن تختبر في يوم واحد منها، ويُحسب
              الاختبار مرة واحدة في نسبة الغياب، وتُدخل درجاته وتُنسخ نتائجه معاً.
            </p>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="اسم الاختبار، مثلاً: اختبار الجزء الثالث"
              maxLength={100}
            />
            <p className="text-sm">
              {draft.days.size === 0 ? 'لم يتم اختيار أيام بعد' : [...draft.days].sort().map(formatDayShort).join('، ')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={submitDraft} disabled={saving} className="gap-2">
                <Check className="h-4 w-4" />
                حفظ
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                إلغاء
              </Button>
              {draft.examId &&
                (confirmingDelete ? (
                  <Button variant="destructive" onClick={removeDraftExam} disabled={saving}>
                    تأكيد حذف الاختبار
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={saving}
                  >
                    حذف الاختبار
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {sortedDays.length === 0 && groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">لا توجد اختبارات بعد</p>
          </div>
        ) : draft ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDays.slice(0, visibleCount).map((day) => {
              const exam = examByDay.get(day.key)
              // A day already in another exam can't be picked
              const takenElsewhere = !!exam && exam.examId !== draft.examId
              const picked = draft.days.has(day.key)
              return (
                <Card
                  key={day.key}
                  className={`transition-all ${
                    takenElsewhere ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                  } ${picked ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => !takenElsewhere && toggleDraftDay(day.key)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center ${
                        picked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                      }`}
                    >
                      {picked && <Check className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{formatDate(day.timestamp)}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {day.count.toLocaleString('ar-EG')} طالبات اختبرن
                        {takenElsewhere && ` · ضمن «${exam!.name}»`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.slice(0, visibleCount).map((group) => {
              const unscoredCount = group.unscored
              const first = parseDayKey(group.dayKeys[0])
              return (
                <Card
                  key={group.key}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                  onClick={() => setSelectedGroupKey(group.key)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground truncate">
                          {group.exam?.name ?? first.toLocaleDateString('ar-EG', { weekday: 'long' })}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {group.exam
                            ? formatDays(group.dayKeys)
                            : first.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="mr-auto flex items-center gap-1 shrink-0">
                        {unscoredCount > 0 && (
                          <AlertTriangle
                            className="h-5 w-5 text-destructive"
                            aria-label="يوجد طالبات بدون درجة"
                          />
                        )}
                        {group.exam && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            aria-label="تعديل أيام الاختبار"
                            onClick={(e) => {
                              e.stopPropagation()
                              startDraft(group.exam!)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <Users className="h-4 w-4" />
                        {group.count.toLocaleString('ar-EG')} طالبات اختبرن
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
        {(draft ? sortedDays.length : groups.length) > visibleCount && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              عرض المزيد
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
