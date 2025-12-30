import React, { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface StartNewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onStart: (teacherName: string, supervisorName: string) => void
}

export function StartNewSessionModal({ isOpen, onClose, onStart }: StartNewSessionModalProps) {
  const [teacherName, setTeacherName] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const teacherInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTeacherName('')
      setSupervisorName('')
      setIsStarting(false)
      setTimeout(() => teacherInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleStart = async () => {
    const trimmedTeacher = teacherName.trim()
    const trimmedSupervisor = supervisorName.trim()

    if (!trimmedTeacher || !trimmedSupervisor) {
      return
    }

    setIsStarting(true)
    try {
      await onStart(trimmedTeacher, trimmedSupervisor)
      // Modal will be closed by parent after confirmation
    } catch (error) {
      console.error('Error starting session:', error)
      setIsStarting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmedTeacher = teacherName.trim()
      const trimmedSupervisor = supervisorName.trim()
      if (trimmedTeacher && trimmedSupervisor) {
        handleStart()
      }
    }
  }

  const isValid = teacherName.trim() !== '' && supervisorName.trim() !== ''

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md top-4 left-[50%] translate-x-[-50%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[80vh] overflow-y-auto p-4 sm:p-6" dir="rtl">
        <DialogHeader>
          <DialogTitle>بدء حلقة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <label htmlFor="teacherName" className="text-sm font-medium">اسم المعلمة</label>
            <Input
              id="teacherName"
              ref={teacherInputRef}
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="أدخل اسم المعلمة"
              disabled={isStarting}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="supervisorName" className="text-sm font-medium">اسم المشرفة</label>
            <Input
              id="supervisorName"
              type="text"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="أدخل اسم المشرفة"
              disabled={isStarting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isStarting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleStart}
            disabled={!isValid || isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري بدء الحلقة...
              </>
            ) : (
              'بدء الحلقة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
