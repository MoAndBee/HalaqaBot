import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { MessageSquare } from 'lucide-react'
import { Loader } from '~/components/Loader'
import { useVirtualizer } from '@tanstack/react-virtual'

interface PostMessagesViewProps {
  chatId: number
  postId: number
  onAddToQueue?: (userId: number, sessionType: string | undefined, messageId: number | undefined) => Promise<void>
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

const AUTO_REACT_STORAGE_KEY = 'halaqa:auto-react'

export function PostMessagesView({ chatId, postId, onAddToQueue, isLocked }: PostMessagesViewProps) {
  const messages = useQuery(api.queries.getMessagesForPost, { chatId, postId })
  const [loadingUsers, setLoadingUsers] = React.useState<Set<number>>(new Set())
  const [autoReact, setAutoReact] = React.useState<boolean>(
    () => localStorage.getItem(AUTO_REACT_STORAGE_KEY) === 'true'
  )
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const handleAutoReactToggle = () => {
    setAutoReact(prev => {
      const next = !prev
      localStorage.setItem(AUTO_REACT_STORAGE_KEY, String(next))
      return next
    })
  }

  const comments = messages?.filter((m) => !m.isPost) ?? []
  const postMessage = messages?.find((m) => m.isPost)

  const virtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  // Scroll to bottom when messages first load
  React.useEffect(() => {
    if (messages !== undefined && comments.length > 0) {
      virtualizer.scrollToIndex(comments.length - 1, { align: 'end', behavior: 'auto' })
    }
  }, [messages !== undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegister = async (userId: number, sessionType: string | undefined, messageId: number) => {
    if (!onAddToQueue || loadingUsers.has(userId)) return
    setLoadingUsers(prev => new Set(prev).add(userId))
    try {
      await onAddToQueue(userId, sessionType, autoReact ? messageId : undefined)
    } finally {
      setLoadingUsers(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Sticky toggle bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b bg-background text-sm">
        <span className="text-muted-foreground">تفاعل بقلب (❤️) عند إضافة دور</span>
        <button
          dir="ltr"
          onClick={handleAutoReactToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            autoReact ? 'bg-rose-500' : 'bg-muted'
          }`}
          role="switch"
          aria-checked={autoReact}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              autoReact ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
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
            {/* Original channel post (not virtualized — always at top) */}
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

            {/* Virtualized comment messages */}
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const msg = comments[virtualItem.index]
                const prev = comments[virtualItem.index - 1]
                const isSameUser = prev?.userId === msg.userId
                const senderName = `${msg.firstName}${msg.lastName ? ` ${msg.lastName}` : ''}`

                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className={`flex items-start gap-2 pb-1 ${isSameUser ? 'mt-1' : 'mt-3'}`}
                  >
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

                    {/* Card */}
                    <div className="flex-1 min-w-0 bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                      {/* Header: name + actions + timestamp */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">{senderName}</span>
                        {msg.username && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">@{msg.username}</span>
                        )}
                        {onAddToQueue && !isLocked && (
                          loadingUsers.has(msg.userId) ? (
                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              ...
                            </span>
                          ) : (
                            <button
                              className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/50"
                              onClick={() => handleRegister(msg.userId, msg.classification?.activityType ?? undefined, msg.messageId)}
                            >
                              + دور
                            </button>
                          )
                        )}
                        <span className="mr-auto text-[10px] text-muted-foreground flex-shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Message text */}
                      {msg.messageText ? (
                        <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.messageText}</p>
                      ) : (
                        <p className="text-muted-foreground italic text-xs">وسائط بدون نص</p>
                      )}

                      {/* Metadata badges */}
                      <div className="flex flex-wrap items-center gap-1 mt-2">
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
            </div>
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
