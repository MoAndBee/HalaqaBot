import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Check, Loader2, Lock, RotateCcw, Search, UserPlus } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { AdminPasscodeNotice, adminActionErrorMessage } from '~/components/AdminPasscodeNotice'

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
  chatId: number
}

type Status = 'enrolled' | 'removed' | 'none'

/**
 * Add a student to this course: find her among all students (she may already
 * study in another course, and stays one person), or register a new one by
 * name when she isn't found.
 */
export function AddStudentModal({ isOpen, onClose, chatId }: AddStudentModalProps) {
  const [step, setStep] = useState<'password' | 'search'>('password')
  const [passcode, setPasscode] = useState('')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [busyId, setBusyId] = useState<number | 'new' | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const passcodeRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const addStudent = useMutation(api.students.addStudentToCourse)
  const registerUser = useMutation(api.mutations.registerUser)
  const results = useQuery(
    api.students.searchAllStudents,
    step === 'search' && debounced.trim() ? { chatId, query: debounced } : 'skip'
  )

  useEffect(() => {
    if (!isOpen) return
    setStep('password')
    setPasscode('')
    setQuery('')
    setDebounced('')
    setAdded(null)
    setError('')
    setTimeout(() => passcodeRef.current?.focus(), 100)
  }, [isOpen])

  useEffect(() => {
    if (step === 'search') setTimeout(() => searchRef.current?.focus(), 100)
  }, [step])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const submitPasscode = () => {
    if (!passcode.trim()) {
      setError('الرجاء إدخال رمز الحماية')
      return
    }
    setError('')
    setStep('search')
  }

  const run = async (id: number | 'new', name: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    setError('')
    setAdded(null)
    try {
      await action()
      setAdded(name)
    } catch (err) {
      setError(adminActionErrorMessage(err, 'حدث خطأ أثناء الإضافة'))
      // A wrong passcode only shows up here: let it be re-entered
      if (err && String((err as { data?: unknown }).data ?? '').includes('رمز الحماية')) setStep('password')
    } finally {
      setBusyId(null)
    }
  }

  const trimmed = query.trim()
  const exactMatch = results?.some((r) => r.name.trim() === trimmed)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Anchored to the top on phones: the results list grows downwards */}
      <DialogContent
        className="max-w-md top-4 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[85vh] overflow-y-auto"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'password' ? <Lock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {step === 'password' ? 'رمز الحماية' : 'إضافة طالبة للدورة'}
          </DialogTitle>
          <DialogDescription>
            {step === 'password'
              ? 'الرجاء إدخال رمز الحماية للمتابعة'
              : 'ابحثي عن الطالبة في جميع الدورات، أو سجّلي طالبة جديدة'}
          </DialogDescription>
        </DialogHeader>

        {step === 'password' ? (
          <div className="space-y-3">
            <AdminPasscodeNotice />
            <Input
              ref={passcodeRef}
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitPasscode()}
              placeholder="أدخل رمز الحماية"
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setError('')
                  setAdded(null)
                }}
                placeholder="اسم الطالبة أو معرفها"
                className="pr-9"
              />
            </div>

            {added && (
              <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                تمت إضافة {added} للدورة
              </p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}

            {trimmed && results === undefined && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {results && results.length > 0 && (
              <ul className="divide-y rounded-md border">
                {results.map((student) => (
                  <li key={student.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.isManual ? 'مسجلة يدوياً' : student.telegramName}
                        {student.username && ` · @${student.username}`}
                      </p>
                    </div>
                    <StatusAction
                      status={student.status}
                      busy={busyId === student.userId}
                      disabled={busyId !== null}
                      onAdd={() =>
                        run(student.userId, student.name, () =>
                          addStudent({ chatId, userId: student.userId, passcode })
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            {trimmed && results !== undefined && !exactMatch && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={busyId !== null}
                onClick={() => run('new', trimmed, () => registerUser({ name: trimmed, passcode, chatId }))}
              >
                {busyId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                <span className="truncate">تسجيل طالبة جديدة باسم «{trimmed}»</span>
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={busyId !== null}>
            {step === 'search' ? 'إغلاق' : 'إلغاء'}
          </Button>
          {step === 'password' && <Button onClick={submitPasscode}>التالي</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusAction({
  status,
  busy,
  disabled,
  onAdd,
}: {
  status: Status
  busy: boolean
  disabled: boolean
  onAdd: () => void
}) {
  if (status === 'enrolled') {
    return <Badge variant="secondary" className="shrink-0">في الدورة</Badge>
  }
  return (
    <Button size="sm" variant={status === 'removed' ? 'outline' : 'default'} className="shrink-0 gap-1" disabled={disabled} onClick={onAdd}>
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === 'removed' ? (
        <RotateCcw className="h-3 w-3" />
      ) : (
        <UserPlus className="h-3 w-3" />
      )}
      {status === 'removed' ? 'إعادة إضافة' : 'إضافة'}
    </Button>
  )
}
