// Client for the bot's API (packages/bot/src/api.ts): actions that need the bot
// to act in Telegram — sending the list, reacting, importing a post.
//
// Requests are signed with the Mini App's initData, which the bot verifies with
// its token, so they only work inside Telegram (not with VITE_DEV_USER_ID).

const botApiUrl = import.meta.env.VITE_BOT_API_URL as string | undefined

export class BotApiError extends Error {}

export async function callBot<T = unknown>(path: string, body: unknown): Promise<T> {
  if (!botApiUrl) {
    throw new BotApiError('VITE_BOT_API_URL is not set')
  }

  const initData = window.Telegram?.WebApp?.initData ?? ''
  const response = await fetch(new URL(path, botApiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${initData}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    // 409 carries a message written for the admin; anything else falls back to
    // the caller's own wording.
    if (response.status === 409 && typeof data.error === 'string') {
      throw new BotApiError(data.error)
    }
    if (response.status === 401) {
      throw new BotApiError('يجب فتح التطبيق من خلال تيليجرام')
    }
    throw new BotApiError('')
  }
  return data as T
}
