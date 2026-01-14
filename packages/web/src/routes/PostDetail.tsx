import React from 'react'
import { Link, useParams } from 'wouter'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@halakabot/db'
import type { User } from '@halakabot/db'
import { toast } from 'sonner'
import { ArrowRight, MoreVertical, Plus, UserPlus, Pencil, Copy, AtSign, Send, Eye, UserCog, Lock, LockOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTelegramAuthContext } from '~/contexts/TelegramAuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import { AddUserModal } from '~/components/AddUserModal'
import { EditNotesModal } from '~/components/EditNotesModal'
import { CompensationModal } from '~/components/CompensationModal'
import { StartNewSessionModal } from '~/components/StartNewSessionModal'
import { UnlockSessionModal } from '~/components/UnlockSessionModal'
import type { SessionType } from '~/components/SplitButton'

function formatUserList(users: User[], isDone: boolean = false): string {
  return users
    .map((user, index) => {
      const displayName = user.realName || user.telegramName
      const username = user.username ? `@${user.username}` : ''
      const userId = `(${user.id})`
      const arabicNumber = (index + 1).toLocaleString('ar-EG')
      const carriedOverLabel = user.carriedOver ? ' (من الحلقة السابقة)' : ''
      const sessionTypeLabel = user.sessionType ? ` - ${user.sessionType}` : ''
      const doneIcon = isDone ? '✅ ' : ''
      return `ـ ${arabicNumber}. ${doneIcon}${displayName} ${username} ${userId}${carriedOverLabel}${sessionTypeLabel} ـ`
    })
    .join('\n')
}

function formatRealNames(activeUsers: User[], completedUsers: User[], flower: string = DEFAULT_FLOWER): string {
  const allUsers = [...completedUsers, ...activeUsers]
  return allUsers
    .map((user, index) => {
      const arabicNumber = (index + 1).toLocaleString('ar-EG')
      const name = user.realName || user.telegramName
      const isDone = completedUsers.some(cu => cu.id === user.id)
      const activityLabel = (user.sessionType === 'تلاوة' || user.sessionType === 'تسميع')
        ? ` (${user.sessionType})`
        : ''
      const skipLabel = !isDone && user.wasSkipped
        ? ` 🗣️`
        : ''
      const doneIcon = isDone ? ' ✅' : ''
      return `${arabicNumber}. ${name}${activityLabel}${skipLabel}${doneIcon}`
    })
    .join('\n')
}

const FLOWER_OPTIONS = ['🌸', '🌺', '🌼', '🌻', '❤️', '💛', '💜'] as const
const DEFAULT_FLOWER = '🌸'
const FLOWER_STORAGE_KEY = 'halaqa-selected-flower'

