import React from 'react'
import { Link, useParams } from 'wouter'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import type { User } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import { AddUserModal } from '~/components/AddUserModal'
import type { SessionType } from '~/components/SplitButton'
import toast from 'react-hot-toast'

function formatUserList(users: User[], isDone: boolean = false): string {
  return users
    .map((user, index) => {
      // Display realName if available, otherwise use telegramName
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

function formatRealNames(activeUsers: User[], completedUsers: User[]): string {
  const allUsers = [...completedUsers, ...activeUsers]
  return allUsers
    .map((user, index) => {
      const arabicNumber = (index + 1).toLocaleString('ar-EG')
      const name = user.realName || user.telegramName
      const isDone = completedUsers.some(cu => cu.id === user.id)
      const doneIcon = isDone ? ' ✅' : ''
      return `${arabicNumber}. ${name}${doneIcon}`
    })
    .join('\n')
}

export default function PostDetail() {
  const params = useParams<{ chatId: string; postId: string }>()
  const chatId = Number(params.chatId)
  const postId = Number(params.postId)

  const [selectedSession, setSelectedSession] = React.useState<number | undefined>(undefined)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = React.useState(false)
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = React.useState(false)
  const actionsDropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const data = useQuery(api.queries.getUserList, { chatId, postId, sessionNumber: selectedSession })
  const availableSessions = useQuery(api.queries.getAvailableSessions, { chatId, postId })
  const postDetails = useQuery(api.queries.getPostDetails, { chatId, postId })
  const sessionInfo = useQuery(
    api.queries.getSessionInfo,
    data?.currentSession ? { chatId, postId, sessionNumber: data.currentSession } : 'skip'
  )
  const updatePosition = useMutation(api.mutations.updateUserPosition)
  const removeUser = useMutation(api.mutations.removeUserFromList)
  const completeUserTurn = useMutation(api.mutations.completeUserTurn)
  const skipUserTurn = useMutation(api.mutations.skipUserTurn)
  const updateSessionType = useMutation(api.mutations.updateSessionType)
  const updateUserRealName = useMutation(api.mutations.updateUserRealName)
  const startNewSession = useMutation(api.mutations.startNewSession)
  const addUserAtPosition = useMutation(api.mutations.addUserAtPosition)
  const addUserToList = useMutation(api.mutations.addUserToList)

  const handleReorder = async (entryId: string, newPosition: number) => {
    await updatePosition({
      entryId,
      newPosition,
    })
  }

  const handleDelete = async (entryId: string) => {
    await removeUser({
      entryId,
    })
  }

  const handleComplete = async (entryId: string, sessionType: SessionType) => {
    await completeUserTurn({
      entryId,
      sessionType,
    })
  }

  const handleSkip = async (entryId: string) => {
    await skipUserTurn({
      entryId,
    })
  }

  const handleUpdateSessionType = async (entryId: string, sessionType: SessionType) => {
    await updateSessionType({
      entryId,
      sessionType,
    })
  }

  const handleUpdateDisplayName = async (userId: number, realName: string) => {
    await updateUserRealName({
      userId,
      realName,
    })
  }

  const handleAddTurnAfter3 = async (userId: number, currentPosition: number | undefined) => {
    try {
      console.log('Adding turn after 3:', { userId, currentPosition, turnsToWait: 3, sessionNumber: data?.currentSession })
      await addUserAtPosition({
        chatId,
        postId,
        userId,
        currentPosition, // undefined for completed users, position number for active users
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

    // Format the date
    const date = new Date(postDetails.createdAt)
    const formattedDate = date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Build the header
    let fullMessage = `${formattedDate}\n`
    if (sessionInfo?.teacherName) {
      fullMessage += `${sessionInfo.teacherName}\n`
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

    // Format the date
    const date = new Date(postDetails.createdAt)
    const formattedDate = date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Build the header
    let fullMessage = `${formattedDate}\n`
    if (sessionInfo?.teacherName) {
      fullMessage += `${sessionInfo.teacherName}\n`
    }
    fullMessage += '\n'

    // Add the names list
    fullMessage += formatRealNames(data.activeUsers, data.completedUsers)

    try {
      await navigator.clipboard.writeText(fullMessage)
      toast.success('تم نسخ الأسماء الحقيقية!')
    } catch (error) {
      toast.error('فشل النسخ')
      console.error('Copy failed:', error)
    }
  }

  const handleStartNewSession = async () => {
    if (!data) return

    // Prompt for teacher name
    const teacherName = window.prompt('أدخل اسم المعلم/المعلمة:')
    if (!teacherName || teacherName.trim() === '') {
      toast.error('يجب إدخال اسم المعلم')
      return
    }

    const incompleteCount = data.activeUsers.length

    // Ask user if they want to carry over incomplete users
    if (incompleteCount > 0) {
      const confirmed = window.confirm(
        `يوجد ${incompleteCount.toLocaleString('ar-EG')} ${incompleteCount === 1 ? 'مشترك لم ينته' : 'مشتركين لم ينتهوا'} في الجلسة الحالية.\n\nهل تريد نقلهم إلى الجلسة الجديدة؟`
      )

      try {
        const result = await startNewSession({
          chatId,
          postId,
          teacherName: teacherName.trim(),
          carryOverIncomplete: confirmed
        })
        setSelectedSession(result.newSessionNumber)

        if (confirmed) {
          toast.success(`تم بدء الجلسة رقم ${result.newSessionNumber.toLocaleString('ar-EG')} ونقل ${incompleteCount.toLocaleString('ar-EG')} ${incompleteCount === 1 ? 'مشترك' : 'مشتركين'}!`)
        } else {
          toast.success(`تم بدء الجلسة رقم ${result.newSessionNumber.toLocaleString('ar-EG')}!`)
        }
      } catch (error) {
        toast.error('فشل بدء الجلسة الجديدة')
        console.error('Start new session failed:', error)
      }
    } else {
      // No incomplete users, just start new session
      try {
        const result = await startNewSession({
          chatId,
          postId,
          teacherName: teacherName.trim(),
          carryOverIncomplete: false
        })
        setSelectedSession(result.newSessionNumber)
        toast.success(`تم بدء الجلسة رقم ${result.newSessionNumber.toLocaleString('ar-EG')}!`)
      } catch (error) {
        toast.error('فشل بدء الجلسة الجديدة')
        console.error('Start new session failed:', error)
      }
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  const totalUsers = data.activeUsers.length + data.completedUsers.length

  return (
    <div className="p-3 sm:p-6 md:p-8 h-full flex flex-col">
      <div className="mb-3 sm:mb-4 md:mb-6">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 sm:mb-3 md:mb-4">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="text-sm sm:text-base">العودة للمنشورات</span>
          </a>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {postDetails?.createdAt && (
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                {new Date(postDetails.createdAt).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h1>
            )}
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">معرف المنشور: {postId}</p>
            <p className="text-slate-400 text-xs sm:text-sm">معرف المحادثة: {chatId}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {availableSessions && availableSessions.length > 1 && (
              <select
                value={selectedSession ?? data.currentSession}
                onChange={(e) => setSelectedSession(Number(e.target.value))}
                className="bg-slate-700 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-xs sm:text-sm"
              >
                {availableSessions.map((session) => (
                  <option key={session.sessionNumber} value={session.sessionNumber}>
                    الجلسة {session.sessionNumber.toLocaleString('ar-EG')}
                    {session.teacherName && ` (${session.teacherName})`}
                  </option>
                ))}
              </select>
            )}
            <div className="relative" ref={actionsDropdownRef}>
              <button
                onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                className="bg-gray-600 hover:bg-gray-700 text-white p-2 sm:p-2.5 rounded-lg transition-colors flex items-center gap-1.5"
                title="إجراءات إضافية"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              
              {isActionsDropdownOpen && (
                <div className="fixed sm:absolute left-auto right-2 sm:left-0 sm:right-auto top-auto sm:top-full mt-1 w-48 sm:w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      handleStartNewSession()
                      setIsActionsDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-right text-white hover:bg-slate-700 transition-colors text-sm border-b border-slate-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    بدء جلسة جديدة
                  </button>
                  <button
                    onClick={() => {
                      setIsAddUserModalOpen(true)
                      setIsActionsDropdownOpen(false)
                    }}
                    className="w-full px-4 py-3 text-right text-white hover:bg-slate-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    إضافة مستخدم يدوياً
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleCopyList}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-2.5 rounded-lg transition-colors flex items-center gap-1.5"
              title="نسخ القائمة إلى الحافظة"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              onClick={handleCopyTelegramNames}
              className="bg-purple-600 hover:bg-purple-700 text-white p-2 sm:p-2.5 rounded-lg transition-colors flex items-center gap-1.5"
              title="نسخ الأسماء الحقيقية"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                />
              </svg>
            </button>
            <div className="text-right">
              <div className="text-xs sm:text-sm text-slate-400">إجمالي المستخدمين</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-white">{totalUsers}</div>
            </div>

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
          onComplete={handleComplete}
          onSkip={handleSkip}
          onUpdateSessionType={handleUpdateSessionType}
          onUpdateDisplayName={handleUpdateDisplayName}
          onAddTurnAfter3={handleAddTurnAfter3}
        />
      </div>

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onAdd={handleAddUser}
      />
    </div>
  )
}
