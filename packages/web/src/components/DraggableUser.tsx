import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import {
  MoreHorizontal,
  GripVertical,
  Pencil,
  FileText,
  Trash2,
  Plus,
  ChevronsDown,
  ListOrdered
} from 'lucide-react'
import type { User } from '@halakabot/db'
import type { SessionType } from './SplitButton'
import { Card, CardContent } from './ui/card'
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
    if (!onMoveToPosition || !user.entryId || !totalUsers) return

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
    ? `${user.telegramName}${user.username ? ' • @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-all",
        isDragging && "opacity-50 ring-2 ring-primary",
        user.carriedOver && "border-l-4 border-l-warning"
      )}
      dir="rtl"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>

          {/* Position Badge */}
          <Badge variant={user.carriedOver ? "warning" : "secondary"} className="shrink-0 font-mono">
            {index + 1}
          </Badge>

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-1">
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="أدخل الاسم"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button onClick={handleSave} size="sm">
                    حفظ
                  </Button>
                  <Button onClick={handleCancel} size="sm" variant="outline">
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{primaryName}</span>
                  {user.carriedOver && (
                    <Badge variant="warning">من الحلقة السابقة</Badge>
                  )}
                </div>
                {secondaryText && (
                  <p className="text-sm text-muted-foreground">{secondaryText}</p>
                )}
                {user.notes && (
                  <p className="text-sm text-muted-foreground italic">{user.notes}</p>
                )}
              </>
            )}
          </div>

          {/* Session Type */}
          {!isEditing && (
            <div className="shrink-0">
              {isEditingType ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedType || ''} onValueChange={(value) => setSelectedType(value as SessionType)}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="تلاوة">تلاوة</SelectItem>
                      <SelectItem value="تسميع">تسميع</SelectItem>
                      <SelectItem value="تطبيق">تطبيق</SelectItem>
                      <SelectItem value="اختبار">اختبار</SelectItem>
                      <SelectItem value="دعم">دعم</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleConfirmType} size="sm">
                    ✓
                  </Button>
                  <Button onClick={handleCancelType} size="sm" variant="ghost">
                    ✕
                  </Button>
                </div>
              ) : (
                <Badge variant={user.sessionType ? "default" : "outline"}>
                  {user.sessionType || 'غير محدد'}
                </Badge>
              )}
            </div>
          )}

          {/* Actions Menu */}
          {!isEditing && !isEditingType && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onUpdateDisplayName && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    تعديل الاسم
                  </DropdownMenuItem>
                )}
                {onEditNotes && (
                  <DropdownMenuItem onClick={handleEditNotes}>
                    <FileText className="mr-2 h-4 w-4" />
                    إضافة ملاحظات
                  </DropdownMenuItem>
                )}
                {onUpdateSessionType && (
                  <DropdownMenuItem onClick={handleEditTypeClick}>
                    <Pencil className="mr-2 h-4 w-4" />
                    تعديل نوع المشاركة
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onAddTurnAfter3 && (
                  <DropdownMenuItem onClick={handleAddTurnAfter3}>
                    <Plus className="mr-2 h-4 w-4" />
                    إضافة دور بعد ٣
                  </DropdownMenuItem>
                )}
                {onMoveToEnd && (
                  <DropdownMenuItem onClick={handleMoveToEnd}>
                    <ChevronsDown className="mr-2 h-4 w-4" />
                    نقل إلى آخر القائمة
                  </DropdownMenuItem>
                )}
                {onMoveToPosition && (
                  <DropdownMenuItem onClick={handleMoveToPosition}>
                    <ListOrdered className="mr-2 h-4 w-4" />
                    نقل إلى دور معين
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
