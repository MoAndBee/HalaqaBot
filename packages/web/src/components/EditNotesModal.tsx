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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface EditNotesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (notes: string) => void
  currentNotes?: string | null
  userName: string
}

export function EditNotesModal({ isOpen, onClose, onSave, currentNotes, userName }: EditNotesModalProps) {
  const [notes, setNotes] = useState(currentNotes || '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setNotes(currentNotes || '')
  }, [currentNotes])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
        const length = textareaRef.current?.value.length || 0
        textareaRef.current?.setSelectionRange(length, length)
      }, 100)
    }
  }, [isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(notes)
      onClose()
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const charCount = notes.length
  const maxChars = 500

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة ملاحظات</DialogTitle>
          <DialogDescription>
            ملاحظات عن: <span className="font-medium text-foreground">{userName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب ملاحظاتك هنا..."
            maxLength={maxChars}
            disabled={isSaving}
            className="resize-none h-40"
          />

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{charCount} / {maxChars}</span>
            <span>Ctrl/Cmd + Enter للحفظ</span>
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
