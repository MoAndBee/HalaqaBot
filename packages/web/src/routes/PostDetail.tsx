import { Link, useParams } from 'wouter'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import type { User } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import type { SessionType } from '~/components/SplitButton'
import toast from 'react-hot-toast'

function formatUserList(users: User[]): string {
  return users
    .map((user, index) => {
      const displayName = user.displayName || user.first_name
      const username = user.username ? `@${user.username}` : ''
      const arabicNumber = (index + 1).toLocaleString('ar-EG')
      const carriedOverLabel = user.carriedOver ? ' (من الحلقة السابقة)' : ''
      return `ـ ${arabicNumber}. ${displayName} ${username}${carriedOverLabel} ـ`
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
  const updateUserDisplayName = useMutation(api.mutations.updateUserDisplayName)

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

  const handleUpdateDisplayName = async (userId: number, displayName: string) => {
    await updateUserDisplayName({
      chatId,
      postId,
      userId,
      displayName,
    })
  }

  const handleCopyList = async () => {
    if (!data) return

    const formattedList = formatUserList(data.activeUsers)
    const fullMessage = `📋 القائمة:\n\n${formattedList}`

    try {
      await navigator.clipboard.writeText(fullMessage)
      toast.success('Copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy')
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
            Back to Posts
          </a>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Post {postId}</h1>
            <p className="text-slate-400 mt-1">Chat ID: {chatId}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopyList}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors flex items-center gap-2"
              title="Copy list to clipboard"
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
            <div className="text-right">
              <div className="text-sm text-slate-400">Total Users</div>
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
