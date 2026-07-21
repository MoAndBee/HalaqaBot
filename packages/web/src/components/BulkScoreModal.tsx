import { useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Normalize Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits to ASCII,
// and the Arabic decimal separator (٫) to a dot, so both numeral systems parse
function normalizeNumerals(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
}

const NO_MATCH = '__none__'

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

export function BulkScoreModal({ isOpen, onClose, roster }: BulkScoreModalProps) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
    onClose()
  }

  const handleAnalyze = async () => {
    if (text.trim() === '') return
    setIsAnalyzing(true)
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
      toast.error('فشل تحليل النص، حاولي مرة أخرى')
    } finally {
      setIsAnalyzing(false)
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدخال الدرجات دفعة واحدة</DialogTitle>
          <DialogDescription>
            الصقي قائمة الأسماء والدرجات كما هي، وسيتم التعرف عليها ومطابقتها مع الطالبات تلقائياً
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
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
                        <Select
                          value={row.entryId ?? NO_MATCH}
                          onValueChange={(value) =>
                            setRows((prev) =>
                              prev!.map((r, i) =>
                                i === idx ? { ...r, entryId: value === NO_MATCH ? null : value } : r
                              )
                            )
                          }
                          disabled={isSaving}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_MATCH}>بدون مطابقة</SelectItem>
                            {roster
                              .filter(
                                (s) => s.entryId === row.entryId || !usedEntryIds.includes(s.entryId)
                              )
                              .map((s) => (
                                <SelectItem key={s.entryId} value={s.entryId}>
                                  {s.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
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
              <Button variant="outline" onClick={() => setRows(null)} disabled={isSaving}>
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
  )
}
