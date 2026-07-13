import { useEffect, useState } from 'react'

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

  // Loading states
  isLoading: boolean

  // Error state
  error: string | null

  // Telegram Web App instance
  webApp: TelegramWebApp | null
}

// Dev bypass: set VITE_DEV_USER_ID in .env.local to skip Telegram auth entirely
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID
  ? Number(import.meta.env.VITE_DEV_USER_ID)
  : null

export function useTelegramAuth(): AuthState {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!DEV_USER_ID)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)

  // Step 1: Extract user from Telegram Web App
  useEffect(() => {
    if (DEV_USER_ID) return  // skip in dev mode
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

    // User extracted — nothing else to wait for.
    setIsLoading(false)
  }, [])

  if (DEV_USER_ID) {
    return {
      user: { id: DEV_USER_ID, firstName: 'Dev', lastName: 'User' },
      isLoading: false,
      error: null,
      webApp: null,
    }
  }

  return {
    user,
    isLoading,
    error,
    webApp,
  }
}
