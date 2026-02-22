import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { X, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader } from '~/components/Loader'

interface PostMessagesViewProps {
  chatId: number
  postId: number
  postDate?: Date
  onClose: () => void
  registeredUserIds?: Set<number>
  onAddToQueue?: (userId: number, sessionType: string | undefined) => Promise<void>
  isLocked?: boolean
}

function getInitials(firstName: string, lastName?: string) {
  const first = firstName.charAt(0).toUpperCase()
  const last = lastName ? lastName.charAt(0).toUpperCase() : ''
  return first + last
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
]

function avatarColor(userId: number) {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length]
}

export function PostMessagesView({ chatId, postId, postDate, onClose, registeredUserIds, onAddToQueue, isLocked }: PostMessagesViewProps) {
  const messages = useQuery(api.queries.getMessagesForPost, { chatId, postId })
  const [loadingUsers, setLoadingUsers] = React.useState<Set<number>>(new Set())

  const handleRegister = async (userId: number, sessionType: string | undefined) => {
    if (!onAddToQueue || loadingUsers.has(userId)) return
    setLoadingUsers(prev => new Set(prev).add(userId))
    try {
      await onAddToQueue(userId, sessionType)
    } finally {
      setLoadingUsers(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  const comments = messages?.filter((m) => !m.isPost) ?? []
  const postMessage = messages?.find((m) => m.isPost)

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-semibold text-sm">رسائل المنشور</p>
            {postDate && (
              <p className="text-xs text-muted-foreground">{formatDate(postDate.getTime())}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {messages === undefined ? (
          <div className="flex justify-center pt-8">
            <Loader />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">لا توجد رسائل لهذا المنشور</p>
          </div>
        ) : (
          <>
            {/* Original channel post */}
            {postMessage && (
              <div className="mx-auto max-w-[90%] mb-4">
                <div className="bg-muted/60 border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs font-semibold text-primary">
                      {postMessage.firstName}
                      {postMessage.lastName ? ` ${postMessage.lastName}` : ''}
                    </span>
                    {postMessage.username && (
                      <span className="text-xs text-muted-foreground">@{postMessage.username}</span>
                    )}
                    <span className="mr-auto text-[10px] text-muted-foreground">{formatTime(postMessage.createdAt)}</span>
                  </div>
                  {postMessage.messageText ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{postMessage.messageText}</p>
                  ) : (
                    <p className="text-muted-foreground italic text-xs">منشور القناة (بدون نص)</p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">منشور القناة</p>
              </div>
            )}

            {/* Comment messages */}
            {comments.map((msg, index) => {
              const prev = comments[index - 1]
              const isSameUser = prev?.userId === msg.userId
              const senderName = `${msg.firstName}${msg.lastName ? ` ${msg.lastName}` : ''}`

              return (
                <div key={msg.messageId} className={`flex items-end gap-2 ${isSameUser ? 'mt-0.5' : 'mt-3'}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8">
                    {!isSameUser ? (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor(msg.userId)}`}
                      >
                        {getInitials(msg.firstName, msg.lastName)}
                      </div>
                    ) : (
                      <div className="w-8 h-8" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="flex-1 min-w-0">
                    {!isSameUser && (
                      <div className="flex items-center gap-1.5 mb-0.5 px-1">
                        <span className="text-xs font-semibold text-foreground truncate">{senderName}</span>
                        {msg.username && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">@{msg.username}</span>
                        )}
                        {onAddToQueue && !isLocked && (
                          registeredUserIds?.has(msg.userId) ? (
                            <span className="mr-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                              {senderName} ✔️
                            </span>
                          ) : loadingUsers.has(msg.userId) ? (
                            <span className="mr-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              ...
                            </span>
                          ) : (
                            <button
                              className="mr-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/50"
                              onClick={() => handleRegister(msg.userId, msg.classification?.activityType ?? undefined)}
                            >
                              + دور
                            </button>
                          )
                        )}
                      </div>
                    )}
                    <div className="flex items-end gap-1">
                      <div
                        className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[80%] break-words"
                      >
                        {msg.messageText ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.messageText}</p>
                        ) : (
                          <p className="text-muted-foreground italic text-xs">وسائط بدون نص</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 pb-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
                      {/* Classification */}
                      {msg.classification === null ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          لم تُصنَّف
                        </span>
                      ) : (
                        <>
                          {msg.classification.activityType ? (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                              msg.classification.activityType === 'تسميع'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {msg.classification.activityType}
                            </span>
                          ) : null}
                          {msg.classification.containsName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              ✓ اسم
                            </span>
                          )}
                        </>
                      )}

                      {/* User profile */}
                      {msg.user === null ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          غير مسجَّل
                        </span>
                      ) : msg.user.realName ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          msg.user.realNameVerified
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {msg.user.realNameVerified ? '✓ ' : '~ '}{msg.user.realName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          بدون اسم حقيقي
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Footer count */}
      {messages !== undefined && messages.length > 0 && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground text-center">
          {comments.length.toLocaleString('ar-EG')} رسالة
        </div>
      )}
    </div>
  )
}
