import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@halakabot/db'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronsUpDown,
  CircleCheck,
  Circle,
  Loader2,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SESSION_TYPES } from '@/lib/session-types'
import {
  defaultSessionTypeFor,
  matchNameLocally,
  parseManualList,
  type CalendarDate,
  type ManualListHeader,
  type ManualListLine,
} from '@/lib/manual-list'
import { StudentPickerModal } from './StudentPickerModal'
import { CompensationModal } from './CompensationModal'
import { RegisterUserModal } from './RegisterUserModal'

export type ManualListMode = 'replace' | 'create'

const PLATFORMS = [
  { value: 'zoom', label: 'زوم' },
  { value: 'telegram', label: 'تيليجرام' },
]

/** How a row's student was found, for the status icon */
type MatchSource = 'local' | 'high' | 'medium' | 'low' | 'manual' | 'none'

interface Row {
  key: string
  line: ManualListLine
  userId: number | null
  match: MatchSource
  sessionType: string | null
  done: boolean
  dates: number[]
  note: string
}

interface ManualListModalProps {
  isOpen: boolean
  onClose: () => void
  mode: ManualListMode
  chatId: number
  postId: number
  channelId: number
  /** "replace": the session whose turns are replaced */
  sessionNumber?: number
  /** Turns the session holds now — all are deleted on "replace" */
  existingCount: number
  /** The post's timestamp; relative make-up days are counted from it */
  halaqaTimestamp: number
  /** Telegram user id of the admin applying the list */
  appliedBy: number
  onApplied: (sessionNumber: number) => void
}

function calendarDateOf(timestamp: number): CalendarDate {
  const date = new Date(timestamp)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

function formatCalendarDate(date: CalendarDate): string {
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function sameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** Compensation dates are UTC midnights; show them as the calendar day they name */
function formatMakeupDate(timestamp: number): string {
  const date = new Date(timestamp)
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).toLocaleDateString(
    'ar-EG',
    { day: 'numeric', month: 'long' }
  )
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as unknown
    if (typeof data === 'string') return data
    if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
      return (data as { message: string }).message
    }
  }
  return fallback
}

