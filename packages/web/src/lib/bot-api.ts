// Client for the bot's API (packages/bot/src/api.ts): actions that need the bot
// to act in Telegram — sending the list, reacting, importing a post.
//
// Requests are signed with the Mini App's initData, which the bot verifies with
// its token, so they only work inside Telegram (or the Telegram simulator).

// The Worker's origin, e.g. https://halaqabot.<account>.workers.dev
const botApiUrl = import.meta.env.VITE_BOT_API_URL as string | undefined

// Long enough for sending the list with its image; a hung request must not
// leave the UI waiting forever.
const TIMEOUT_MS = 30_000

export class BotApiError extends Error {
  /** The HTTP status, or undefined if the bot couldn't be reached. */
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

export async function callBot<T = unknown>(path: string, body: unknown): Promise<T> {
  if (!botApiUrl) {
    console.error('VITE_BOT_API_URL is not set')
    throw new BotApiError('')
  }

  const initData = window.Telegram?.WebApp?.initData ?? ''
  let response: Response
  try {
    response = await fetch(new URL(path, botApiUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    // Offline, timed out, or blocked by CORS: let the caller's own message show.
    console.error(`Bot API ${path} unreachable:`, error)
    throw new BotApiError('')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    // 409 carries a message written for the admin; anything else falls back to
    // the caller's own wording.
    if (response.status === 409 && typeof data.error === 'string') {
      throw new BotApiError(data.error, 409)
    }
    if (response.status === 401) {
      throw new BotApiError('يجب فتح التطبيق من خلال تيليجرام', 401)
    }
    throw new BotApiError('', response.status)
  }
  return data as T
}

/**
 * A Convex token for this user, signed by the bot (see lib/convex.tsx).
 * Network trouble is retried, since null signs the app out for good; null
 * comes back at once if the bot rejects the initData (e.g. expired).
 */
export async function fetchConvexToken(): Promise<string | null> {
  const delays = [1_000, 3_000, 8_000]
  for (let attempt = 0; ; attempt++) {
    try {
      const { token } = await callBot<{ token: string }>('/api/auth/token', {})
      return token
    } catch (error) {
      const rejected = error instanceof BotApiError && error.status !== undefined && error.status < 500
      if (rejected || attempt >= delays.length) return null
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
    }
  }
}
