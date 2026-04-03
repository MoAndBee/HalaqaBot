import { useState } from 'react'
import type { User } from '@halakabot/db'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SESSION_TYPES, type SessionType } from '@/lib/session-types'

interface BulkSessionTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (entryIds: string[], sessionType: SessionType) => Promise<void>
  activeUsers: User[]
}

// تعويض is excluded from bulk update since dates differ per participant
const BULK_SESSION_TYPES = SESSION_TYPES.filter((t) => t !== 'تعويض')

export function BulkSessionTypeModal({
  isOpen,
  onClose,
  onConfirm,
  activeUsers,
}: BulkSessionTypeModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(activeUsers.map((u) => u.entryId!).filter(Boolean))
  )
  const [sessionType, setSessionType] = useState<SessionType | ''>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const allSelected = activeUsers.every((u) => u.entryId && selectedIds.has(u.entryId))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(activeUsers.map((u) => u.entryId!).filter(Boolean)))
    }
  }

  const toggleUser = (entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const handleConfirm = async () => {
    if (!sessionType || selectedIds.size === 0) return
    setIsSubmitting(true)
    try {
      await onConfirm([...selectedIds], sessionType as SessionType)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col" dir="rtl">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">تعديل نوع المشاركة</h2>
          <p className="text-sm text-muted-foreground mt-0.5">اختر المشتركين ونوع المشاركة الجديد</p>
        </div>

        <div className="p-4 border-b">
          <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
            <SelectTrigger>
              <SelectValue placeholder="اختر نوع المشاركة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {BULK_SESSION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto flex-1">
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 px-4 py-3 border-b text-sm font-medium hover:bg-accent/50 transition-colors"
          >
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${allSelected ? 'bg-primary border-primary' : 'border-muted-foreground/50'}`}>
              {allSelected && <span className="text-primary-foreground text-xs">✓</span>}
            </span>
            {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            <span className="mr-auto text-muted-foreground">{selectedIds.size} / {activeUsers.length}</span>
          </button>

          {activeUsers.map((user) => {
            if (!user.entryId) return null
            const checked = selectedIds.has(user.entryId)
            const name = user.realName || user.telegramName
            return (
              <button
                key={user.entryId}
                onClick={() => toggleUser(user.entryId!)}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b last:border-0 text-sm hover:bg-accent/50 transition-colors"
              >
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/50'}`}>
                  {checked && <span className="text-primary-foreground text-xs">✓</span>}
                </span>
                <span className="flex-1 text-right">{name}</span>
                {user.sessionType && (
                  <span className="text-xs text-muted-foreground">{user.isCompensation ? 'تعويض' : user.sessionType}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button
            onClick={handleConfirm}
            disabled={!sessionType || selectedIds.size === 0 || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'جارٍ التحديث...' : `تحديث ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  )
}
