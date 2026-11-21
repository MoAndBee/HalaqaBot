import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHijriDate(date: Date): string {
  const hijri = new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return hijri
}

type ConfirmHost = (message: string) => Promise<boolean>
let confirmHost: ConfirmHost | null = null

/** Registers the in-app confirm dialog (see ConfirmHost). Returns an unregister function. */
export function registerConfirmHost(host: ConfirmHost): () => void {
  confirmHost = host
  return () => {
    if (confirmHost === host) confirmHost = null
  }
}

type PromptHost = (message: string, defaultValue: string) => Promise<string | null>
let promptHost: PromptHost | null = null

/** Registers the in-app text input dialog (see ConfirmHost). Returns an unregister function. */
export function registerPromptHost(host: PromptHost): () => void {
  promptHost = host
  return () => {
    if (promptHost === host) promptHost = null
  }
}

/**
 * Ask the user for text, like window.prompt, but through the in-app dialog:
 * the Telegram app doesn't always display browser prompts. Resolves to null
 * when cancelled.
 */
export function appPrompt(message: string, defaultValue = ''): Promise<string | null> {
  if (promptHost) return promptHost(message, defaultValue)
  return Promise.resolve(window.prompt(message, defaultValue))
}

function fallbackConfirm(message: string): Promise<boolean> {
  if (confirmHost) return confirmHost(message)
  return Promise.resolve(window.confirm(message))
}

/**
 * Ask the user to confirm. Uses Telegram's native popup when it is available,
 * and falls back to the in-app dialog when Telegram refuses to show it.
 * showConfirm throws synchronously (e.g. "WebAppPopupOpened" when Telegram
 * thinks a popup is still open, or "WebAppMethodUnsupported"); without this
 * fallback the throw rejected the promise and the action silently did nothing.
 */
export function tgConfirm(message: string): Promise<boolean> {
  const tg = (window as any).Telegram?.WebApp
  if (tg?.showConfirm) {
    return new Promise<boolean>((resolve) => {
      tg.showConfirm(message, (confirmed: boolean) => resolve(!!confirmed))
    }).catch((error) => {
      console.warn('Telegram showConfirm failed, using in-app dialog:', error)
      return fallbackConfirm(message)
    })
  }
  return fallbackConfirm(message)
}
