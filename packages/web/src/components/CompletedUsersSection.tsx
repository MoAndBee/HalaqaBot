import { useState } from 'react'
import { CheckCircle2, ChevronDown, Edit, Plus, Trash2, MoreVertical } from 'lucide-react'
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

interface CompletedUser {
  entryId?: string
  id: number
  telegramName: string
  realName?: string | null
  username?: string | null
  position: number
  completedAt?: number
  sessionType?: string
}

interface CompletedUsersSectionProps {
  users: CompletedUser[]
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onDelete?: (entryId: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
}

function CompletedUserCard({
  user,
  onUpdateSessionType,
  onUpdateDisplayName,
  onDelete,
  onAddTurnAfter3,
}: {
  user: CompletedUser
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onDelete?: (entryId: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
}) {
  const [isEditingType, setIsEditingType] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)
  const [editedName, setEditedName] = useState(user.realName || '')

  const handleEditTypeClick = () => {
    setSelectedType((user.sessionType as SessionType) || null)
    setIsEditingType(true)
  }

  const handleConfirmType = () => {
    if (selectedType && user.entryId) {
      onUpdateSessionType(user.entryId, selectedType)
      setIsEditingType(false)
    }
  }

  const handleCancelType = () => {
    setIsEditingType(false)
    setSelectedType(null)
  }

  const handleSaveName = () => {
    if (onUpdateDisplayName) {
      onUpdateDisplayName(user.id, editedName)
    }
    setIsEditingName(false)
  }

  const handleCancelName = () => {
    setEditedName(user.realName || '')
    setIsEditingName(false)
  }

  const handleDelete = () => {
    if (onDelete && user.entryId && window.confirm(`هل تريد حذف ${user.realName || user.telegramName}؟`)) {
      onDelete(user.entryId)
    }
  }

  const handleAddTurnAfter3 = () => {
    if (onAddTurnAfter3) {
      onAddTurnAfter3(user.id, undefined)
    }
  }

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  const primaryName = user.realName || user.telegramName
  const secondaryText = user.realName
    ? `${user.telegramName}${user.username ? ' @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <Card className="p-2 sm:p-3 bg-green-50/50 dark:bg-slate-800/40 border-green-300 dark:border-green-900/30" dir="rtl">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Actions dropdown */}
        {!isEditingName && !isEditingType && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">خيارات</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onUpdateDisplayName && (
                <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                  <Edit className="h-4 w-4 ml-2" />
                  <span>تعديل الاسم</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleEditTypeClick}>
                <Edit className="h-4 w-4 ml-2" />
                <span>تعديل المشاركة</span>
              </DropdownMenuItem>
              {onAddTurnAfter3 && (
                <DropdownMenuItem onClick={handleAddTurnAfter3}>
                  <Plus className="h-4 w-4 ml-2" />
                  <span>إضافة دور بعد ٣</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 ml-2" />
                    <span>حذف</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Done icon */}
        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />

        {/* User info */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex flex-col gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="أدخل الاسم"
                autoFocus
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveName} size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                  حفظ
                </Button>
                <Button onClick={handleCancelName} size="sm" variant="ghost">
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium truncate">{primaryName}</div>
              {secondaryText && (
                <div className="text-xs text-muted-foreground truncate">{secondaryText}</div>
              )}
            </>
          )}
        </div>

        {/* Session type badge */}
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
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {user.sessionType || 'غير محدد'}
            </Badge>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground hidden sm:block shrink-0">
          {formatTimestamp(user.completedAt)}
        </div>
      </div>
    </Card>
  )
}

export function CompletedUsersSection({
  users,
  onUpdateSessionType,
  onUpdateDisplayName,
  onDelete,
  onAddTurnAfter3,
}: CompletedUsersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (users.length === 0) {
    return null
  }

  return (
    <div className="mb-4" dir="rtl">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="outline"
        className="w-full justify-between h-auto py-3"
      >
        <span className="font-medium">الأدوار الفائتة ({users.length})</span>
        <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", isExpanded && "rotate-180")} />
      </Button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {users.map((user) => (
            <CompletedUserCard
              key={user.entryId || user.id}
              user={user}
              onUpdateSessionType={onUpdateSessionType}
              onUpdateDisplayName={onUpdateDisplayName}
              onDelete={onDelete}
              onAddTurnAfter3={onAddTurnAfter3}
            />
          ))}
        </div>
      )}
    </div>
  )
}
