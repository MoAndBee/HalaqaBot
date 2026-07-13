import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { useTelegramAuth, type TelegramUser } from '../hooks/useTelegramAuth'

export interface Channel {
  channelId: number
  chatId: number
  title?: string | null
}

interface TelegramAuthContextValue {
  // Telegram user
  user: TelegramUser | null
  webApp: ReturnType<typeof useTelegramAuth>['webApp']

  // Loading / error for the Telegram user extraction
  isLoading: boolean
  error: string | null

  // Channels this user administers (undefined while the query is in flight)
  channels: Channel[] | undefined
  isLoadingChannels: boolean

  // The currently selected channel (null until one is chosen/auto-selected)
  selectedChannel: Channel | null
  selectChannel: (channel: Channel) => void
}

const TelegramAuthContext = createContext<TelegramAuthContextValue | null>(null)

const STORAGE_KEY = 'halaqabot.selectedChannelId'

interface TelegramAuthProviderProps {
  children: ReactNode
}

export function TelegramAuthProvider({ children }: TelegramAuthProviderProps) {
  const { user, isLoading, error, webApp } = useTelegramAuth()

  // Fetch the channels this user is an admin of.
  const channels = useQuery(
    api.queries.getMyChannels,
    user ? { userId: user.id } : 'skip'
  ) as Channel[] | undefined

  const [manualSelection, setManualSelection] = useState<Channel | null>(null)

  const selectChannel = (channel: Channel) => {
    setManualSelection(channel)
    try {
      sessionStorage.setItem(STORAGE_KEY, String(channel.channelId))
    } catch {
      // sessionStorage may be unavailable; selection still works for this session.
    }
  }

  // Resolve the effective selection: explicit choice first, then a persisted one,
  // then auto-select when the user administers exactly one channel.
  let selectedChannel: Channel | null = manualSelection
  if (!selectedChannel && channels) {
    const storedId = readStoredChannelId()
    if (storedId !== null) {
      selectedChannel = channels.find((c) => c.channelId === storedId) ?? null
    }
    if (!selectedChannel && channels.length === 1) {
      selectedChannel = channels[0]
    }
  }

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        webApp,
        isLoading,
        error,
        channels,
        isLoadingChannels: user !== null && channels === undefined,
        selectedChannel,
        selectChannel,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  )
}

function readStoredChannelId(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function useTelegramAuthContext(): TelegramAuthContextValue {
  const context = useContext(TelegramAuthContext)

  if (!context) {
    throw new Error('useTelegramAuthContext must be used within TelegramAuthProvider')
  }

  return context
}

/**
 * Convenience hook for the currently selected channel's ids. Throws if used
 * outside an authorized context where a channel has been selected.
 */
export function useSelectedChannel(): Channel {
  const { selectedChannel } = useTelegramAuthContext()
  if (!selectedChannel) {
    throw new Error('useSelectedChannel used before a channel was selected')
  }
  return selectedChannel
}
