import { Link, useParams } from 'wouter'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import type { SessionType } from '~/components/SplitButton'

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
          <div className="text-right">
            <div className="text-sm text-slate-400">Total Users</div>
            <div className="text-2xl font-bold text-white">{totalUsers}</div>
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
