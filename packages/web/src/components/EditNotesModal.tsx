import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'

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

  // Update notes when currentNotes changes
  useEffect(() => {
    setNotes(currentNotes || '')
  }, [currentNotes])

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
        // Move cursor to end
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
    // Save on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const charCount = notes.length
  const maxChars = 500

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة ملاحظات</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            ملاحظات عن: <span className="font-medium text-foreground">{userName}</span>
          </div>

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
            <span className="opacity-70">Ctrl/Cmd + Enter للحفظ</span>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            onClick={onClose}
            disabled={isSaving}
            variant="outline"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
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
