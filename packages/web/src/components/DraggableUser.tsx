import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { Edit, FileText, Trash2, Plus, ArrowDown, MoveVertical, GripVertical, MoreVertical } from 'lucide-react'
import type { User } from '@halakabot/db'
import type { SessionType } from './SplitButton'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface DraggableUserProps {
  user: User
  index: number
  onDelete: (entryId: string) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onUpdateSessionType?: (entryId: string, sessionType: SessionType) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
  onMoveToEnd?: (entryId: string) => void
  onMoveToPosition?: (entryId: string, position: number) => void
  onEditNotes?: (entryId: string, currentNotes?: string | null) => void
  totalUsers?: number
}

export function DraggableUser({
  user,
  index,
  onDelete,
  onUpdateDisplayName,
  onUpdateSessionType,
  onAddTurnAfter3,
  onMoveToEnd,
  onMoveToPosition,
  onEditNotes,
  totalUsers
}: DraggableUserProps) {
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

  const handleDeleteClick = () => {
    if (window.confirm(`هل تريد حذف ${user.realName || user.telegramName}؟`)) {
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

    if (newPosition === currentPosition) return

    onMoveToPosition(user.entryId, newPosition)
  }

  const handleEditNotes = () => {
    if (onEditNotes && user.entryId) {
      onEditNotes(user.entryId, user.notes)
    }
  }

  const handleEditTypeClick = () => {
    setSelectedType((user.sessionType as SessionType) || null)
    setIsEditingType(true)
  }

  const handleConfirmType = () => {
    if (selectedType && user.entryId && onUpdateSessionType) {
      onUpdateSessionType(user.entryId, selectedType)
      setIsEditingType(false)
    }
  }

  const handleCancelType = () => {
    setIsEditingType(false)
    setSelectedType(null)
  }

  const primaryName = user.realName || user.telegramName
  const secondaryText = user.realName
    ? `${user.telegramName}${user.username ? ' @' + user.username : ''} (${user.id})`
    : `${user.username ? '@' + user.username + ' ' : ''}(${user.id})`

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 sm:p-3 transition-colors",
        isDragging && "opacity-50 shadow-lg z-50",
        user.carriedOver && "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50",
        !isDragging && user.carriedOver && "hover:border-amber-400 dark:hover:border-amber-600/70 hover:bg-amber-100 dark:hover:bg-amber-950/30",
        !isDragging && !user.carriedOver && "hover:border-gray-300 dark:hover:border-slate-600"
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Actions dropdown */}
        {!isEditing && !isEditingType && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">خيارات</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onUpdateDisplayName && (
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 ml-2" />
                  <span>تعديل الاسم</span>
                </DropdownMenuItem>
              )}
              {onEditNotes && (
                <DropdownMenuItem onClick={handleEditNotes}>
                  <FileText className="h-4 w-4 ml-2" />
                  <span>إضافة ملاحظات</span>
                </DropdownMenuItem>
              )}
              {onUpdateSessionType && (
                <DropdownMenuItem onClick={handleEditTypeClick}>
                  <Edit className="h-4 w-4 ml-2" />
                  <span>تعديل المشاركة</span>
                </DropdownMenuItem>
              )}
              {onAddTurnAfter3 && (
                <DropdownMenuItem onClick={handleAddTurnAfter3}>
                  <Plus className="h-4 w-4 ml-2" />
                  <span>إضافة دور بعد ٣</span>
                </DropdownMenuItem>
              )}
              {onMoveToEnd && (
                <DropdownMenuItem onClick={handleMoveToEnd}>
                  <ArrowDown className="h-4 w-4 ml-2" />
                  <span>نقل إلى آخر القائمة</span>
                </DropdownMenuItem>
              )}
              {onMoveToPosition && (
                <DropdownMenuItem onClick={handleMoveToPosition}>
                  <MoveVertical className="h-4 w-4 ml-2" />
                  <span>نقل إلى دور معين</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                <Trash2 className="h-4 w-4 ml-2" />
                <span>حذف</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Drag handle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 cursor-grab active:cursor-grabbing shrink-0 touch-manipulation"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
          <span className="sr-only">اسحب لإعادة الترتيب</span>
        </Button>

        {/* Position number */}
        <div className={cn(
          "font-mono text-xs sm:text-sm w-6 sm:w-8 shrink-0",
          user.carriedOver ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {index + 1}.
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="أدخل الاسم"
                autoFocus
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                  حفظ
                </Button>
                <Button onClick={handleCancel} size="sm" variant="ghost">
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="font-medium text-sm sm:text-base">{primaryName}</div>
                {user.carriedOver && (
                  <Badge variant="warning" className="text-xs">
                    من الحلقة السابقة
                  </Badge>
                )}
              </div>
              {secondaryText && (
                <div className="text-muted-foreground text-xs sm:text-sm truncate">{secondaryText}</div>
              )}
              {user.notes && (
                <div className="mt-1 text-muted-foreground text-xs sm:text-sm italic">
                  {user.notes}
                </div>
              )}
            </>
          )}
        </div>

        {/* Session type badge */}
        {!isEditing && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isEditingType ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Select value={selectedType || ''} onValueChange={(value) => setSelectedType(value as SessionType)}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue placeholder="اختر" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="تلاوة">تلاوة</SelectItem>
                    <SelectItem value="تسميع">تسميع</SelectItem>
                    <SelectItem value="تطبيق">تطبيق</SelectItem>
                    <SelectItem value="اختبار">اختبار</SelectItem>
                    <SelectItem value="دعم">دعم</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleConfirmType} size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-xs h-8 px-2">
                  تأكيد
                </Button>
                <Button onClick={handleCancelType} size="sm" variant="ghost" className="text-xs h-8 px-2">
                  إلغاء
                </Button>
              </div>
            ) : (
              <Badge variant={user.sessionType ? "info" : "secondary"} className="text-xs whitespace-nowrap">
                {user.sessionType || 'غير محدد'}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
