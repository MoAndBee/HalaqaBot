import React, { useState, useEffect, useRef } from 'react'
import { Loader2, UserPlus, Lock } from 'lucide-react'
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

interface RegisterUserModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: (name: string, passcode: string) => Promise<void>
}

export function RegisterUserModal({ isOpen, onClose, onRegister }: RegisterUserModalProps) {
  const [step, setStep] = useState<'password' | 'name'>('password')
  const [passcode, setPasscode] = useState('')
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const passcodeInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setStep('password')
      setPasscode('')
      setName('')
      setError('')
      setTimeout(() => {
        passcodeInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [step])

  const handlePasswordSubmit = () => {
    if (!passcode.trim()) {
      setError('الرجاء إدخال كلمة المرور')
      return
    }
    setError('')
    setStep('name')
  }

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('الرجاء إدخال الاسم')
      return
    }

    setIsRegistering(true)
    setError('')

    try {
      await onRegister(name.trim(), passcode)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء التسجيل')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step === 'password') {
        handlePasswordSubmit()
      } else {
        handleRegister()
      }
    }
  }

  const handleBack = () => {
    setStep('password')
    setName('')
    setError('')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md top-[20%] sm:top-[50%] max-h-[80vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'password' ? (
              <>
                <Lock className="h-5 w-5" />
                كلمة المرور
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                تسجيل مستخدم جديد
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'password'
              ? 'الرجاء إدخال كلمة المرور للمتابعة'
              : 'أدخل اسم المستخدم الجديد'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {step === 'password' ? (
            <div className="space-y-2">
              <Input
                ref={passcodeInputRef}
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKeyDown}
                placeholder="أدخل كلمة المرور"
                disabled={isRegistering}
                className={error ? 'border-red-500' : ''}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKeyDown}
                placeholder="اسم المستخدم"
                disabled={isRegistering}
                className={error ? 'border-red-500' : ''}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            اضغط Enter للمتابعة
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'name' && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isRegistering}
            >
              رجوع
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRegistering}
          >
            إلغاء
          </Button>
          <Button
            onClick={step === 'password' ? handlePasswordSubmit : handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التسجيل...
              </>
            ) : step === 'password' ? (
              'التالي'
            ) : (
              'تسجيل'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
