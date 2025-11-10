import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { User } from '@halakabot/db'

interface DraggableUserProps {
  user: User
  index: number
}

export function DraggableUser({ user, index }: DraggableUserProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-slate-800 border rounded-lg p-4 
        ${isDragging ? 'opacity-50 border-blue-500 shadow-lg z-50' : 'border-slate-700'}
        ${!isDragging ? 'hover:border-slate-600 hover:bg-slate-750' : ''}
        transition-colors duration-200
      `}
    >
      <div className="flex items-center gap-4">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-300 transition-colors"
          aria-label="Drag to reorder"
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
        <div className="text-slate-400 font-mono text-sm w-8">
          {index + 1}.
        </div>

        {/* User info */}
        <div className="flex-1">
          <div className="text-white font-medium">{user.first_name}</div>
          {user.username && (
            <div className="text-slate-400 text-sm">@{user.username}</div>
          )}
        </div>
      </div>
    </div>
  )
}
