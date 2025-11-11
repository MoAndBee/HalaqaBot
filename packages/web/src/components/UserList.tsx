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
import { TurnControls } from './TurnControls'
import { CompletedUsersSection } from './CompletedUsersSection'
import type { SessionType } from './SplitButton'

interface CompletedUser extends User {
  completedAt?: number
  sessionType?: string
  displayName?: string
  position: number
}

interface UserListProps {
  chatId: number
  postId: number
  activeUsers: (User & { displayName?: string })[]
  completedUsers: CompletedUser[]
  onReorder: (userId: number, newPosition: number) => Promise<void>
  onDelete: (userId: number) => Promise<void>
  onComplete: (userId: number, sessionType: SessionType) => Promise<void>
  onSkip: (userId: number) => Promise<void>
  onUpdateSessionType: (userId: number, sessionType: SessionType) => Promise<void>
  onUpdateDisplayName: (userId: number, displayName: string) => Promise<void>
}

export function UserList({
  chatId: _chatId,
  postId: _postId,
  activeUsers,
  completedUsers,
  onReorder,
  onDelete,
  onComplete,
  onSkip,
  onUpdateSessionType,
  onUpdateDisplayName
}: UserListProps) {
  const [items, setItems] = useState(activeUsers)
  const [isReordering, setIsReordering] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update items when activeUsers prop changes
  useEffect(() => {
    setItems(activeUsers)
  }, [activeUsers])

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

  const handleDelete = async (userId: number) => {
    // Store original items for potential rollback
    const originalItems = [...items]

    // Optimistically remove from local state
    setItems(items.filter((user) => user.id !== userId))
    setIsDeleting(true)
    setError(null)

    try {
      await onDelete(userId)
    } catch (error) {
      console.error('Failed to delete user:', error)
      // Revert on error
      setItems(originalItems)
      setError('Failed to delete user. Please try again.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleComplete = async (sessionType: SessionType) => {
    if (items.length === 0) return

    const currentUser = items[0] // First user in active list
    setIsProcessing(true)
    setError(null)

    try {
      await onComplete(currentUser.id, sessionType)
    } catch (error) {
      console.error('Failed to complete turn:', error)
      setError('Failed to complete turn. Please try again.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkip = async () => {
    if (items.length < 2) return

    const currentUser = items[0] // First user in active list
    setIsProcessing(true)
    setError(null)

    try {
      await onSkip(currentUser.id)
    } catch (error) {
      console.error('Failed to skip turn:', error)
      setError('Failed to skip turn. Please try again.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateSessionType = async (userId: number, sessionType: SessionType) => {
    setIsProcessing(true)
    setError(null)

    try {
      await onUpdateSessionType(userId, sessionType)
    } catch (error) {
      console.error('Failed to update session type:', error)
      setError('Failed to update session type. Please try again.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateDisplayName = async (userId: number, displayName: string) => {
    setIsProcessing(true)
    setError(null)

    try {
      await onUpdateDisplayName(userId, displayName)
    } catch (error) {
      console.error('Failed to update display name:', error)
      setError('Failed to update display name. Please try again.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const hasUsers = items.length > 0 || completedUsers.length > 0

  if (!hasUsers) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-xl text-slate-400">لا يوجد مستخدمون في هذه القائمة</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      {/* Turn Controls - Sticky at top */}
      {items.length > 0 && (
        <TurnControls
          onComplete={handleComplete}
          onSkip={handleSkip}
          canSkip={items.length >= 2}
          disabled={isProcessing}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Completed Users Section */}
      <div className="p-4">
        <CompletedUsersSection
          users={completedUsers}
          onUpdateSessionType={handleUpdateSessionType}
          onUpdateDisplayName={handleUpdateDisplayName}
        />

        {/* Active Users List */}
        {items.length > 0 ? (
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
                  <DraggableUser
                    key={user.id}
                    user={user}
                    index={index}
                    onDelete={handleDelete}
                    onUpdateDisplayName={handleUpdateDisplayName}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center text-slate-400 text-sm py-8">
            جميع المستخدمين أنهوا أدوارهم
          </div>
        )}

        {/* Loading states */}
        {(isReordering || isDeleting || isProcessing) && (
          <div className="mt-4 text-center text-slate-400 text-sm">
            {isReordering && 'جاري تحديث الترتيب...'}
            {isDeleting && 'جاري حذف المستخدم...'}
            {isProcessing && !isReordering && !isDeleting && 'جاري المعالجة...'}
          </div>
        )}
      </div>
    </div>
  )
}
