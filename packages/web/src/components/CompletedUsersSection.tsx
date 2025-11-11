import { useState } from 'react'
import type { SessionType } from './SplitButton'

interface CompletedUser {
  id: number
  first_name: string
  username?: string
  displayName?: string
  position: number
  completedAt?: number
  sessionType?: string
}

interface CompletedUsersSectionProps {
  users: CompletedUser[]
  onUpdateSessionType: (userId: number, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, displayName: string) => void
}

function CompletedUserCard({
  user,
  index: _index,
  onUpdateSessionType,
  onUpdateDisplayName,
}: {
  user: CompletedUser
  index: number
  onUpdateSessionType: (userId: number, sessionType: SessionType) => void
  onUpdateDisplayName?: (userId: number, displayName: string) => void
}) {
  const [isEditingType, setIsEditingType] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)
  const [editedName, setEditedName] = useState(user.displayName || '')

  const handleEditTypeClick = () => {
    setSelectedType((user.sessionType as SessionType) || null)
    setIsEditingType(true)
  }

  const handleConfirmType = () => {
    if (selectedType) {
      onUpdateSessionType(user.id, selectedType)
      setIsEditingType(false)
    }
  }

  const handleCancelType = () => {
    setIsEditingType(false)
    setSelectedType(null)
  }

  const handleEditNameClick = () => {
    setEditedName(user.displayName || '')
    setIsEditingName(true)
  }

  const handleSaveName = () => {
    if (onUpdateDisplayName) {
      onUpdateDisplayName(user.id, editedName)
    }
    setIsEditingName(false)
  }

  const handleCancelName = () => {
    setEditedName(user.displayName || '')
    setIsEditingName(false)
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

  const primaryName = user.displayName || user.first_name
  const secondaryText = user.displayName
    ? `${user.first_name}${user.username ? ' @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <div
      className="bg-slate-800/40 border border-green-900/30 rounded-lg p-3 opacity-75"
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        {/* Done icon */}
        <div className="text-green-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Position number */}
        <div className="text-slate-500 font-mono text-sm w-8">{user.position}.</div>

        {/* User info */}
        <div className="flex-1">
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
              <div className="text-slate-300 text-sm font-medium">{primaryName}</div>
              {secondaryText && (
                <div className="text-slate-500 text-xs">{secondaryText}</div>
              )}
            </>
          )}
        </div>

        {/* Edit name button */}
        {!isEditingName && onUpdateDisplayName && (
          <button
            onClick={handleEditNameClick}
            className="text-slate-400 hover:text-slate-300 transition-colors"
            aria-label="Edit display name"
          >
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

        {/* Session type badge and edit */}
        <div className="flex items-center gap-2">
          {isEditingType ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedType || ''}
                onChange={(e) => setSelectedType(e.target.value as SessionType)}
                className="bg-slate-700 text-white text-sm px-2 py-1 rounded border border-slate-600"
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
            <>
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">
                {user.sessionType || 'غير محدد'}
              </span>
              <button
                onClick={handleEditTypeClick}
                className="text-slate-400 hover:text-slate-300 transition-colors"
                aria-label="Edit session type"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-slate-500 text-xs">{formatTimestamp(user.completedAt)}</div>
      </div>
    </div>
  )
}

export function CompletedUsersSection({
  users,
  onUpdateSessionType,
  onUpdateDisplayName,
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
              key={user.id}
              user={user}
              index={index}
              onUpdateSessionType={onUpdateSessionType}
              onUpdateDisplayName={onUpdateDisplayName}
            />
          ))}
        </div>
      )}
    </div>
  )
}
