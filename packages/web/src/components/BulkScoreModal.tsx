import { useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import { api } from '@halakabot/db'
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, ChevronsUpDown, Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StudentPickerModal } from './StudentPickerModal'

// Normalize Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits to ASCII,
// and the Arabic decimal separator (٫) to a dot, so both numeral systems parse
function normalizeNumerals(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
}

interface RosterStudent {
  entryId: string
  name: string
  score: number | null
}

interface ReviewRow {
  extractedName: string
  entryId: string | null
  scoreText: string
  confidence: 'high' | 'medium' | 'low'
}

interface BulkScoreModalProps {
  isOpen: boolean
  onClose: () => void
  roster: RosterStudent[]
}

interface AnalyzeError {
  /** Arabic, shown directly to the admin */
  message: string
  /** Technical detail, hidden behind "التفاصيل التقنية" */
  detail: string
}

/**
 * The action reports failures as ConvexError data — a plain Error would reach
 * the browser as "Server Error", which is what made every failure here look
 * identical. Anything else (network drop, unexpected throw) still gets a
 * readable fallback rather than being swallowed.
 */
function describeAnalyzeError(error: unknown): AnalyzeError {
  if (error instanceof ConvexError) {
    const data = error.data as
      | { kind?: string; message?: string; detail?: string; stage?: string }
      | undefined
    if (data?.kind === 'bulk_score_failure' && typeof data.message === 'string') {
      return {
        message: data.message,
        detail: `[${data.stage ?? 'unknown'}] ${data.detail ?? 'no detail provided'}`,
      }
    }
    return {
      message: 'فشل تحليل النص، حاولي مرة أخرى',
      detail: typeof error.data === 'string' ? error.data : JSON.stringify(error.data),
    }
  }

  return {
    message: 'تعذّر الوصول إلى الخادم. تحقّقي من الاتصال بالإنترنت وحاولي مرة أخرى.',
    detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  }
}

