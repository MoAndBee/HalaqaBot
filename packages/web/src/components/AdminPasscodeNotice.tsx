import { ShieldAlert } from 'lucide-react'
import { ConvexError } from 'convex/values'

/**
 * Shown on every action guarded by the admin passcode, so it's clear up front
 * why a code is being asked for and that the action isn't for everyone.
 */
export function AdminPasscodeNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      <span>هذا إجراء خاص بالإدارة، ولا يتم إلا بإدخال رمز الحماية.</span>
    </div>
  )
}

/**
 * Readable message for a failed admin action. The server reports a wrong
 * passcode (and its other Arabic messages) as ConvexError data; a plain Error
 * reaches the client wrapped in Convex's request prefix, so only its own
 * message is shown as a last resort.
 */
export function adminActionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data
  if (err instanceof Error) {
    const match = err.message.match(/Uncaught (?:Convex)?Error: ([^\n]+)/)
    if (match) return match[1].trim()
  }
  return fallback
}
