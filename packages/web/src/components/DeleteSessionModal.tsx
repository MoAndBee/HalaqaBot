import React, { useState, useEffect, useRef } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
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
import { AdminPasscodeNotice, adminActionErrorMessage } from '~/components/AdminPasscodeNotice'

interface DeleteSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: (passcode: string) => Promise<void>
  sessionNumber: number
  participantCount: number
}

export function DeleteSessionModal({
  isOpen,
  onClose,
  onDelete,
  sessionNumber,
  participantCount,
}: DeleteSessionModalProps) {
  const [passcode, setPasscode] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setPasscode('')
      setError('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleDelete = async () => {
    if (!passcode.trim()) {
      setError('الرجاء إدخال رمز الحماية')
      return
    }

    setIsDeleting(true)
    setError('')

    try {
      await onDelete(passcode)
      onClose()
    } catch (err) {
      setError(adminActionErrorMessage(err, 'تعذر حذف الحلقة'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleDelete()
    }
  }

  const sessionLabel = sessionNumber.toLocaleString('ar-EG')

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent
        className="max-w-md top-[20%] sm:top-[50%] max-h-[80vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <Trash2 className="h-5 w-5" />
            حذف الحلقة
          </DialogTitle>
          <DialogDescription>
            سيتم حذف الحلقة رقم {sessionLabel} نهائياً
            {participantCount > 0 && (
              <> مع جميع أدوارها ({participantCount.toLocaleString('ar-EG')} {participantCount === 1 ? 'مشاركة' : 'مشاركات'})</>
            )}
            . لا يمكن التراجع عن هذا الإجراء.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <AdminPasscodeNotice />

          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                setError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="أدخل رمز الحماية"
              disabled={isDeleting}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الحذف...
              </>
            ) : (
              'حذف الحلقة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
