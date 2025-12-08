import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { MoreVertical, GripVertical, Pencil, StickyNote, Tag, Plus, ArrowDown, ArrowUpDown, Trash2, Check, X } from 'lucide-react'
import type { User } from '@halakabot/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import type { SessionType } from './SplitButton'

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
  onSetCompensation?: (entryId: string, currentDates?: number[] | null) => void
  totalUsers?: number
}

export function DraggableUser({ user, index, onDelete, onUpdateDisplayName, onUpdateSessionType, onAddTurnAfter3, onMoveToEnd, onMoveToPosition, onEditNotes, onSetCompensation, totalUsers }: DraggableUserProps) {
const SESSION_TYPES: SessionType[] = ['تلاوة', 'تسميع', 'تطبيق', 'اختبار', 'دعم']

export function DraggableUser({ user, index, onDelete, onUpdateDisplayName, onUpdateSessionType, onAddTurnAfter3, onMoveToEnd, onMoveToPosition, onEditNotes, totalUsers }: DraggableUserProps) {
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
    setIsDropdownOpen(false)
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
          <div className="relative order-first" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-slate-400 hover:text-slate-300 transition-colors p-1"
              aria-label="خيارات"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 max-w-[10rem] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                {onUpdateDisplayName && (
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors rounded-t-lg flex items-center gap-2 justify-end"
                  >
                    <span>تعديل الاسم</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                )}
                {onEditNotes && (
                  <button
                    onClick={handleEditNotes}
                    className={`w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end ${!onUpdateDisplayName ? 'rounded-t-lg' : ''}`}
                  >
                    <span>إضافة ملاحظات</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                )}
                {onSetCompensation && (
                  <button
                    onClick={handleSetCompensation}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                  >
                    <span>تحديد تعويض</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                )}
                {onUpdateSessionType && (
                  <button
                    onClick={handleEditTypeClick}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                  >
                    <span>تعديل المشاركة</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                )}
                {onAddTurnAfter3 && (
                  <button
                    onClick={handleAddTurnAfter3}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                  >
                    <span>إضافة دور بعد ٣</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                )}
                {onMoveToEnd && (
                  <button
                    onClick={handleMoveToEnd}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                  >
                    <span>نقل إلى آخر القائمة</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </button>
                )}
                {onMoveToPosition && (
                  <button
                    onClick={handleMoveToPosition}
                    className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                  >
                    <span>نقل إلى دور معين</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-4 py-2 text-right text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-700 dark:hover:text-red-300 transition-colors rounded-b-lg flex items-center gap-2 justify-end"
                >
                  <span>حذف</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 order-first">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onUpdateDisplayName && (
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل الاسم
                </DropdownMenuItem>
              )}
              {onEditNotes && (
                <DropdownMenuItem onClick={handleEditNotes}>
                  <StickyNote className="h-4 w-4 ml-2" />
                  إضافة ملاحظات
                </DropdownMenuItem>
              )}
              {onUpdateSessionType && (
                <DropdownMenuItem onClick={handleEditTypeClick}>
                  <Tag className="h-4 w-4 ml-2" />
                  تعديل المشاركة
                </DropdownMenuItem>
              )}
              {onAddTurnAfter3 && (
                <DropdownMenuItem onClick={handleAddTurnAfter3}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة دور بعد ٣
                </DropdownMenuItem>
              )}
              {onMoveToEnd && (
                <DropdownMenuItem onClick={handleMoveToEnd}>
                  <ArrowDown className="h-4 w-4 ml-2" />
                  نقل إلى آخر القائمة
                </DropdownMenuItem>
              )}
              {onMoveToPosition && (
                <DropdownMenuItem onClick={handleMoveToPosition}>
                  <ArrowUpDown className="h-4 w-4 ml-2" />
                  نقل إلى دور معين
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 ml-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-2 -m-2 touch-manipulation"
          aria-label="اسحب لإعادة الترتيب"
        >
          <GripVertical className="h-5 w-5" />
        </button>

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
              {user.notes && (
                <div className="mt-1 text-muted-foreground text-xs sm:text-sm italic">
                  {user.notes}
                </div>
              )}
              {user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border border-purple-300 dark:border-purple-700/50 font-medium">
                    🔄 تعويض
                  </span>
                  <span className="text-gray-600 dark:text-slate-400">
                    {user.compensatingForDates.map(timestamp =>
                      new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
                    ).join('، ')}
                  </span>
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
              <Badge variant={user.sessionType ? "default" : "secondary"} className="text-xs">
                {user.sessionType || 'غير محدد'}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
