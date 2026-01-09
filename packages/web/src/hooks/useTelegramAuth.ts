import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'

export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
}

export interface AuthState {
  // User data from Telegram
  user: TelegramUser | null

  // Authorization status from backend
  isAuthorized: boolean

  // Loading states
  isLoading: boolean
  isCheckingAuth: boolean

  // Error state
  error: string | null

  // Telegram Web App instance
  webApp: TelegramWebApp | null
}

export function useTelegramAuth(channelId: number): AuthState {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)

  // Step 1: Extract user from Telegram Web App
  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (!tg) {
      setError('يجب فتح التطبيق من خلال تيليجرام')
      setIsLoading(false)
      return
    }

    // Initialize Telegram Web App
    tg.ready()
    tg.expand()

    // Apply Telegram theme colors to CSS variables
    if (tg.themeParams) {
      const root = document.documentElement
      if (tg.themeParams.bg_color) {
        root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color)
      }
      if (tg.themeParams.text_color) {
        root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color)
      }
      if (tg.themeParams.hint_color) {
        root.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color)
      }
      if (tg.themeParams.link_color) {
        root.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color)
      }
      if (tg.themeParams.button_color) {
        root.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color)
      }
      if (tg.themeParams.button_text_color) {
        root.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color)
      }
    }

    setWebApp(tg)

    // Get user data
    const telegramUser = tg.initDataUnsafe?.user

    if (!telegramUser) {
      setError('لم نتمكن من الحصول على معلومات المستخدم من تيليجرام')
      setIsLoading(false)
      return
    }

    // Map to our user type
    setUser({
      id: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      languageCode: telegramUser.language_code,
    })

    console.log('✅ Telegram user loaded:', {
      id: telegramUser.id,
      name: telegramUser.first_name,
      username: telegramUser.username,
    })
  }, [])

  // Step 2: Check authorization against backend
  const authCheck = useQuery(
    api.queries.isUserAuthorized,
    user ? { userId: user.id, channelId } : 'skip'
  )

  // Step 3: Update state when auth check completes
  useEffect(() => {
    if (authCheck !== undefined) {
      setIsLoading(false)
    }
  }, [authCheck])

  return {
    user,
    isAuthorized: authCheck ?? false,
    isLoading,
    isCheckingAuth: user !== null && authCheck === undefined,
    error,
    webApp,
  }
}
