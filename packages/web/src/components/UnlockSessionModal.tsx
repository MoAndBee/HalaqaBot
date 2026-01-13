import React, { useState, useEffect, useRef } from 'react'
import { Loader2, Lock } from 'lucide-react'
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

interface UnlockSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: (passcode: string) => Promise<void>
  sessionNumber: number
}

export function UnlockSessionModal({ isOpen, onClose, onUnlock, sessionNumber }: UnlockSessionModalProps) {
  const [passcode, setPasscode] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)
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

  const handleUnlock = async () => {
    if (!passcode.trim()) {
      setError('الرجاء إدخال كلمة المرور')
      return
    }

    setIsUnlocking(true)
    setError('')

    try {
      await onUnlock(passcode)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'كلمة مرور خاطئة')
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleUnlock()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md top-[20%] sm:top-[50%] max-h-[80vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            فتح الحلقة
          </DialogTitle>
          <DialogDescription>
            الحلقة رقم {sessionNumber.toLocaleString('ar-EG')} مغلقة. الرجاء إدخال كلمة المرور لفتح الحلقة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
              placeholder="أدخل كلمة المرور"
              disabled={isUnlocking}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            اضغط Enter لتأكيد فتح الحلقة
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUnlocking}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleUnlock}
            disabled={isUnlocking}
          >
            {isUnlocking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الفتح...
              </>
            ) : (
              'فتح الحلقة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
