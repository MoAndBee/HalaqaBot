import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { User } from '@halakabot/db'
import { DraggableUser } from './DraggableUser'

interface UserListProps {
  chatId: number
  postId: number
  users: User[]
  onReorder: (userId: number, newPosition: number) => Promise<void>
}

export function UserList({ chatId, postId, users, onReorder }: UserListProps) {
  const [items, setItems] = useState(users)
  const [isReordering, setIsReordering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update items when users prop changes
  useEffect(() => {
    setItems(users)
  }, [users])

  // Configure sensors for mouse and touch interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = items.findIndex((user) => user.id === active.id)
    const newIndex = items.findIndex((user) => user.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Store original items for potential rollback
    const originalItems = [...items]

    // Optimistically update local state for immediate feedback
    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      // Call the server function to persist the change
      // Position is 1-indexed in the database
      await onReorder(active.id as number, newIndex + 1)
    } catch (error) {
      console.error('Failed to reorder user:', error)
      // Revert to original order on error
      setItems(originalItems)
      setError('Failed to update order. Please try again.')
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-xl text-slate-400">No users in this list</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((user) => user.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((user, index) => (
              <DraggableUser key={user.id} user={user} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {isReordering && (
        <div className="mt-4 text-center text-slate-400 text-sm">
          Updating order...
        </div>
      )}
    </div>
  )
}
