'use client'

import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { fetchConvexToken } from './bot-api'

const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://localhost:3210'
const convex = new ConvexReactClient(convexUrl)

/**
 * Convex only answers signed-in callers. The bot's Worker signs the token,
 * after checking Telegram's signature on the Mini App's initData; Convex then
 * decides what this user may see.
 */
function useTelegramConvexAuth() {
  const initData = window.Telegram?.WebApp?.initData ?? ''
  const fetchAccessToken = useCallback(
    // Convex asks again before the token runs out; a fresh one is always fine.
    async () => (initData ? fetchConvexToken() : null),
    [initData]
  )
  return useMemo(
    () => ({ isLoading: false, isAuthenticated: initData !== '', fetchAccessToken }),
    [initData, fetchAccessToken]
  )
}

interface ConvexClientProviderProps {
  children: ReactNode
}

/**
 * Provider component that wraps the app with Convex client
 * This enables the use of useQuery and useMutation hooks throughout the app
 */
export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useTelegramConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
