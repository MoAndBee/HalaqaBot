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
  activeUsers: (User & { displayName?: string; carriedOver?: boolean })[]
  completedUsers: CompletedUser[]
  onReorder: (entryId: string, newPosition: number) => Promise<void>
  onDelete: (entryId: string) => Promise<void>
  onComplete: (entryId: string, sessionType: SessionType) => Promise<void>
  onSkip: (entryId: string) => Promise<void>
  onUpdateSessionType: (entryId: string, sessionType: SessionType) => Promise<void>
  onUpdateDisplayName: (userId: number, displayName: string) => Promise<void>
  onAddTurnAfter3: (userId: number, currentPosition: number | undefined) => Promise<void>
  onEditNotes?: (entryId: string, currentNotes?: string | null) => void
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
  onUpdateDisplayName,
  onAddTurnAfter3,
  onEditNotes
}: UserListProps) {
  const [items, setItems] = useState(activeUsers)
  const [isReordering, setIsReordering] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update items when activeUsers prop changes
  useEffect(() => {
    if (!isReordering) {
      setItems(activeUsers)
    }
  }, [activeUsers, isReordering])

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

    const oldIndex = items.findIndex((user) => user.entryId === active.id)
    const newIndex = items.findIndex((user) => user.entryId === over.id)

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

    // Find the actual final position of the moved item after arrayMove
    const finalIndex = newItems.findIndex((user) => user.entryId === active.id)

    try {
      // Call the server function to persist the change
      // Position is 1-indexed in the database
      await onReorder(active.id as string, finalIndex + 1)
    } catch (error) {
      console.error('Failed to reorder user:', error)
      // Revert to original order on error
      setItems(originalItems)
      setError('فشل تحديث الترتيب. الرجاء المحاولة مرة أخرى.')
      
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    // Store original items for potential rollback
    const originalItems = [...items]

    // Optimistically remove from local state
    setItems(items.filter((user) => user.entryId !== entryId))
    setIsDeleting(true)
    setError(null)

    try {
      await onDelete(entryId)
    } catch (error) {
      console.error('Failed to delete user:', error)
      // Revert on error
      setItems(originalItems)
      setError('فشل حذف المستخدم. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleComplete = async (sessionType: SessionType) => {
    if (items.length === 0) return

    const currentUser = items[0] // First user in active list
    if (!currentUser.entryId) return

    setIsProcessing(true)
    setError(null)

    try {
      await onComplete(currentUser.entryId, sessionType)
    } catch (error) {
      console.error('Failed to complete turn:', error)
      setError('فشل إتمام الدور. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkip = async () => {
    if (items.length < 2) return

    const currentUser = items[0] // First user in active list
    if (!currentUser.entryId) return

    setIsProcessing(true)
    setError(null)

    try {
      await onSkip(currentUser.entryId)
    } catch (error) {
      console.error('Failed to skip turn:', error)
      setError('فشل تخطي الدور. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateSessionType = async (entryId: string, sessionType: SessionType) => {
    setIsProcessing(true)
    setError(null)

    try {
      await onUpdateSessionType(entryId, sessionType)
    } catch (error) {
      console.error('Failed to update session type:', error)
      setError('فشل تحديث نوع الجلسة. الرجاء المحاولة مرة أخرى.')

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
      setError('فشل تحديث اسم العرض. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMoveToEnd = async (entryId: string) => {
    const userIndex = items.findIndex((user) => user.entryId === entryId)

    if (userIndex === -1) {
      return
    }

    // If already at the end, do nothing
    if (userIndex === items.length - 1) {
      return
    }

    // Store original items for potential rollback
    const originalItems = [...items]

    // Optimistically move user to end in local state
    const newItems = [...items]
    const [movedUser] = newItems.splice(userIndex, 1)
    newItems.push(movedUser)

    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      // Call the server function to persist the change
      // Position is 1-indexed, and we want to move to the last position
      await onReorder(entryId, items.length)
    } catch (error) {
      console.error('Failed to move user to end:', error)
      // Revert to original order on error
      setItems(originalItems)
      setError('فشل نقل المستخدم إلى آخر القائمة. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const handleMoveToPosition = async (entryId: string, newPosition: number) => {
    const userIndex = items.findIndex((user) => user.entryId === entryId)

    if (userIndex === -1) {
      return
    }

    const currentPosition = userIndex + 1

    // If already at the target position, do nothing
    if (currentPosition === newPosition) {
      return
    }

    // Store original items for potential rollback
    const originalItems = [...items]

    // Optimistically move user to new position in local state
    const newItems = [...items]
    const [movedUser] = newItems.splice(userIndex, 1)
    newItems.splice(newPosition - 1, 0, movedUser)

    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      // Call the server function to persist the change
      // Position is 1-indexed
      await onReorder(entryId, newPosition)
    } catch (error) {
      console.error('Failed to move user to position:', error)
      // Revert to original order on error
      setItems(originalItems)
      setError('فشل نقل المستخدم إلى الدور المحدد. الرجاء المحاولة مرة أخرى.')

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const hasUsers = items.length > 0 || completedUsers.length > 0

  if (!hasUsers) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-slate-400">لا يوجد مستخدمون في هذه القائمة</p>
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
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Completed Users Section */}
      <div className="p-4">
        <CompletedUsersSection
          users={completedUsers}
          onUpdateSessionType={handleUpdateSessionType}
          onUpdateDisplayName={handleUpdateDisplayName}
          onDelete={handleDelete}
          onAddTurnAfter3={onAddTurnAfter3}
        />

        {/* Active Users List */}
        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((user) => user.entryId || user.id.toString())}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((user, index) => (
                  <DraggableUser
                    key={user.entryId || user.id}
                    user={user}
                    index={index}
                    onDelete={handleDelete}
                    onUpdateDisplayName={handleUpdateDisplayName}
                    onUpdateSessionType={handleUpdateSessionType}
                    onAddTurnAfter3={onAddTurnAfter3}
                    onMoveToEnd={handleMoveToEnd}
                    onMoveToPosition={handleMoveToPosition}
                    onEditNotes={onEditNotes}
                    totalUsers={items.length}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center text-gray-600 dark:text-slate-400 text-sm py-8">
            جميع المستخدمين أنهوا أدوارهم
          </div>
        )}

        {/* Loading states */}
        {(isReordering || isDeleting || isProcessing) && (
          <div className="mt-4 text-center text-gray-600 dark:text-slate-400 text-sm">
            {isReordering && 'جاري تحديث الترتيب...'}
            {isDeleting && 'جاري حذف المستخدم...'}
            {isProcessing && !isReordering && !isDeleting && 'جاري المعالجة...'}
          </div>
        )}
      </div>
    </div>
  )
}
