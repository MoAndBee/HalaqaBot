import { useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader2, UserMinus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AdminPasscodeNotice, adminActionErrorMessage } from '~/components/AdminPasscodeNotice'

interface RemoveStudentModalProps {
  student: { userId: number; name: string } | null
  chatId: number
  onClose: () => void
}

/** Take a student off this course's roster; her halaqa records stay. */
export function RemoveStudentModal({ student, chatId, onClose }: RemoveStudentModalProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const removeStudent = useMutation(api.students.removeStudentFromCourse)

  useEffect(() => {
    if (!student) return
    setPasscode('')
    setError('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [student])

  const confirm = async () => {
    if (!student) return
    if (!passcode.trim()) {
      setError('الرجاء إدخال رمز الحماية')
      return
    }
    setBusy(true)
    setError('')
    try {
      await removeStudent({ chatId, userId: student.userId, passcode })
      onClose()
    } catch (err) {
      setError(adminActionErrorMessage(err, 'حدث خطأ أثناء الإزالة'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md top-[20%] sm:top-[50%]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            إزالة من الدورة
          </DialogTitle>
          <DialogDescription>
            إزالة <span className="font-semibold text-foreground">{student?.name}</span> من قائمة طالبات
            الدورة. سجلها في الحلقات يبقى كما هو، ولن يمكن إضافتها لحلقة إلا بعد إعادتها للدورة أو تسجيلها
            بنفسها من البوت.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <AdminPasscodeNotice />
          <Input
            ref={inputRef}
            type="password"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
            placeholder="أدخل رمز الحماية"
            disabled={busy}
            className={error ? 'border-red-500' : ''}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إزالة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
