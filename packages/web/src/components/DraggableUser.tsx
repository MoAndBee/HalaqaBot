import { useSortable } from '@dnd-kit/sortable'
import { tgConfirm } from '@/lib/utils'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { MoreVertical, GripVertical, Pencil, StickyNote, Tag, Plus, ArrowDown, ArrowUp, ArrowUpDown, Trash2, Check, X, Calendar, Hash, MicOff } from 'lucide-react'
import type { User } from '@halakabot/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SESSION_TYPES, type SessionType } from '@/lib/session-types'

interface DraggableUserProps {
  user: User
  index: number
  onDelete: (entryId: string) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onUpdateSessionType?: (entryId: string, sessionType: SessionType) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
  onMoveToTop?: (entryId: string) => void
  onMoveToEnd?: (entryId: string) => void
  onMoveToPosition?: (entryId: string, position: number) => void
  onEditNotes?: (entryId: string, currentNotes?: string | null) => void
  onSetCompensation?: (entryId: string, currentDates?: number[] | null) => void
  onUnskip?: (entryId: string) => void
  totalUsers?: number
  isLocked?: boolean
}

export function DraggableUser({ user, index, onDelete, onUpdateDisplayName, onUpdateSessionType, onAddTurnAfter3, onMoveToTop, onMoveToEnd, onMoveToPosition, onEditNotes, onSetCompensation, onUnskip, totalUsers, isLocked }: DraggableUserProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(user.realName || '')
  const [isEditingType, setIsEditingType] = useState(false)
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: user.entryId || user.id.toString() })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleSave = () => {
    if (onUpdateDisplayName) {
      onUpdateDisplayName(user.id, editedName)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedName(user.realName || '')
    setIsEditing(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleDeleteClick = async () => {
    if (await tgConfirm(`هل تريد حذف ${user.realName || user.telegramName}؟`)) {
      if (user.entryId) {
        onDelete(user.entryId)
      }
    }
  }

  const handleAddTurnAfter3 = () => {
    if (onAddTurnAfter3) {
      const currentPosition = user.position ?? (index + 1)
      onAddTurnAfter3(user.id, currentPosition)
    }
  }

  const handleMoveToTop = () => {
    if (onMoveToTop && user.entryId) {
      onMoveToTop(user.entryId)
    }
  }

  const handleMoveToEnd = () => {
    if (onMoveToEnd && user.entryId) {
      onMoveToEnd(user.entryId)
    }
  }

  const handleMoveToPosition = () => {
    if (!onMoveToPosition || !user.entryId || !totalUsers) {
      return
    }

    const currentPosition = index + 1
    const positionInput = window.prompt(
      `أدخل رقم الدور (من 1 إلى ${totalUsers})\nالدور الحالي: ${currentPosition}`,
      currentPosition.toString()
    )

    if (positionInput === null) return

    const newPosition = parseInt(positionInput.trim(), 10)

    if (isNaN(newPosition) || newPosition < 1 || newPosition > totalUsers) {
      alert(`الرجاء إدخال رقم صحيح بين 1 و ${totalUsers}`)
      return
    }

    if (newPosition !== currentPosition) {
      onMoveToPosition(user.entryId, newPosition)
    }
  }

  const handleEditNotes = () => {
    if (onEditNotes && user.entryId) {
      onEditNotes(user.entryId, user.notes)
    }
  }

  const handleSetCompensation = () => {
    if (onSetCompensation && user.entryId) {
      onSetCompensation(user.entryId, user.compensatingForDates)
    }
  }

  const handleUnskip = () => {
    if (onUnskip && user.entryId) {
      onUnskip(user.entryId)
    }
  }

  const handleEditTypeClick = () => {
    setSelectedType((user.sessionType as SessionType) || null)
    setIsEditingType(true)
  }

  const handleConfirmType = () => {
    if (selectedType && user.entryId) {
      // If compensation is selected, open the compensation modal
      if (selectedType === 'تعويض' && onSetCompensation) {
        setIsEditingType(false)
        onSetCompensation(user.entryId, user.compensatingForDates)
      } else if (onUpdateSessionType) {
        // For other session types, update normally
        onUpdateSessionType(user.entryId, selectedType)
        setIsEditingType(false)
      }
    }
  }

  const handleCancelType = () => {
    setIsEditingType(false)
    setSelectedType(null)
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id.toString())
      toast.success('تم نسخ المعرف!')
    } catch (error) {
      toast.error('فشل نسخ المعرف')
      console.error('Copy ID failed:', error)
    }
  }

  const primaryName = user.realName || user.telegramName
  const secondaryText = user.realName
    ? `${user.telegramName}${user.username ? ' @' + user.username : ''}`
    : `${user.username ? '@' + user.username : ''}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg p-2 sm:p-3 transition-colors duration-200",
        user.carriedOver ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50" : "bg-card border-border",
        isDragging && "opacity-50 border-primary shadow-lg z-50",
        !isDragging && "hover:border-muted-foreground/50 hover:bg-accent/50"
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {!isEditing && !isEditingType && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 order-first">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onUpdateDisplayName && (
                <DropdownMenuItem onClick={handleEdit} disabled={isLocked}>
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل الاسم
                </DropdownMenuItem>
              )}
              {onUpdateSessionType && (
                <DropdownMenuItem onClick={handleEditTypeClick} disabled={isLocked}>
                  <Tag className="h-4 w-4 ml-2" />
                  تعديل المشاركة
                </DropdownMenuItem>
              )}
              {onEditNotes && (
                <DropdownMenuItem onClick={handleEditNotes} disabled={isLocked}>
                  <StickyNote className="h-4 w-4 ml-2" />
                  إضافة ملاحظات
                </DropdownMenuItem>
              )}
              {onUnskip && user.wasSkipped && user.entryId && (
                <DropdownMenuItem onClick={handleUnskip} disabled={isLocked}>
                  <MicOff className="h-4 w-4 ml-2" />
                  إزالة علامة التخطي
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onAddTurnAfter3 && (
                <DropdownMenuItem onClick={handleAddTurnAfter3} disabled={isLocked}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة دور بعد ٣
                </DropdownMenuItem>
              )}
              {onMoveToTop && (
                <DropdownMenuItem onClick={handleMoveToTop} disabled={isLocked}>
                  <ArrowUp className="h-4 w-4 ml-2" />
                  نقل إلى أول القائمة
                </DropdownMenuItem>
              )}
              {onMoveToPosition && (
                <DropdownMenuItem onClick={handleMoveToPosition} disabled={isLocked}>
                  <ArrowUpDown className="h-4 w-4 ml-2" />
                  نقل إلى دور معين
                </DropdownMenuItem>
              )}
              {onMoveToEnd && (
                <DropdownMenuItem onClick={handleMoveToEnd} disabled={isLocked}>
                  <ArrowDown className="h-4 w-4 ml-2" />
                  نقل إلى آخر القائمة
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyId}>
                <Hash className="h-4 w-4 ml-2" />
                نسخ المعرف
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteClick} disabled={isLocked} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-2 -m-2 touch-manipulation"
          aria-label="اسحب لإعادة الترتيب"
        >
          <GripVertical className="h-5 w-5" />
        </button> */}

        <div className={cn(
          "font-mono text-xs sm:text-sm w-6 sm:w-8 shrink-0",
          user.carriedOver ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {index + 1}.
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="أدخل الاسم"
                className="h-8"
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSave} className="h-6 px-2 text-xs text-green-600">
                  <Check className="h-3 w-3 ml-1" />
                  حفظ
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 px-2 text-xs">
                  <X className="h-3 w-3 ml-1" />
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm sm:text-base">{primaryName}</span>
                {user.carriedOver && (
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700/50 text-xs">
                    من الحلقة السابقة
                  </Badge>
                )}
              </div>
              {secondaryText && (
                <div className="text-muted-foreground text-xs sm:text-sm truncate">{secondaryText}</div>
              )}
              {user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0 && (
                <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                  تعويض عن: {user.compensatingForDates.map(timestamp =>
                    new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
                  ).join('، ')}
                </div>
              )}
              {user.notes && (
                <div className="mt-1 text-muted-foreground text-xs sm:text-sm italic">
                  {user.notes}
                </div>
              )}
              {user.wasSkipped && (
                <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                  🗣️
                </div>
              )}
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isEditingType ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Select value={selectedType || ''} onValueChange={(val) => setSelectedType(val as SessionType)}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {SESSION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={handleConfirmType} className="h-6 px-2 text-xs text-green-600">
                  تأكيد
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelType} className="h-6 px-2 text-xs">
                  إلغاء
                </Button>
              </div>
            ) : (
              <Badge variant={
                (user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0) || user.sessionType
                  ? "default"
                  : "secondary"
              } className="text-xs">
                {(user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0)
                  ? 'تعويض'
                  : (user.sessionType || 'غير محدد')}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
