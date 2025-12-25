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
  onSetCompensation?: (entryId: string, currentDates?: number[] | null) => void
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
  onEditNotes,
  onSetCompensation
}: UserListProps) {
  const [items, setItems] = useState(activeUsers)
  const [isReordering, setIsReordering] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReordering) {
      setItems(activeUsers)
    }
  }, [activeUsers, isReordering])

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

    const originalItems = [...items]
    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)
    setIsReordering(true)
    setError(null)

    const finalIndex = newItems.findIndex((user) => user.entryId === active.id)

    try {
      await onReorder(active.id as string, finalIndex + 1)
    } catch (error) {
      console.error('Failed to reorder user:', error)
      setItems(originalItems)
      setError('فشل تحديث الترتيب. الرجاء المحاولة مرة أخرى.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    const originalItems = [...items]
    setItems(items.filter((user) => user.entryId !== entryId))
    setIsDeleting(true)
    setError(null)

    try {
      await onDelete(entryId)
    } catch (error) {
      console.error('Failed to delete user:', error)
      setItems(originalItems)
      setError('فشل حذف المستخدم. الرجاء المحاولة مرة أخرى.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleComplete = async (sessionType: SessionType) => {
    if (items.length === 0) return

    const currentUser = items[0]
    if (!currentUser.entryId) return

    setIsProcessing(true)
    setError(null)

    try {
      await onComplete(currentUser.entryId, sessionType)
    } catch (error) {
      console.error('Failed to complete turn:', error)
      setError('فشل إتمام الدور. الرجاء المحاولة مرة أخرى.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkip = async () => {
    if (items.length < 2) return

    const currentUser = items[0]
    if (!currentUser.entryId) return

    setIsProcessing(true)
    setError(null)

    try {
      await onSkip(currentUser.entryId)
    } catch (error) {
      console.error('Failed to skip turn:', error)
      setError('فشل تخطي الدور. الرجاء المحاولة مرة أخرى.')
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
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMoveToTop = async (entryId: string) => {
    const userIndex = items.findIndex((user) => user.entryId === entryId)
    if (userIndex === -1 || userIndex === 0) return

    const originalItems = [...items]
    const newItems = [...items]
    const [movedUser] = newItems.splice(userIndex, 1)
    newItems.unshift(movedUser)

    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      await onReorder(entryId, 1)
    } catch (error) {
      console.error('Failed to move user to top:', error)
      setItems(originalItems)
      setError('فشل نقل المستخدم إلى أول القائمة. الرجاء المحاولة مرة أخرى.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const handleMoveToEnd = async (entryId: string) => {
    const userIndex = items.findIndex((user) => user.entryId === entryId)
    if (userIndex === -1 || userIndex === items.length - 1) return

    const originalItems = [...items]
    const newItems = [...items]
    const [movedUser] = newItems.splice(userIndex, 1)
    newItems.push(movedUser)

    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      await onReorder(entryId, items.length)
    } catch (error) {
      console.error('Failed to move user to end:', error)
      setItems(originalItems)
      setError('فشل نقل المستخدم إلى آخر القائمة. الرجاء المحاولة مرة أخرى.')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsReordering(false)
    }
  }

  const handleMoveToPosition = async (entryId: string, newPosition: number) => {
    const userIndex = items.findIndex((user) => user.entryId === entryId)
    if (userIndex === -1) return

    const currentPosition = userIndex + 1
    if (currentPosition === newPosition) return

    const originalItems = [...items]
    const newItems = [...items]
    const [movedUser] = newItems.splice(userIndex, 1)
    newItems.splice(newPosition - 1, 0, movedUser)

    setItems(newItems)
    setIsReordering(true)
    setError(null)

    try {
      await onReorder(entryId, newPosition)
    } catch (error) {
      console.error('Failed to move user to position:', error)
      setItems(originalItems)
      setError('فشل نقل المستخدم إلى الدور المحدد. الرجاء المحاولة مرة أخرى.')
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
          <p className="text-xl text-muted-foreground">لا يوجد مستخدمون في هذه القائمة</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-20" dir="rtl">
      {error && (
        <div className="m-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="p-4">
        <CompletedUsersSection
          users={completedUsers}
          onUpdateSessionType={handleUpdateSessionType}
          onUpdateDisplayName={handleUpdateDisplayName}
          onDelete={handleDelete}
          onAddTurnAfter3={onAddTurnAfter3}
        />

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
                    onMoveToTop={handleMoveToTop}
                    onMoveToEnd={handleMoveToEnd}
                    onMoveToPosition={handleMoveToPosition}
                    onEditNotes={onEditNotes}
                    onSetCompensation={onSetCompensation}
                    totalUsers={items.length}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center text-muted-foreground text-sm py-8">
            جميع المستخدمين أنهوا أدوارهم
          </div>
        )}

        {(isReordering || isDeleting || isProcessing) && (
          <div className="mt-4 text-center text-muted-foreground text-sm">
            {isReordering && 'جاري تحديث الترتيب...'}
            {isDeleting && 'جاري حذف المستخدم...'}
            {isProcessing && !isReordering && !isDeleting && 'جاري المعالجة...'}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <TurnControls
          onComplete={handleComplete}
          onSkip={handleSkip}
          canSkip={items.length >= 2}
          disabled={isProcessing}
          defaultSessionType={
            (items[0]?.isCompensation && items[0]?.compensatingForDates && items[0]?.compensatingForDates.length > 0)
              ? 'تعويض'
              : (items[0]?.sessionType as SessionType) || null
          }
        />
      )}
    </div>
  )
}
