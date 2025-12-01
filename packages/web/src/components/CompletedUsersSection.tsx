import { useState } from 'react'
import { CheckCircle2, ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
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
    ? `${user.telegramName}${user.username ? ' • @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <Card className="border-l-4 border-l-success" dir="rtl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Done Icon */}
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-1">
            {isEditingName ? (
              <div className="space-y-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="أدخل الاسم"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveName} size="sm">
                    حفظ
                  </Button>
                  <Button onClick={handleCancelName} size="sm" variant="outline">
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-medium">{primaryName}</p>
                {secondaryText && (
                  <p className="text-sm text-muted-foreground">{secondaryText}</p>
                )}
              </>
            )}
          </div>

          {/* Session Type */}
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
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {user.sessionType || 'غير محدد'}
                </Badge>
                {user.completedAt && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {formatTimestamp(user.completedAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions Menu */}
          {!isEditingName && !isEditingType && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onUpdateDisplayName && (
                  <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    تعديل الاسم
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleEditTypeClick}>
                  <Pencil className="mr-2 h-4 w-4" />
                  تعديل نوع المشاركة
                </DropdownMenuItem>
                {onAddTurnAfter3 && (
                  <DropdownMenuItem onClick={handleAddTurnAfter3}>
                    <Plus className="mr-2 h-4 w-4" />
                    إضافة دور بعد ٣
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
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
    <div className="space-y-2" dir="rtl">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        variant="outline"
        className="w-full justify-between"
      >
        <span>الأدوار المكتملة ({users.length})</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
      </Button>

      {isExpanded && (
        <div className="space-y-2">
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
