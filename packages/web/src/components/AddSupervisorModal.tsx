import React, { useState, useEffect, useRef } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
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

export interface SupervisorCandidate {
  userId: number
  name: string
}

interface AddSupervisorModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (userId: number, passcode: string) => Promise<void>
  sessionNumber: number
  /** Undefined while the list is loading */
  candidates: SupervisorCandidate[] | undefined
}

export function AddSupervisorModal({
  isOpen,
  onClose,
  onAdd,
  sessionNumber,
  candidates,
}: AddSupervisorModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [passcode, setPasscode] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null)
      setPasscode('')
      setError('')
    }
  }, [isOpen])

  const handleAdd = async () => {
    if (selectedId === null) {
      setError('الرجاء اختيار المشرفة')
      return
    }
    if (!passcode.trim()) {
      setError('الرجاء إدخال رمز الحماية')
      return
    }

    setIsAdding(true)
    setError('')

    try {
      await onAdd(selectedId, passcode)
      onClose()
    } catch (err: any) {
      setError(adminActionErrorMessage(err, 'فشلت إضافة المشرفة'))
    } finally {
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const loading = candidates === undefined
  const empty = !loading && candidates.length === 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md top-[20%] sm:top-[50%] max-h-[80vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            إضافة مشرفة
          </DialogTitle>
          <DialogDescription>
            اختاري مشرفة من إداريات القناة لإضافتها إلى الحلقة رقم {sessionNumber.toLocaleString('ar-EG')}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <AdminPasscodeNotice />

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {empty && (
            <p className="text-sm text-muted-foreground">
              لا توجد إداريات أخرى في القناة يمكن إضافتها.
            </p>
          )}

          {!loading && !empty && (
            <div className="flex flex-col gap-1" role="listbox" aria-label="المشرفات">
              {candidates.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  role="option"
                  aria-selected={selectedId === c.userId}
                  disabled={isAdding}
                  onClick={() => {
                    setSelectedId(c.userId)
                    setError('')
                  }}
                  className={`text-right rounded-md border px-3 py-2 text-sm transition-colors ${
                    selectedId === c.userId
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {!loading && !empty && (
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
                disabled={isAdding}
                className={error ? 'border-red-500' : ''}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isAdding}>
            إلغاء
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isAdding || loading || empty || selectedId === null || !passcode.trim()}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الإضافة...
              </>
            ) : (
              'إضافة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