export function ManualListModal({
  isOpen,
  onClose,
  mode,
  chatId,
  postId,
  channelId,
  sessionNumber,
  existingCount,
  halaqaTimestamp,
  appliedBy,
  onApplied,
}: ManualListModalProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [header, setHeader] = useState<ManualListHeader | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [platform, setPlatform] = useState('zoom')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pickerRowKey, setPickerRowKey] = useState<string | null>(null)
  const [datesRowKey, setDatesRowKey] = useState<string | null>(null)
  const [registerRowKey, setRegisterRowKey] = useState<string | null>(null)
  // Names of students registered from this screen, until the roster query
  // catches up with them
  const [registeredNames, setRegisteredNames] = useState<Map<number, string>>(new Map())

  const students = useQuery(api.queries.getChannelStudents, isOpen ? { chatId } : 'skip')
  const matchNames = useAction(api.actions.matchManualListNames)
  const applyManualList = useMutation(api.mutations.applyManualList)
  const registerUser = useMutation(api.mutations.registerUser)

  const halaqaDate = calendarDateOf(halaqaTimestamp)

  const studentOptions = (students ?? []).map((s: { userId: number; name: string }) => ({
    id: String(s.userId),
    name: s.name,
  }))
  const nameById = new Map<number, string>(registeredNames)
  for (const s of students ?? []) nameById.set(s.userId, s.name)

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev!.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const reset = () => {
    setText('')
    setRows(null)
    setHeader(null)
    setTeacherName('')
    setPlatform('zoom')
    setAnalyzeError(null)
    setAiError(null)
    setPickerRowKey(null)
    setDatesRowKey(null)
    setRegisterRowKey(null)
  }

  const handleClose = () => {
    if (isAnalyzing || isSaving) return
    reset()
    onClose()
  }

  const handleAnalyze = async () => {
    if (text.trim() === '' || students === undefined) return
    setAnalyzeError(null)
    setAiError(null)

    const parsed = parseManualList(text, halaqaDate)
    if (parsed.multipleLists) {
      setAnalyzeError('يبدو أن النص يحتوي على أكثر من قائمة. الرجاء لصق قائمة واحدة فقط في كل مرة.')
      return
    }
    if (parsed.lines.length === 0) {
      setAnalyzeError('لم يتم العثور على أسماء في القائمة. تأكدي أن كل اسم في سطر يبدأ برقم.')
      return
    }

    const listType = defaultSessionTypeFor(parsed.header.kind)
    const initial: Row[] = parsed.lines.map((line) => {
      const localId = line.name ? matchNameLocally(line.name, studentOptions) : null
      return {
        key: `l${line.index}`,
        line,
        userId: localId === null ? null : Number(localId),
        match: localId === null ? 'none' : 'local',
        sessionType: line.sessionType ?? listType,
        done: line.done,
        dates: line.makeupDates,
        note: line.note ?? '',
      }
    })

    setHeader(parsed.header)
    if (mode === 'create' && teacherName.trim() === '' && parsed.header.teacherName) {
      setTeacherName(parsed.header.teacherName)
    }

    // Only the names the list couldn't be matched on locally go to the AI
    const unmatched = initial.filter((r) => r.userId === null && r.line.name !== '')
    if (unmatched.length === 0) {
      setRows(initial)
      return
    }

    setIsAnalyzing(true)
    try {
      const result = await matchNames({
        names: unmatched.map((r) => ({ key: r.key, name: r.line.name })),
        students: studentOptions,
      })
      type NameMatch = { key: string; id: string | null; confidence: 'high' | 'medium' | 'low' }
      const byKey = new Map<string, NameMatch>(
        result.matches.map((m: NameMatch) => [m.key, m])
      )
      setRows(
        initial.map((r) => {
          const m = byKey.get(r.key)
          if (!m || m.id === null) return r
          return { ...r, userId: Number(m.id), match: m.confidence }
        })
      )
    } catch (error) {
      console.error('Manual list name matching failed:', error)
      // The list is still usable — the supervisor picks the rest by hand
      setAiError(errorMessage(error, 'تعذّرت المطابقة التلقائية لبعض الأسماء'))
      setRows(initial)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const unmatchedCount = (rows ?? []).filter((r) => r.userId === null).length
  const missingTypeCount = (rows ?? []).filter((r) => r.done && !r.sessionType).length
  const missingDatesCount = (rows ?? []).filter(
    (r) => r.sessionType === 'تعويض' && r.dates.length === 0
  ).length
  const teacherMissing = mode === 'create' && teacherName.trim() === ''

  const userIdCounts = new Map<number, number>()
  for (const r of rows ?? []) {
    if (r.userId !== null) userIdCounts.set(r.userId, (userIdCounts.get(r.userId) ?? 0) + 1)
  }

  const blockers = [
    unmatchedCount > 0 && `${unmatchedCount.toLocaleString('ar-EG')} اسم بدون مطابقة`,
    missingTypeCount > 0 && `${missingTypeCount.toLocaleString('ar-EG')} دور مكتمل بدون نوع مشاركة`,
    missingDatesCount > 0 && `${missingDatesCount.toLocaleString('ar-EG')} تعويض بدون أيام`,
    teacherMissing && 'اسم المعلمة',
  ].filter((b): b is string => typeof b === 'string')

  const canSave = rows !== null && rows.length > 0 && blockers.length === 0 && !isSaving

  const handleSave = async () => {
    if (!canSave || rows === null) return
    setIsSaving(true)
    try {
      const result = await applyManualList({
        chatId,
        postId,
        channelId,
        mode,
        sessionNumber: mode === 'replace' ? sessionNumber : undefined,
        newSession: mode === 'create' ? { teacherName: teacherName.trim(), platform } : undefined,
        appliedBy,
        rawText: text,
        entries: rows.map((r) => ({
          userId: r.userId!,
          sessionType: r.sessionType ?? undefined,
          done: r.done,
          skipped: r.line.skipped && !r.done,
          notes: r.note.trim() || undefined,
          compensatingForDates: r.sessionType === 'تعويض' ? r.dates : undefined,
        })),
      })
      toast.success(
        mode === 'create'
          ? `تمت إضافة الحلقة: ${result.completed.toLocaleString('ar-EG')} دور مكتمل`
          : `تم تحديث الحلقة: ${result.completed.toLocaleString('ar-EG')} دور مكتمل`
      )
      reset()
      onApplied(result.sessionNumber)
      onClose()
    } catch (error) {
      console.error('Applying manual list failed:', error)
      toast.error(errorMessage(error, 'فشل حفظ القائمة'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleRegister = async (name: string, passcode: string) => {
    const result = await registerUser({ name, passcode, chatId })
    setRegisteredNames((prev) => new Map(prev).set(result.userId, result.name))
    if (registerRowKey) updateRow(registerRowKey, { userId: result.userId, match: 'manual' })
    toast.success('تم تسجيل الطالبة')
    setRegisterRowKey(null)
  }

  const pickerRow = rows?.find((r) => r.key === pickerRowKey)
  const datesRow = rows?.find((r) => r.key === datesRowKey)
  const listDateDiffers = header?.date != null && !sameDay(header.date, halaqaDate)

  const statusIcon = (row: Row) => {
    if (row.userId === null) return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
    if (row.match === 'local' || row.match === 'high' || row.match === 'manual') {
      return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
    }
    return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'إضافة حلقة بقائمة يدوية' : 'تعديل الحلقة بقائمة يدوية'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'لحلقة أُديرت بقائمة يدوية (على زوم أو تيليجرام) وليس عن طريق البوت. الصقي القائمة كما كُتبت في جروب القوائم.'
                : 'الصقي القائمة اليدوية الأخيرة التي وصلت إليها الحلقة. ستحل محل قائمة الحلقة الحالية.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {analyzeError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{analyzeError}</p>
              </div>
            )}

            {rows === null ? (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'📍المُعلمة/ ...\n📍المشرفة/ ...\n١- فاطمة علي محمد ✅\n٢- هبة فؤاد أحمد 🗣'}
                className="min-h-[260px]"
                disabled={isAnalyzing}
              />
            ) : (
              <>
                {mode === 'create' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-sm font-medium">اسم المعلمة</span>
                      <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-medium">مكان الحلقة</span>
                      <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                )}

                {listDateDiffers && header?.date && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      تاريخ القائمة ({formatCalendarDate(header.date)}) يختلف عن تاريخ هذا المنشور (
                      {formatCalendarDate(halaqaDate)}). تأكدي أنك تضيفين القائمة إلى اليوم الصحيح.
                    </p>
                  </div>
                )}

                {mode === 'replace' && existingCount > 0 && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      سيتم حذف كل أدوار الحلقة الحالية ({existingCount.toLocaleString('ar-EG')} دور)، بما فيها
                      الدرجات والملاحظات، واستبدالها بهذه القائمة.
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {aiError} — اختاري الطالبات غير المطابقة يدوياً.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium shrink-0">نوع المشاركة للكل:</span>
                  <Select
                    value=""
                    onValueChange={(type) =>
                      setRows((prev) => prev!.map((r) => ({ ...r, sessionType: type })))
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="اختيار..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  {rows.map((row, idx) => {
                    const name = row.userId !== null ? nameById.get(row.userId) : undefined
                    const duplicate = row.userId !== null && (userIdCounts.get(row.userId) ?? 0) > 1
                    return (
                      <div key={row.key} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">
                            {(idx + 1).toLocaleString('ar-EG')}
                          </span>
                          {statusIcon(row)}
                          <span className="truncate text-sm flex-1" title={row.line.raw}>
                            {row.line.raw}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="حذف السطر"
                            onClick={() => setRows((prev) => prev!.filter((r) => r.key !== row.key))}
                            disabled={isSaving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className="w-48 justify-between font-normal"
                            onClick={() => setPickerRowKey(row.key)}
                            disabled={isSaving}
                          >
                            <span className={`truncate ${name ? '' : 'text-muted-foreground'}`} title={name}>
                              {name ?? 'بدون مطابقة'}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                          </Button>

                          {row.userId === null && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setRegisterRowKey(row.key)}
                              disabled={isSaving}
                            >
                              <UserPlus className="h-4 w-4" />
                              تسجيل طالبة جديدة
                            </Button>
                          )}

                          <Select
                            value={row.sessionType ?? ''}
                            onValueChange={(type) => updateRow(row.key, { sessionType: type })}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue placeholder="النوع" />
                            </SelectTrigger>
                            <SelectContent>
                              {SESSION_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant={row.done ? 'default' : 'outline'}
                            size="sm"
                            className="gap-1"
                            onClick={() => updateRow(row.key, { done: !row.done })}
                            disabled={isSaving}
                          >
                            {row.done ? <CircleCheck className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            {row.done ? 'مكتمل' : row.line.skipped ? 'لم تُجب 🗣' : 'لم يكتمل'}
                          </Button>

                          {row.sessionType === 'تعويض' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`gap-1 ${row.dates.length === 0 ? 'border-destructive text-destructive' : ''}`}
                              onClick={() => setDatesRowKey(row.key)}
                              disabled={isSaving}
                            >
                              <CalendarDays className="h-4 w-4" />
                              {row.dates.length > 0
                                ? row.dates.map(formatMakeupDate).join('، ')
                                : 'اختيار أيام التعويض'}
                            </Button>
                          )}
                        </div>

                        <Input
                          value={row.note}
                          onChange={(e) => updateRow(row.key, { note: e.target.value })}
                          placeholder="ملاحظات"
                          className="h-8 text-sm"
                          disabled={isSaving}
                        />

                        {duplicate && (
                          <p className="text-xs text-amber-600">
                            هذه الطالبة مطابقة لأكثر من سطر — تأكدي أن لها أكثر من دور فعلاً
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {blockers.length > 0 && (
                  <p className="text-sm text-destructive">
                    قبل الحفظ يجب إكمال: {blockers.join('، ')}
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {rows === null ? (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isAnalyzing}>
                  إلغاء
                </Button>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || text.trim() === '' || students === undefined}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري التحليل...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      تحليل
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRows(null)
                    setPickerRowKey(null)
                  }}
                  disabled={isSaving}
                >
                  رجوع للنص
                </Button>
                <Button onClick={handleSave} disabled={!canSave}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : mode === 'create' ? (
                    `إضافة الحلقة (${rows.length.toLocaleString('ar-EG')})`
                  ) : (
                    `حفظ القائمة (${rows.length.toLocaleString('ar-EG')})`
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pickerRow && (
        <StudentPickerModal
          isOpen
          onClose={() => setPickerRowKey(null)}
          extractedName={pickerRow.line.name}
          selectedId={pickerRow.userId === null ? null : String(pickerRow.userId)}
          students={studentOptions}
          onSelect={(id) =>
            updateRow(pickerRow.key, {
              userId: id === null ? null : Number(id),
              match: id === null ? 'none' : 'manual',
            })
          }
        />
      )}

      {datesRow && (
        <CompensationModal
          isOpen
          onClose={() => setDatesRowKey(null)}
          userName={
            (datesRow.userId !== null ? nameById.get(datesRow.userId) : undefined) ?? datesRow.line.name
          }
          currentDates={datesRow.dates}
          onSave={(dates) => updateRow(datesRow.key, { dates })}
        />
      )}

      <RegisterUserModal
        isOpen={registerRowKey !== null}
        onClose={() => setRegisterRowKey(null)}
        onRegister={handleRegister}
      />
    </>
  )
}
