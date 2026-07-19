import React, { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Normalize Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits to ASCII,
// and the Arabic decimal separator (٫) to a dot, so both numeral systems parse
function normalizeNumerals(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
}

interface EditScoreModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (score: number | null) => void
  currentScore?: number | null
  userName: string
}

export function EditScoreModal({ isOpen, onClose, onSave, currentScore, userName }: EditScoreModalProps) {
  const [score, setScore] = useState(currentScore != null ? currentScore.toString() : '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setScore(currentScore != null ? currentScore.toString() : '')
    setError(null)
  }, [currentScore, isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen])

  const handleSave = async () => {
    const trimmed = normalizeNumerals(score.trim())

    let parsed: number | null = null
    if (trimmed !== '') {
      parsed = Number(trimmed)
      if (isNaN(parsed)) {
        setError('الرجاء إدخال درجة صحيحة')
        return
      }
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSave(parsed)
      onClose()
    } catch (error) {
      console.error('Error saving score:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>درجة الاختبار</DialogTitle>
          <DialogDescription>
            درجة اختبار: <span className="font-medium text-foreground">{userName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            dir="ltr"
            className="text-right"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="أدخل الدرجة"
            disabled={isSaving}
          />
          {error && (
            <div className="text-destructive text-xs">{error}</div>
          )}
          <div className="text-xs text-muted-foreground">
            اترك الحقل فارغاً لحذف الدرجة
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              'حفظ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