export function BulkScoreModal({ isOpen, onClose, roster }: BulkScoreModalProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<AnalyzeError | null>(null)
  const [showErrorDetail, setShowErrorDetail] = useState(false)
  // Index of the row whose student picker is open
  const [pickerRowIdx, setPickerRowIdx] = useState<number | null>(null)

  const matchBulkScores = useAction(api.actions.matchBulkScores)
  const bulkUpdateScores = useMutation(api.mutations.bulkUpdateParticipationScores)

  const rosterById = new Map(roster.map((s) => [s.entryId, s]))

  const handleClose = () => {
    if (isAnalyzing || isSaving) return
    onClose()
  }

  const resetAndClose = () => {
    setText('')
    setRows(null)
    setOverwrite(false)
    setPickerRowIdx(null)
    setAnalyzeError(null)
    setShowErrorDetail(false)
    onClose()
  }

  const handleAnalyze = async () => {
    if (text.trim() === '') return
    setIsAnalyzing(true)
    setAnalyzeError(null)
    setShowErrorDetail(false)
    try {
      const result = await matchBulkScores({
        text,
        roster: roster.map((s) => ({ entryId: s.entryId, name: s.name })),
      })
      setRows(
        result.matches.map((m: { entryId: string | null; extractedName: string; score: number | null; confidence: 'high' | 'medium' | 'low' }) => ({
          extractedName: m.extractedName,
          entryId: m.entryId,
          scoreText: m.score != null ? m.score.toString() : '',
          confidence: m.confidence,
        }))
      )
      if (result.matches.length === 0) {
        toast.error('لم يتم العثور على أسماء أو درجات في النص')
      }
    } catch (error) {
      console.error('Bulk score analysis failed:', error)
      const described = describeAnalyzeError(error)
      setAnalyzeError(described)
      toast.error(described.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyErrorDetail = async () => {
    if (analyzeError === null) return
    const report = `${analyzeError.message}\n${analyzeError.detail}`
    try {
      await navigator.clipboard.writeText(report)
      toast.success('تم نسخ التفاصيل')
    } catch {
      toast.error('تعذّر النسخ')
    }
  }

  // Entry IDs already chosen by other rows — each student can be matched once
  const usedEntryIds = (rows ?? []).map((r) => r.entryId).filter((id): id is string => id !== null)

  const parseScore = (scoreText: string): number | null => {
    const trimmed = normalizeNumerals(scoreText.trim())
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return isNaN(parsed) ? null : parsed
  }

  const updates = (rows ?? []).flatMap((r) => {
    if (r.entryId === null) return []
    const score = parseScore(r.scoreText)
    if (score === null) return []
    const student = rosterById.get(r.entryId)
    if (!student) return []
    if (student.score != null && !overwrite) return []
    return [{ entryId: r.entryId, score }]
  })

  const skippedExisting = (rows ?? []).filter((r) => {
    if (r.entryId === null || parseScore(r.scoreText) === null) return false
    const student = rosterById.get(r.entryId)
    return student != null && student.score != null && !overwrite
  }).length

  const matchedEntryIds = new Set(usedEntryIds)
  const missingStudents = rows === null ? [] : roster.filter((s) => !matchedEntryIds.has(s.entryId))

  const handleSave = async () => {
    if (updates.length === 0) return
    setIsSaving(true)
    try {
      await bulkUpdateScores({ updates: updates as { entryId: any; score: number }[] })
      toast.success(`تم حفظ ${updates.length.toLocaleString('ar-EG')} درجة`)
      resetAndClose()
    } catch (error) {
      console.error('Bulk score save failed:', error)
      toast.error('فشل حفظ الدرجات')
    } finally {
      setIsSaving(false)
    }
  }

  const pickerRow = pickerRowIdx !== null ? (rows ?? [])[pickerRowIdx] : undefined

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدخال الدرجات دفعة واحدة</DialogTitle>
          <DialogDescription>
            الصقي قائمة الأسماء والدرجات كما هي، وسيتم التعرف عليها ومطابقتها مع الطالبات تلقائياً
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {analyzeError !== null && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-destructive">{analyzeError.message}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowErrorDetail((shown) => !shown)}
                  className="text-xs underline text-muted-foreground"
                >
                  {showErrorDetail ? 'إخفاء التفاصيل التقنية' : 'عرض التفاصيل التقنية'}
                </button>
                <button
                  type="button"
                  onClick={copyErrorDetail}
                  className="text-xs underline text-muted-foreground flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  نسخ التفاصيل
                </button>
              </div>
              {showErrorDetail && (
                <pre
                  dir="ltr"
                  className="text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground bg-background/60 rounded p-2 max-h-40 overflow-y-auto"
                >
                  {analyzeError.detail}
                </pre>
              )}
            </div>
          )}
          {rows === null ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'مثال:\nفاطمة أحمد ٩\nعائشة ٨٫٥\nأم أحمد غائبة'}
              className="min-h-[220px]"
              disabled={isAnalyzing}
            />
          ) : (
            <>
              <div className="space-y-2">
                {rows.map((row, idx) => {
                  const student = row.entryId !== null ? rosterById.get(row.entryId) : undefined
                  const hasExistingScore = student?.score != null
                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-3"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {row.entryId === null ? (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        ) : row.confidence === 'high' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="truncate text-sm" title={row.extractedName}>
                          {row.extractedName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="w-44 justify-between font-normal"
                          onClick={() => setPickerRowIdx(idx)}
                          disabled={isSaving}
                        >
                          <span
                            className={`truncate ${student ? '' : 'text-muted-foreground'}`}
                            title={student?.name}
                          >
                            {student ? student.name : 'بدون مطابقة'}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                        <Input
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          className="w-20 text-right"
                          value={row.scoreText}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev!.map((r, i) => (i === idx ? { ...r, scoreText: e.target.value } : r))
                            )
                          }
                          placeholder="—"
                          disabled={isSaving}
                        />
                      </div>
                      {hasExistingScore && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          الدرجة الحالية: {student!.score!.toLocaleString('ar-EG')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {missingStudents.length > 0 && (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    طالبات لم يُعثر لهن على درجة في النص:
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {missingStudents.map((s) => s.name).join('، ')}
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  disabled={isSaving}
                  className="h-4 w-4 accent-orange-500"
                />
                <span>استبدال الدرجات الموجودة مسبقاً</span>
              </label>
              {skippedExisting > 0 && !overwrite && (
                <p className="text-xs text-muted-foreground">
                  سيتم تخطي {skippedExisting.toLocaleString('ar-EG')} طالبة لديها درجة مسبقاً
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
              <Button onClick={handleAnalyze} disabled={isAnalyzing || text.trim() === ''}>
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
                  setPickerRowIdx(null)
                }}
                disabled={isSaving}
              >
                رجوع للنص
              </Button>
              <Button onClick={handleSave} disabled={isSaving || updates.length === 0}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  `حفظ ${updates.length.toLocaleString('ar-EG')} درجة`
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
        onClose={() => setPickerRowIdx(null)}
        extractedName={pickerRow.extractedName}
        selectedEntryId={pickerRow.entryId}
        students={roster.map((s) => ({
          entryId: s.entryId,
          name: s.name,
          score: s.score,
          // Taken by another row — each student can be matched once
          disabled: s.entryId !== pickerRow.entryId && usedEntryIds.includes(s.entryId),
        }))}
        onSelect={(entryId) =>
          setRows((prev) =>
            prev!.map((r, i) => (i === pickerRowIdx ? { ...r, entryId } : r))
          )
        }
      />
    )}
    </>
  )
}
