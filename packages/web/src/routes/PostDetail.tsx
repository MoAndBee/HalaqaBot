import { Link, useParams } from 'wouter'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import type { User } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
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

function formatTelegramNames(users: User[], isDone: boolean = false): string {
  return users
    .map((user, index) => {
      const arabicNumber = (index + 1).toLocaleString('ar-EG')
      const doneIcon = isDone ? '✅ ' : ''
      return `${arabicNumber}. ${doneIcon}${user.telegramName}`
    })
    .join('\n')
}

export default function PostDetail() {
  const params = useParams<{ chatId: string; postId: string }>()
  const chatId = Number(params.chatId)
  const postId = Number(params.postId)

  const data = useQuery(api.queries.getUserList, { chatId, postId })
  const updatePosition = useMutation(api.mutations.updateUserPosition)
  const removeUser = useMutation(api.mutations.removeUserFromList)
  const completeUserTurn = useMutation(api.mutations.completeUserTurn)
  const skipUserTurn = useMutation(api.mutations.skipUserTurn)
  const updateSessionType = useMutation(api.mutations.updateSessionType)
  const updateUserRealName = useMutation(api.mutations.updateUserRealName)

  const handleReorder = async (userId: number, newPosition: number) => {
    await updatePosition({
      chatId,
      postId,
      userId,
      newPosition,
    })
  }

  const handleDelete = async (userId: number) => {
    await removeUser({
      chatId,
      postId,
      userId,
    })
  }

  const handleComplete = async (userId: number, sessionType: SessionType) => {
    await completeUserTurn({
      chatId,
      postId,
      userId,
      sessionType,
    })
  }

  const handleSkip = async (userId: number) => {
    await skipUserTurn({
      chatId,
      postId,
      userId,
    })
  }

  const handleUpdateSessionType = async (userId: number, sessionType: SessionType) => {
    await updateSessionType({
      chatId,
      postId,
      userId,
      sessionType,
    })
  }

  const handleUpdateDisplayName = async (userId: number, realName: string) => {
    await updateUserRealName({
      userId,
      realName,
    })
  }

  const handleCopyList = async () => {
    if (!data) return

    const activeList = formatUserList(data.activeUsers, false)
    const completedList = formatUserList(data.completedUsers, true)

    let fullMessage = ''
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
    if (!data) return

    const activeList = formatTelegramNames(data.activeUsers, false)
    const completedList = formatTelegramNames(data.completedUsers, true)

    let fullMessage = ''
    if (activeList) {
      fullMessage += `لم ينتهوا بعد:\n\n${activeList}`
    }
    if (completedList) {
      fullMessage += `\n\nالمنتهون:\n\n${completedList}`
    }

    try {
      await navigator.clipboard.writeText(fullMessage)
      toast.success('تم نسخ الأسماء!')
    } catch (error) {
      toast.error('فشل النسخ')
      console.error('Copy failed:', error)
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
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            العودة للمنشورات
          </a>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">المنشور {postId}</h1>
            <p className="text-slate-400 mt-1">معرف المحادثة: {chatId}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopyList}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors flex items-center gap-2"
              title="نسخ القائمة إلى الحافظة"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              onClick={handleCopyTelegramNames}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition-colors flex items-center gap-2"
              title="نسخ أسماء تليجرام"
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
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                />
              </svg>
            </button>
            <div className="text-right">
              <div className="text-sm text-slate-400">إجمالي المستخدمين</div>
              <div className="text-2xl font-bold text-white">{totalUsers}</div>
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
        />
      </div>
    </div>
  )
}
