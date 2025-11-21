import { useState, useRef, useEffect } from 'react'
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
  index: _index,
  onUpdateSessionType,
  onUpdateDisplayName,
  onDelete,
  onAddTurnAfter3,
}: {
  user: CompletedUser
  index: number
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onDelete?: (entryId: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
}) {
  const [isEditingType, setIsEditingType] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)
  const [editedName, setEditedName] = useState(user.realName || '')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEditTypeClick = () => {
    setSelectedType((user.sessionType as SessionType) || null)
    setIsEditingType(true)
    setIsDropdownOpen(false)
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
    setIsDropdownOpen(false)
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
    setIsDropdownOpen(false)
  }

  const handleAddTurnAfter3 = () => {
    if (onAddTurnAfter3) {
      // For completed users, pass undefined so they get added at position 4
      onAddTurnAfter3(user.id, undefined)
    }
    setIsDropdownOpen(false)
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

  // Show realName if available, otherwise show telegramName
  const primaryName = user.realName || user.telegramName
  // Show both realName and telegramName when realName is set
  const secondaryText = user.realName
    ? `${user.telegramName}${user.username ? ' @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <div
      className="bg-slate-800/40 border border-green-900/30 rounded-lg p-2 sm:p-3 opacity-75"
      dir="rtl"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Actions dropdown - positioned on the left in RTL */}
        {!isEditingName && !isEditingType && (
          <div className="relative order-first" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 transition-colors p-1 rounded"
              aria-label="خيارات"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="fixed sm:absolute right-2 sm:right-0 top-auto sm:top-full mt-1 w-40 max-w-[10rem] bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                {onUpdateDisplayName && (
                  <button
                    onClick={handleEditNameClick}
                    className="w-full px-4 py-2 text-right text-white hover:bg-slate-700 transition-colors rounded-t-lg flex items-center gap-2 justify-end"
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
                <button
                  onClick={handleEditTypeClick}
                  className="w-full px-4 py-2 text-right text-white hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
                >
                  <span>تعديل النوع</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                {onAddTurnAfter3 && (
                  <button
                    onClick={handleAddTurnAfter3}
                    className="w-full px-4 py-2 text-right text-white hover:bg-slate-700 transition-colors flex items-center gap-2 justify-end"
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
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-right text-red-400 hover:bg-slate-700 transition-colors rounded-b-lg flex items-center gap-2 justify-end"
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
                )}
              </div>
            )}
          </div>
        )}

        {/* Done icon */}
        <div className="text-green-500 shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Position number */}
        <div className="text-slate-500 font-mono text-xs sm:text-sm w-6 sm:w-8 shrink-0">{user.position}.</div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 text-sm"
                placeholder="أدخل الاسم"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveName}
                  className="text-green-500 hover:text-green-400 text-xs"
                >
                  حفظ
                </button>
                <button
                  onClick={handleCancelName}
                  className="text-slate-400 hover:text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-slate-300 text-xs sm:text-sm font-medium truncate">{primaryName}</div>
              {secondaryText && (
                <div className="text-slate-500 text-xs truncate">{secondaryText}</div>
              )}
            </>
          )}
        </div>

        {/* Session type badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isEditingType ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={selectedType || ''}
                onChange={(e) => setSelectedType(e.target.value as SessionType)}
                className="bg-slate-700 text-white text-xs sm:text-sm px-1.5 sm:px-2 py-1 rounded border border-slate-600"
              >
                <option value="">اختر</option>
                <option value="تلاوة">تلاوة</option>
                <option value="تسميع">تسميع</option>
              </select>
              <button
                onClick={handleConfirmType}
                className="text-green-500 hover:text-green-400 text-xs"
              >
                تأكيد
              </button>
              <button
                onClick={handleCancelType}
                className="text-slate-400 hover:text-slate-300 text-xs"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <span className="bg-slate-700 text-slate-300 text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">
              {user.sessionType || 'غير محدد'}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-slate-500 text-xs hidden sm:block shrink-0">{formatTimestamp(user.completedAt)}</div>
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
}: CompletedUsersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (users.length === 0) {
    return null
  }

  return (
    <div className="mb-4" dir="rtl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors rounded-lg border border-slate-700"
      >
        <span className="text-slate-300 font-medium">الأدوار الفائتة</span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {users.map((user, index) => (
            <CompletedUserCard
              key={user.entryId || user.id}
              user={user}
              index={index}
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
