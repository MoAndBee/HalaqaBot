import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useRef, useEffect } from 'react'
import type { User } from '@halakabot/db'

interface DraggableUserProps {
  user: User
  index: number
  onDelete: (entryId: string) => void
  onUpdateDisplayName?: (userId: number, realName: string) => void
  onAddTurnAfter3?: (userId: number, currentPosition: number | undefined) => void
  onMoveToEnd?: (entryId: string) => void
  onMoveToPosition?: (entryId: string, position: number) => void
  totalUsers?: number
}

export function DraggableUser({ user, index, onDelete, onUpdateDisplayName, onAddTurnAfter3, onMoveToEnd, onMoveToPosition, totalUsers }: DraggableUserProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(user.realName || '')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleEdit = () => {
    setIsEditing(true)
    setIsDropdownOpen(false)
  }

  const handleDeleteClick = () => {
    if (window.confirm(`هل تريد حذف ${user.realName || user.telegramName}؟`)) {
      if (user.entryId) {
        onDelete(user.entryId)
      }
    }
    setIsDropdownOpen(false)
  }

  const handleAddTurnAfter3 = () => {
    if (onAddTurnAfter3) {
      const currentPosition = user.position ?? (index + 1)
      onAddTurnAfter3(user.id, currentPosition)
    }
    setIsDropdownOpen(false)
  }

  const handleMoveToEnd = () => {
    if (onMoveToEnd && user.entryId) {
      onMoveToEnd(user.entryId)
    }
    setIsDropdownOpen(false)
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

    if (positionInput === null) {
      // User cancelled
      setIsDropdownOpen(false)
      return
    }

    const newPosition = parseInt(positionInput.trim(), 10)

    if (isNaN(newPosition) || newPosition < 1 || newPosition > totalUsers) {
      alert(`الرجاء إدخال رقم صحيح بين 1 و ${totalUsers}`)
      setIsDropdownOpen(false)
      return
    }

    if (newPosition === currentPosition) {
      // No change needed
      setIsDropdownOpen(false)
      return
    }

    onMoveToPosition(user.entryId, newPosition)
    setIsDropdownOpen(false)
  }

  // Show realName if available, otherwise show telegramName
  const primaryName = user.realName || user.telegramName
  // Show both realName and telegramName when realName is set
  const secondaryText = user.realName
    ? `${user.telegramName}${user.username ? ' @' + user.username : ''} (${user.id})`
    : `${user.username ? '@' + user.username + ' ' : ''}(${user.id})`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${user.carriedOver ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-white dark:bg-slate-800'} border rounded-lg p-2 sm:p-3
        ${isDragging ? 'opacity-50 border-blue-500 shadow-lg z-50' : user.carriedOver ? 'border-amber-300 dark:border-amber-700/50' : 'border-gray-200 dark:border-slate-700'}
        ${!isDragging ? user.carriedOver ? 'hover:border-amber-400 dark:hover:border-amber-600/70 hover:bg-amber-100 dark:hover:bg-amber-950/30' : 'hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-750' : ''}
        transition-colors duration-200
      `}
      dir="rtl"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Actions dropdown - positioned on the left in RTL */}
        {!isEditing && (
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
                    <span>تعديل</span>
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
        )}

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-300 transition-colors p-2 -m-2 touch-manipulation"
          aria-label="اسحب لإعادة الترتيب"
        >
          <svg
            className="w-6 h-6 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>

        {/* Position number */}
        <div className={`${user.carriedOver ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-slate-400'} font-mono text-xs sm:text-sm w-6 sm:w-8 shrink-0`}>
          {index + 1}.
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white px-2 py-1 rounded border border-gray-300 dark:border-slate-600 text-sm"
                placeholder="أدخل الاسم"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 text-xs"
                >
                  حفظ
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="text-gray-900 dark:text-white font-medium text-sm sm:text-base">{primaryName}</div>
                {user.carriedOver && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50">
                    من الحلقة السابقة
                  </span>
                )}
              </div>
              {secondaryText && (
                <div className="text-gray-600 dark:text-slate-400 text-xs sm:text-sm truncate">{secondaryText}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
