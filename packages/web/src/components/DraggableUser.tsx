import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useRef, useEffect } from 'react'
import type { User } from '@halakabot/db'

interface DraggableUserProps {
  user: User & { displayName?: string; carriedOver?: boolean }
  index: number
  onDelete: (userId: number) => void
  onUpdateDisplayName?: (userId: number, displayName: string) => void
}

export function DraggableUser({ user, index, onDelete, onUpdateDisplayName }: DraggableUserProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(user.displayName || '')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: user.id })

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
    setEditedName(user.displayName || '')
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
    onDelete(user.id)
    setIsDropdownOpen(false)
  }

  const primaryName = user.displayName || user.first_name
  const secondaryText = user.displayName
    ? `${user.first_name}${user.username ? ' @' + user.username : ''}`
    : user.username
    ? `@${user.username}`
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${user.carriedOver ? 'bg-amber-950/20' : 'bg-slate-800'} border rounded-lg p-4
        ${isDragging ? 'opacity-50 border-blue-500 shadow-lg z-50' : user.carriedOver ? 'border-amber-700/50' : 'border-slate-700'}
        ${!isDragging ? user.carriedOver ? 'hover:border-amber-600/70 hover:bg-amber-950/30' : 'hover:border-slate-600 hover:bg-slate-750' : ''}
        transition-colors duration-200
      `}
      dir="rtl"
    >
      <div className="flex items-center gap-4">
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
              <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                {onUpdateDisplayName && (
                  <button
                    onClick={handleEdit}
                    className="w-full px-4 py-2 text-right text-white hover:bg-slate-700 transition-colors rounded-t-lg flex items-center gap-2 justify-end"
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
                <button
                  onClick={handleDeleteClick}
                  className="w-full px-4 py-2 text-right text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors rounded-b-lg flex items-center gap-2 justify-end"
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
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-300 transition-colors"
          aria-label="اسحب لإعادة الترتيب"
        >
          <svg
            className="w-5 h-5"
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
        <div className={`${user.carriedOver ? 'text-amber-400' : 'text-slate-400'} font-mono text-sm w-8`}>
          {index + 1}.
        </div>

        {/* User info */}
        <div className="flex-1">
          {isEditing ? (
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
                  onClick={handleSave}
                  className="text-green-500 hover:text-green-400 text-xs"
                >
                  حفظ
                </button>
                <button
                  onClick={handleCancel}
                  className="text-slate-400 hover:text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="text-white font-medium">{primaryName}</div>
                {user.carriedOver && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-700/50">
                    من الحلقة السابقة
                  </span>
                )}
              </div>
              {secondaryText && (
                <div className="text-slate-400 text-sm">{secondaryText}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
