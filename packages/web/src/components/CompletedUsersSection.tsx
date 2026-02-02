import { useState } from 'react'
import { ChevronDown, CheckCircle, MoreVertical, Pencil, Tag, Plus, Trash2, Check, X, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

interface CompletedUser {
  entryId?: string
  id: number
  telegramName: string
  realName?: string | null
  username?: string | null
  position: number
  completedAt?: number
  sessionType?: string
  isCompensation?: boolean
  compensatingForDates?: number[]
}

interface CompletedUsersSectionProps {
  users: CompletedUser[]
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onDelete?: (entryId: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
  isLocked?: boolean
}

const SESSION_TYPES: SessionType[] = ['تلاوة', 'تسميع', 'تطبيق', 'اختبار', 'دعم', 'مراجعة', 'تعويض']

function CompletedUserCard({
  user,
  onUpdateSessionType,
  onUpdateDisplayName,
  onDelete,
  onAddTurnAfter3,
  isLocked,
}: {
  user: CompletedUser
  index: number
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onDelete?: (entryId: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
  isLocked?: boolean
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

  const handleEditNameClick = () => {
    setEditedName(user.realName || '')
    setIsEditingName(true)
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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id.toString())
      toast.success('تم نسخ المعرف!')
    } catch (error) {
      toast.error('فشل نسخ المعرف')
      console.error('Copy ID failed:', error)
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
    <div
      className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-lg p-2 sm:p-3"
      dir="rtl"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {!isEditingName && !isEditingType && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 order-first">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onUpdateDisplayName && (
                <DropdownMenuItem onClick={handleEditNameClick} disabled={isLocked}>
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل الاسم
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleEditTypeClick} disabled={isLocked}>
                <Tag className="h-4 w-4 ml-2" />
                تعديل المشاركة
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyId}>
                <Hash className="h-4 w-4 ml-2" />
                نسخ المعرف
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onAddTurnAfter3 && (
                <DropdownMenuItem onClick={handleAddTurnAfter3} disabled={isLocked}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة دور بعد ٣
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} disabled={isLocked} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />

        <div className="flex-1 min-w-0">
          {isEditingName ? (
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
                <Button variant="ghost" size="sm" onClick={handleSaveName} className="h-6 px-2 text-xs text-green-600">
                  <Check className="h-3 w-3 ml-1" />
                  حفظ
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancelName} className="h-6 px-2 text-xs">
                  <X className="h-3 w-3 ml-1" />
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-foreground text-xs sm:text-sm font-medium truncate">{primaryName}</div>
              {secondaryText && (
                <div className="text-muted-foreground text-xs truncate">{secondaryText}</div>
              )}
              {user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0 && (
                <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                  تعويض عن: {user.compensatingForDates.map(timestamp =>
                    new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
                  ).join('، ')}
                </div>
              )}
            </>
          )}
        </div>

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
            <Badge variant="secondary" className="text-xs">
              {user.sessionType || 'غير محدد'}
            </Badge>
          )}
        </div>

        <div className="text-muted-foreground text-xs hidden sm:block shrink-0">
          {formatTimestamp(user.completedAt)}
        </div>
      </div>
    </div>
  )
}

export function CompletedUsersSection({
  users,
  onUpdateSessionType,
  onUpdateDisplayName,
  onDelete,
  onAddTurnAfter3,
  isLocked,
}: CompletedUsersSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (users.length === 0) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4" dir="rtl">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
        >
          <span className="font-medium">الأدوار الفائتة ({users.length})</span>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-2">
        {users.map((user, index) => (
          <CompletedUserCard
            key={user.entryId || user.id}
            user={user}
            index={index}
            onUpdateSessionType={onUpdateSessionType}
            onUpdateDisplayName={onUpdateDisplayName}
            onDelete={onDelete}
            onAddTurnAfter3={onAddTurnAfter3}
            isLocked={isLocked}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
