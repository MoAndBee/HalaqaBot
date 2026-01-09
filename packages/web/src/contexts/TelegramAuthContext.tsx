import { createContext, useContext, type ReactNode } from 'react'
import { useTelegramAuth, type AuthState } from '../hooks/useTelegramAuth'

const TelegramAuthContext = createContext<AuthState | null>(null)

// Channel ID - should match the channelId configured in the bot
const CHANNEL_ID = -1002081068866

interface TelegramAuthProviderProps {
  children: ReactNode
}

export function TelegramAuthProvider({ children }: TelegramAuthProviderProps) {
  const auth = useTelegramAuth(CHANNEL_ID)

  return (
    <TelegramAuthContext.Provider value={auth}>
      {children}
    </TelegramAuthContext.Provider>
  )
}

export function useTelegramAuthContext(): AuthState {
  const context = useContext(TelegramAuthContext)

  if (!context) {
    throw new Error('useTelegramAuthContext must be used within TelegramAuthProvider')
  }

  return context
}
