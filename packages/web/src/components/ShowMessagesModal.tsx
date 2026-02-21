import React, { useState, useEffect, useRef } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
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

const MESSAGES_PASSCODE = 'adminunlock311225'

interface ShowMessagesModalProps {
  isOpen: boolean
  onClose: () => void
  onUnlock: () => void
}

export function ShowMessagesModal({ isOpen, onClose, onUnlock }: ShowMessagesModalProps) {
  const [passcode, setPasscode] = useState('')
  const [isChecking, setIsChecking] = useState(false)
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

    setIsChecking(true)
    setError('')

    // Small delay for UX
    await new Promise((r) => setTimeout(r, 200))

    if (passcode === MESSAGES_PASSCODE) {
      setIsChecking(false)
      onUnlock()
      onClose()
    } else {
      setError('كلمة مرور خاطئة')
      setIsChecking(false)
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
            <MessageSquare className="h-5 w-5" />
            إظهار الرسائل
          </DialogTitle>
          <DialogDescription>
            الرجاء إدخال كلمة المرور لعرض رسائل هذا المنشور.
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
              disabled={isChecking}
              className={error ? 'border-red-500' : ''}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            اضغط Enter للتأكيد
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isChecking}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleUnlock}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التحقق...
              </>
            ) : (
              'إظهار'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
