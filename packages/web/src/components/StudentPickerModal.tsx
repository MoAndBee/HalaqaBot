import { useState, useEffect, useRef } from 'react'
import { Search, Check, Ban } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// Fold the Arabic spelling variants that make a literal search miss:
// hamza forms (أإآ → ا), ة → ه, ى → ي, ؤ/ئ, tatweel and tashkeel.
function normalizeArabic(value: string): string {
  return value
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface PickerStudent {
  entryId: string
  name: string
  score?: number | null
  /** Already taken by another row — listed but not selectable */
  disabled?: boolean
}

interface StudentPickerModalProps {
  isOpen: boolean
  onClose: () => void
  students: PickerStudent[]
  selectedEntryId: string | null
  /** The name as written in the pasted text, shown for context */
  extractedName?: string
  onSelect: (entryId: string | null) => void
}

export function StudentPickerModal({
  isOpen,
  onClose,
  students,
  selectedEntryId,
  extractedName,
  onSelect,
}: StudentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  // On touch devices Radix defers its "was this interaction outside?" check
  // from pointerdown to the click event. React's onClick runs first, so closing
  // this dialog straight away unmounts its layer before that check happens —
  // the dialog underneath is then the topmost layer, sees the same tap as an
  // outside interaction, and closes too. Yielding a tick keeps this layer alive
  // until the tap has been resolved against it. Verified in Chromium: without
  // it, picking a student on touch closes the bulk score modal as well.
  const closeAfterTap = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(onClose, 0)
  }

  const query = normalizeArabic(searchQuery)
  const results =
    query === ''
      ? students
      : students.filter((s) => normalizeArabic(s.name).includes(query))

  const choose = (entryId: string | null) => {
    onSelect(entryId)
    closeAfterTap()
  }

  // Covers Escape, the overlay, and the built-in X button — the X is a tap
  // inside the content and hits the same problem as picking a student
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAfterTap()}>
      <DialogContent className="max-w-md h-[60vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>اختيار الطالبة</DialogTitle>
          {extractedName && (
            <DialogDescription>الاسم في النص: {extractedName}</DialogDescription>
          )}
        </DialogHeader>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="ابحث بالاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-between h-auto p-3 text-muted-foreground"
              onClick={() => choose(null)}
            >
              <span className="flex items-center gap-2">
                <Ban className="h-4 w-4" />
                بدون مطابقة
              </span>
              {selectedEntryId === null && <Check className="h-4 w-4 text-primary" />}
            </Button>

            {results.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">لا يوجد نتائج</div>
            ) : (
              results.map((s) => (
                <Button
                  key={s.entryId}
                  variant="ghost"
                  className="w-full justify-between h-auto p-3 disabled:opacity-50"
                  disabled={s.disabled}
                  onClick={() => choose(s.entryId)}
                >
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    {(s.disabled || s.score != null) && (
                      <div className="text-muted-foreground text-sm truncate">
                        {s.disabled
                          ? 'مطابقة مع سطر آخر'
                          : `الدرجة الحالية: ${s.score!.toLocaleString('ar-EG')}`}
                      </div>
                    )}
                  </div>
                  {s.entryId === selectedEntryId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
