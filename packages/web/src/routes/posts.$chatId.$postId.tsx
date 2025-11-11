import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from '~/components/Loader'
import { UserList } from '~/components/UserList'
import type { SessionType } from '~/components/SplitButton'

export const Route = createFileRoute('/posts/$chatId/$postId')({
  component: PostDetail,
})

function PostDetail() {
  const params = useParams({ from: '/posts/$chatId/$postId' })
  const chatId = Number(params.chatId)
  const postId = Number(params.postId)

  const userListData = useQuery(api.queries.getUserList, { chatId, postId })
  const updatePosition = useMutation(api.mutations.updateUserPosition)
  const removeUser = useMutation(api.mutations.removeUserFromList)
  const completeTurn = useMutation(api.mutations.completeUserTurn)
  const skipTurn = useMutation(api.mutations.skipUserTurn)
  const updateSessionType = useMutation(api.mutations.updateSessionType)
  const updateDisplayName = useMutation(api.mutations.updateUserDisplayName)

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
    await completeTurn({
      chatId,
      postId,
      userId,
      sessionType,
    })
  }

  const handleSkip = async (userId: number) => {
    await skipTurn({
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
    await updateDisplayName({
      chatId,
      postId,
      userId,
      displayName,
    })
  }

  if (userListData === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    )
  }

  const activeUsers = userListData.activeUsers ?? []
  const completedUsers = userListData.completedUsers ?? []
  const totalUsers = activeUsers.length + completedUsers.length

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Posts
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
          activeUsers={activeUsers}
          completedUsers={completedUsers}
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