export default function PostDetail() {
  const params = useParams<{ chatId: string; postId: string }>()
  const chatId = Number(params.chatId)
  const postId = Number(params.postId)

  // Get current admin user from Telegram auth
  const { user: telegramUser } = useTelegramAuthContext()
  const CHANNEL_ID = -1002081068866 // TODO: Move to config/environment

  const [selectedSession, setSelectedSession] = React.useState<number | undefined>(undefined)
  const [selectedFlower, setSelectedFlower] = React.useState<string>(DEFAULT_FLOWER)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false)
  const [isEditNotesModalOpen, setIsEditNotesModalOpen] = React.useState(false)
  const [isStartNewSessionModalOpen, setIsStartNewSessionModalOpen] = React.useState(false)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = React.useState(false)
  const [notesModalState, setNotesModalState] = React.useState<{
    entryId: string
    currentNotes?: string | null
    userName: string
  } | null>(null)
  const [isCompensationModalOpen, setIsCompensationModalOpen] = React.useState(false)
  const [compensationModalState, setCompensationModalState] = React.useState<{
    entryId: string
    userName: string
    sessionType: SessionType
    currentDates?: number[] | null
  } | null>(null)

  // Load selected flower from localStorage on mount
  React.useEffect(() => {
    const savedFlower = localStorage.getItem(FLOWER_STORAGE_KEY)
    if (savedFlower && FLOWER_OPTIONS.includes(savedFlower as any)) {
      setSelectedFlower(savedFlower)
    }
  }, [])

  // Save selected flower to localStorage when it changes
  const handleFlowerChange = (flower: string) => {
    setSelectedFlower(flower)
    localStorage.setItem(FLOWER_STORAGE_KEY, flower)
  }

  const data = useQuery(api.queries.getUserList, { chatId, postId, sessionNumber: selectedSession })
  const availableSessions = useQuery(api.queries.getAvailableSessions, { chatId, postId })
  const postDetails = useQuery(api.queries.getPostDetails, { chatId, postId })
  const sessionInfo = useQuery(
    api.queries.getSessionInfo,
    data?.currentSession ? { chatId, postId, sessionNumber: data.currentSession } : 'skip'
  )
  // Fetch supervisor name for the current session
  const supervisorName = useQuery(
    api.queries.getSessionSupervisorName,
    data?.currentSession ? { chatId, postId, sessionNumber: data.currentSession, channelId: CHANNEL_ID } : 'skip'
  )
  // Fetch current admin's display name (for editing their preferred name)
  const currentAdminName = useQuery(
    api.queries.getAdminDisplayName,
    telegramUser ? { userId: telegramUser.id, channelId: CHANNEL_ID } : 'skip'
  )
  const updatePosition = useMutation(api.mutations.updateUserPosition)
  const removeUser = useMutation(api.mutations.removeUserFromList)
  const removeCompletedUser = useMutation(api.mutations.removeCompletedUser)
  const completeUserTurn = useMutation(api.mutations.completeUserTurn)
  const skipUserTurn = useMutation(api.mutations.skipUserTurn)
  const updateSessionType = useMutation(api.mutations.updateSessionType)
  const updateTurnQueueSessionType = useMutation(api.mutations.updateTurnQueueSessionType)
  const updateUserRealName = useMutation(api.mutations.updateUserRealName)
  const updateUserNotes = useMutation(api.mutations.updateUserNotes)
  const startNewSession = useMutation(api.mutations.startNewSession)
  const addUserAtPosition = useMutation(api.mutations.addUserAtPosition)
  const addUserToList = useMutation(api.mutations.addUserToList)
  const updateSessionTeacher = useMutation(api.mutations.updateSessionTeacher)
  const updateSessionSupervisor = useMutation(api.mutations.updateSessionSupervisor)
  const updateAdminPreferredName = useMutation(api.mutations.updateAdminPreferredName)
  const assignSessionSupervisor = useMutation(api.mutations.assignSessionSupervisor)
  const takeOverSession = useMutation(api.mutations.takeOverSession)
  const setTurnQueueCompensation = useMutation(api.mutations.setTurnQueueCompensation)
  const updateParticipationCompensation = useMutation(api.mutations.updateParticipationCompensation)
  const lockSession = useMutation(api.mutations.lockSession)
  const unlockSession = useMutation(api.mutations.unlockSession)
  const sendParticipantList = useAction(api.actions.sendParticipantList)

  // Auto-assign supervisor on first page load if no supervisor is assigned (Option A)
  React.useEffect(() => {
    const autoAssign = async () => {
      if (telegramUser && data?.currentSession && supervisorName === null) {
        try {
          await assignSessionSupervisor({
            chatId,
            postId,
            sessionNumber: data.currentSession,
            supervisorUserId: telegramUser.id,
          })
          console.log(`Auto-assigned supervisor ${telegramUser.id} to session ${data.currentSession}`)
          toast.success('تم تعيينك كمشرفة لهذه الحلقة')
        } catch (error) {
          console.error('Failed to auto-assign supervisor:', error)
          // Don't show error toast for already assigned case
          if (error instanceof Error && !error.message.includes('already has supervisor')) {
            toast.error('فشل التعيين التلقائي كمشرفة')
          }
        }
      }
    }
    autoAssign()
  }, [telegramUser, data?.currentSession, supervisorName, assignSessionSupervisor, chatId, postId])

  const handleReorder = async (entryId: string, newPosition: number) => {
    await updatePosition({ entryId, newPosition })
  }

  const handleDelete = async (entryId: string) => {
    await removeUser({ entryId })
  }

  const handleDeleteCompleted = async (entryId: string) => {
    await removeCompletedUser({ entryId })
  }

  const handleComplete = async (entryId: string, sessionType: SessionType) => {
    const user = data?.activeUsers.find((u: User) => u.entryId === entryId)
    if (!user) return

    // If user has compensation dates set, always use 'تعويض' as session type
    const finalSessionType = (user.isCompensation && user.compensatingForDates && user.compensatingForDates.length > 0)
      ? 'تعويض'
      : sessionType

    // If sessionType is compensation and dates are NOT set, open modal to select dates
    if (finalSessionType === 'تعويض' && (!user.compensatingForDates || user.compensatingForDates.length === 0)) {
      setCompensationModalState({
        entryId,
        userName: user.realName || user.telegramName,
        sessionType: finalSessionType,
        currentDates: user.compensatingForDates || null,
      })
      setIsCompensationModalOpen(true)
      return
    }

    // Complete the turn (with or without compensation)
    await completeUserTurn({
      entryId,
      sessionType: finalSessionType,
      isCompensation: finalSessionType === 'تعويض',
      compensatingForDates: finalSessionType === 'تعويض' ? user.compensatingForDates : undefined,
    })
  }

  const handleSkip = async (entryId: string) => {
    await skipUserTurn({ entryId })
  }

  const handleUpdateSessionType = async (entryId: string, sessionType: SessionType) => {
    // Find if this is an active user or completed user
    const activeUser = data?.activeUsers.find((u: User) => u.entryId === entryId)
    const completedUser = data?.completedUsers.find((u: User) => u.entryId === entryId)
    const user = activeUser || completedUser
    if (!user) return

    // If changing TO تعويض, open compensation modal to select dates
    if (sessionType === 'تعويض') {
      setCompensationModalState({
        entryId,
        userName: user.realName || user.telegramName,
        sessionType: null as any, // null indicates this is not a completion flow
        currentDates: user.compensatingForDates || null,
      })
      setIsCompensationModalOpen(true)
      return
    }

    // For other session types, update directly
    try {
      if (activeUser) {
        // Use turnQueue mutation for active users
        await updateTurnQueueSessionType({ entryId, sessionType })
      } else {
        // Use participationHistory mutation for completed users
        await updateSessionType({ entryId, sessionType })
      }
    } catch (error) {
      console.error('Error updating session type:', error)
      toast.error('فشل تحديث نوع الجلسة')
    }
  }

  const handleUpdateDisplayName = async (userId: number, realName: string) => {
    await updateUserRealName({ userId, realName })
  }

  const handleOpenEditNotes = (entryId: string, currentNotes?: string | null) => {
    const user = [...data.activeUsers, ...data.completedUsers].find(u => u.entryId === entryId)
    if (!user) return

    setNotesModalState({
      entryId,
      currentNotes,
      userName: user.realName || user.telegramName,
    })
    setIsEditNotesModalOpen(true)
  }

  const handleSaveNotes = async (notes: string) => {
    if (!notesModalState) return

    try {
      await updateUserNotes({
        entryId: notesModalState.entryId,
        notes,
      })
      toast.success('تم حفظ الملاحظات!')
    } catch (error) {
      console.error('Failed to save notes:', error)
      toast.error('فشل حفظ الملاحظات')
      throw error
    }
  }

  const handleSaveCompensation = async (dates: number[]) => {
    if (!compensationModalState) return

    try {
      // Determine if this is an active user or completed user
      const activeUser = data?.activeUsers.find((u: User) => u.entryId === compensationModalState.entryId)
      const completedUser = data?.completedUsers.find((u: User) => u.entryId === compensationModalState.entryId)

      // If sessionType is defined and it's from handleComplete, this is a completion flow
      if (compensationModalState.sessionType && activeUser) {
        // Complete the turn with compensation dates
        await completeUserTurn({
          entryId: compensationModalState.entryId,
          sessionType: compensationModalState.sessionType,
          isCompensation: true,
          compensatingForDates: dates,
        })
        toast.success('تم إتمام الدور بنجاح!')
        setIsCompensationModalOpen(false)
        setCompensationModalState(null)
      } else if (activeUser) {
        // This is setting compensation for an active user (from session type dropdown or setCompensation)
        await setTurnQueueCompensation({
          entryId: compensationModalState.entryId as any, // entryId is already a convex ID
          isCompensation: true,
          compensatingForDates: dates,
        })
        toast.success('تم تحديد تواريخ التعويض!')

        // Give Convex a moment to refetch the query before closing the modal
        setTimeout(() => {
          setIsCompensationModalOpen(false)
          setCompensationModalState(null)
        }, 100)
      } else if (completedUser) {
        // This is setting compensation for a completed user (from session type dropdown)
        await updateParticipationCompensation({
          entryId: compensationModalState.entryId as any, // entryId is already a convex ID
          isCompensation: true,
          compensatingForDates: dates,
        })
        toast.success('تم تحديد تواريخ التعويض!')

        // Give Convex a moment to refetch the query before closing the modal
        setTimeout(() => {
          setIsCompensationModalOpen(false)
          setCompensationModalState(null)
        }, 100)
      }
    } catch (error) {
      console.error('Failed to save compensation:', error)
      toast.error('فشل حفظ التعويض')
      throw error
    }
  }

  const handleSetCompensationDates = (entryId: string, currentDates?: number[] | null) => {
    const user = data?.activeUsers.find((u: User) => u.entryId === entryId)
    if (!user) return

    setCompensationModalState({
      entryId,
      userName: user.realName || user.telegramName,
      sessionType: null as any, // null indicates this is not a completion flow
      currentDates,
    })
    setIsCompensationModalOpen(true)
  }

  const handleAddTurnAfter3 = async (userId: number, currentPosition: number | undefined) => {
    try {
      await addUserAtPosition({
        chatId,
        postId,
        userId,
        currentPosition,
        turnsToWait: 3,
        sessionNumber: data?.currentSession,
      })
      toast.success('تم إضافة الدور!')
    } catch (error) {
      console.error('Failed to add turn:', error)
      toast.error('فشل إضافة الدور')
    }
  }

  const handleAddUser = async (userId: number) => {
    try {
      await addUserToList({
        chatId,
        postId,
        userId,
        sessionNumber: data?.currentSession,
      })
      toast.success('تم إضافة المستخدم!')
      setIsAddUserModalOpen(false)
    } catch (error) {
      toast.error('فشل إضافة المستخدم')
      console.error('Failed to add user:', error)
    }
  }

  const handleCopyList = async () => {
    if (!data || !postDetails) return

    const activeList = formatUserList(data.activeUsers, false)
    const completedList = formatUserList(data.completedUsers, true)

    const date = new Date(postDetails.createdAt)
    const formattedDate = date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    let fullMessage = `${formattedDate}\n`
    if (sessionInfo?.teacherName) {
      fullMessage += `المعلمة: ${sessionInfo.teacherName}\n`
    }
    fullMessage += '\n'

    if (activeList) {
      fullMessage += `📋 القائمة:\n\n${activeList}`
    }
    if (completedList) {
      fullMessage += `\n\n✅ المنتهون:\n\n${completedList}`
    }

    try {
      await navigator.clipboard.writeText(fullMessage)
      toast.success('تم النسخ إلى الحافظة!')
    } catch (error) {
      toast.error('فشل النسخ')
      console.error('Copy failed:', error)
    }
  }

  const handleCopyTelegramNames = async () => {
    if (!data || !postDetails) return

    const date = new Date(postDetails.createdAt)
    const formattedDate = date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Create flower border
    const flowerBorder = `ه${selectedFlower}`.repeat(7)

    let fullMessage = `${flowerBorder}\n`
    fullMessage += `${formattedDate}\n`
    if (sessionInfo?.teacherName) {
      fullMessage += `المعلمة: ${sessionInfo.teacherName}\n`
    }
    if (supervisorName) {
      fullMessage += `المشرفة: ${supervisorName}\n`
    }
    fullMessage += `ـــــــــــــــــــــــ\n`
    fullMessage += formatRealNames(data.activeUsers, data.completedUsers, selectedFlower)
    fullMessage += `\n${flowerBorder}`

    try {
      await navigator.clipboard.writeText(fullMessage)
      toast.success('تم نسخ الأسماء الحقيقية!')
    } catch (error) {
      toast.error('فشل النسخ')
      console.error('Copy failed:', error)
    }
  }

  const handleSendParticipantList = async () => {
    if (!data) return

    try {
      const currentSession = selectedSession ?? data.currentSession
      await sendParticipantList({
        chatId,
        postId,
        sessionNumber: currentSession,
        flower: selectedFlower,
      })
      toast.success('تم إرسال قائمة الأسماء!')
    } catch (error) {
      toast.error('فشل إرسال قائمة الأسماء')
      console.error('Send participant list failed:', error)
    }
  }

  const handleStartNewSession = () => {
    setIsStartNewSessionModalOpen(true)
  }

  const handleStartNewSessionSubmit = async (teacherName: string, supervisorName: string) => {
    if (!data || !telegramUser) return

    // Close modal first to dismiss keyboard
    setIsStartNewSessionModalOpen(false)

    // Wait for keyboard to dismiss
    await new Promise(resolve => setTimeout(resolve, 300))

    const incompleteCount = data.activeUsers.length

    if (incompleteCount > 0) {
      const confirmed = window.confirm(
        `يوجد ${incompleteCount.toLocaleString('ar-EG')} ${incompleteCount === 1 ? 'مشترك لم ينته' : 'مشتركين لم ينتهوا'} في الحلقة الحالية.\n\nهل تريد نقلهم إلى الحلقة الجديدة؟`
      )

      try {
        const result = await startNewSession({
          chatId,
          postId,
          teacherName,
          supervisorName, // kept for backward compatibility
          supervisorUserId: telegramUser.id, // assign current admin as supervisor
          carryOverIncomplete: confirmed
        })
        setSelectedSession(result.newSessionNumber)

        if (confirmed) {
          toast.success(`تم بدء الحلقة رقم ${result.newSessionNumber.toLocaleString('ar-EG')} ونقل ${incompleteCount.toLocaleString('ar-EG')} ${incompleteCount === 1 ? 'مشترك' : 'مشتركين'}!`)
        } else {
          toast.success(`تم بدء الحلقة رقم ${result.newSessionNumber.toLocaleString('ar-EG')}!`)
        }
      } catch (error) {
        toast.error('فشل بدء الحلقة الجديدة')
        console.error('Start new session failed:', error)
      }
    } else {
      try {
        const result = await startNewSession({
          chatId,
          postId,
          teacherName,
          supervisorName, // kept for backward compatibility
          supervisorUserId: telegramUser.id, // assign current admin as supervisor
          carryOverIncomplete: false
        })
        setSelectedSession(result.newSessionNumber)
        toast.success(`تم بدء الحلقة رقم ${result.newSessionNumber.toLocaleString('ar-EG')}!`)
      } catch (error) {
        toast.error('فشل بدء الحلقة الجديدة')
        console.error('Start new session failed:', error)
      }
    }
  }

  const handleEditTeacherName = async () => {
    if (!data) return

    const currentSession = selectedSession ?? data.currentSession
    const currentTeacherName = sessionInfo?.teacherName || ''

    const teacherName = window.prompt('أدخل اسم المعلم/المعلمة:', currentTeacherName)

    if (teacherName === null) return

    if (teacherName.trim() === '') {
      toast.error('يجب إدخال اسم المعلمة')
      return
    }

    try {
      await updateSessionTeacher({
        chatId,
        postId,
        sessionNumber: currentSession,
        teacherName: teacherName.trim(),
      })
      toast.success('تم تحديث اسم المعلمة!')
    } catch (error) {
      toast.error('فشل تحديث اسم المعلمة')
      console.error('Update teacher name failed:', error)
    }
  }

  const handleEditSupervisorName = async () => {
    if (!telegramUser) return

    // Use current admin's name as default
    const currentName = currentAdminName || ''

    const newName = window.prompt('تعديل الاسم المفضل (سيظهر في جميع الحلقات):', currentName)

    if (newName === null) return

    if (newName.trim() === '') {
      toast.error('يجب إدخال الاسم المفضل')
      return
    }

    try {
      // Save to channelAdmins table as preferredName (affects all sessions)
      await updateAdminPreferredName({
        channelId: CHANNEL_ID,
        userId: telegramUser.id,
        preferredName: newName.trim(),
      })

      toast.success('تم تحديث الاسم المفضل!')
    } catch (error) {
      toast.error('فشل تحديث الاسم المفضل')
      console.error('Update preferred name failed:', error)
    }
  }

  const handleTakeOver = async () => {
    if (!data || !telegramUser) return

    const currentSession = selectedSession ?? data.currentSession

    const confirmed = window.confirm('هل تريد تسلّم هذه الحلقة؟ سيتم تغيير اسم المشرفة إلى اسمك.')

    if (!confirmed) return

    try {
      await takeOverSession({
        chatId,
        postId,
        sessionNumber: currentSession,
        newSupervisorUserId: telegramUser.id,
      })

      toast.success('تم تسلّم الحلقة بنجاح!')
    } catch (error) {
      toast.error('فشل تسلّم الحلقة')
      console.error('Take over session failed:', error)
    }
  }

  const handleLockSession = async () => {
    if (!data) return

    const currentSession = selectedSession ?? data.currentSession

    // Ask for confirmation before locking
    const confirmed = window.confirm(
      `هل أنت متأكد من إغلاق الحلقة رقم ${currentSession.toLocaleString('ar-EG')}؟\n\n` +
      'بعد الإغلاق، لن تتمكن من تعديل أي بيانات في هذه الحلقة إلا بعد فتحها بكلمة المرور.'
    )

    if (!confirmed) return

    try {
      await lockSession({
        chatId,
        postId,
        sessionNumber: currentSession,
        lockedBy: 'manual',
      })
      toast.success('تم إغلاق الحلقة بنجاح!')
    } catch (error: any) {
      toast.error(error?.message || 'فشل إغلاق الحلقة')
      console.error('Lock session failed:', error)
    }
  }

  const handleUnlockSession = async (passcode: string) => {
    if (!data) return

    const currentSession = selectedSession ?? data.currentSession

    try {
      await unlockSession({
        chatId,
        postId,
        sessionNumber: currentSession,
        passcode,
      })
      toast.success('تم فتح الحلقة بنجاح!')
    } catch (error: any) {
      toast.error(error?.message || 'كلمة مرور خاطئة')
      throw error
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  // Count unique users (some users may have multiple participation types)
  const uniqueUserIds = new Set([
    ...data.activeUsers.map(u => u.id),
    ...data.completedUsers.map(u => u.id)
  ])
  const totalUsers = uniqueUserIds.size

  return (
    <div className="p-3 sm:p-6 md:p-8 h-full flex flex-col">
      <div className="mb-3 sm:mb-4 md:mb-6">
        <Link href="/halaqas">
          <Button variant="ghost" size="sm" className="mb-2 sm:mb-3 md:mb-4 gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>العودة للحلقات</span>
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            {postDetails?.createdAt && (
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground">
                {new Date(postDetails.createdAt).toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h1>
            )}
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">معرف المنشور: {postId}</p>
            <p className="text-muted-foreground text-xs sm:text-sm">معرف المحادثة: {chatId}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {availableSessions && availableSessions.length >= 1 && (
                <Select
                  value={(selectedSession ?? data.currentSession).toString()}
                  onValueChange={(val) => setSelectedSession(Number(val))}
                >
                  <SelectTrigger className="w-auto min-w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSessions.map((session: { sessionNumber: number; teacherName?: string | null; supervisorName?: string | null }) => (
                      <SelectItem key={session.sessionNumber} value={session.sessionNumber.toString()}>
                        الحلقة {session.sessionNumber.toLocaleString('ar-EG')}
                        {session.teacherName && ` (${session.teacherName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={handleStartNewSession}>
                  <Plus className="h-4 w-4 ml-2" />
                  بدء حلقة جديدة
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleEditTeacherName}
                  disabled={sessionInfo?.isLocked}
                >
                  <Pencil className="h-4 w-4 ml-2" />
                  تعديل اسم المعلمة
                </DropdownMenuItem>
                {sessionInfo?.isLocked ? (
                  <DropdownMenuItem onClick={() => setIsUnlockModalOpen(true)}>
                    <LockOpen className="h-4 w-4 ml-2" />
                    فتح الحلقة
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleLockSession}>
                    <Lock className="h-4 w-4 ml-2" />
                    إنهاء الحلقة
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsAddUserModalOpen(true)}
                  disabled={sessionInfo?.isLocked}
                >
                  <UserPlus className="h-4 w-4 ml-2" />
                  إضافة مستخدم يدوياً
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyList}>
                  <Copy className="h-4 w-4 ml-2" />
                  نسخ القائمة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyTelegramNames}>
                  <AtSign className="h-4 w-4 ml-2" />
                  نسخ الأسماء الحقيقية
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSendParticipantList}>
                  <Send className="h-4 w-4 ml-2" />
                  إرسال قائمة الأسماء
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <span className="ml-2">{selectedFlower}</span>
                    اختيار الزينة
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {FLOWER_OPTIONS.map((flower) => (
                      <DropdownMenuItem
                        key={flower}
                        onClick={() => handleFlowerChange(flower)}
                      >
                        <span className="ml-2">{flower}</span>
                        {flower === selectedFlower && '✓'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="text-right flex items-center gap-2">
              <div>
                <div className="text-xs sm:text-sm text-muted-foreground">حضور</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">{totalUsers}</div>
              </div>
              <Link href={`/posts/${chatId}/${postId}/summary`}>
                <Button variant="ghost" size="icon" title="عرض ملخص المشاركة">
                  <Eye className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground" dir="rtl">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEditSupervisorName}>
                    <Pencil className="h-4 w-4 ml-2" />
                    تعديل الاسم المفضل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleTakeOver}>
                    <UserCog className="h-4 w-4 ml-2" />
                    تسلم الحلقة
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="flex-1">
                اسم المشرفة: {supervisorName || 'لم يتم تعيين مشرفة'}
              </span>
            </div>
            {sessionInfo?.isLocked && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-amber-600 dark:text-amber-400 text-right">
                <Lock className="h-3.5 w-3.5" />
                <span>الحلقة مغلقة</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <UserList
          chatId={chatId}
          postId={postId}
          activeUsers={data.activeUsers}
          completedUsers={data.completedUsers}
          onReorder={handleReorder}
          onDelete={handleDelete}
          onDeleteCompleted={handleDeleteCompleted}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onUpdateSessionType={handleUpdateSessionType}
          onUpdateDisplayName={handleUpdateDisplayName}
          onAddTurnAfter3={handleAddTurnAfter3}
          onEditNotes={handleOpenEditNotes}
          onSetCompensation={handleSetCompensationDates}
          isLocked={sessionInfo?.isLocked || false}
        />
      </div>

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onAdd={handleAddUser}
      />

      <EditNotesModal
        isOpen={isEditNotesModalOpen}
        onClose={() => setIsEditNotesModalOpen(false)}
        onSave={handleSaveNotes}
        currentNotes={notesModalState?.currentNotes}
        userName={notesModalState?.userName || ''}
      />

      <CompensationModal
        isOpen={isCompensationModalOpen}
        onClose={() => {
          setIsCompensationModalOpen(false)
          setCompensationModalState(null)
        }}
        onSave={handleSaveCompensation}
        currentDates={compensationModalState?.currentDates}
        userName={compensationModalState?.userName || ''}
      />

      <StartNewSessionModal
        isOpen={isStartNewSessionModalOpen}
        onClose={() => setIsStartNewSessionModalOpen(false)}
        onStart={handleStartNewSessionSubmit}
      />

      <UnlockSessionModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onUnlock={handleUnlockSession}
        sessionNumber={selectedSession ?? data.currentSession}
      />
    </div>
  )
}
