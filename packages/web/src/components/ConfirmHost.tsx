import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerConfirmHost, registerPromptHost } from '@/lib/utils'

type Pending =
  | { kind: 'confirm'; message: string; resolve: (confirmed: boolean) => void }
  | { kind: 'prompt'; message: string; resolve: (value: string | null) => void }

/**
 * In-app dialogs that stand in for browser and Telegram popups, which the
 * Telegram app doesn't always display:
 * - confirm: used by tgConfirm when Telegram's native popup can't be shown
 * - prompt: used by appPrompt instead of window.prompt
 * Mount once near the app root.
 */
export function ConfirmHost() {
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [value, setValue] = React.useState('')

  React.useEffect(() => {
    // A newer request replaces an unanswered one; treat that as "cancel".
    const replace = (next: Pending) =>
      setPending((previous) => {
        if (previous?.kind === 'confirm') previous.resolve(false)
        if (previous?.kind === 'prompt') previous.resolve(null)
        return next
      })

    const unregisterConfirm = registerConfirmHost((message) =>
      new Promise<boolean>((resolve) => replace({ kind: 'confirm', message, resolve }))
    )
    const unregisterPrompt = registerPromptHost((message, defaultValue) =>
      new Promise<string | null>((resolve) => {
        setValue(defaultValue)
        replace({ kind: 'prompt', message, resolve })
      })
    )
    return () => {
      unregisterConfirm()
      unregisterPrompt()
    }
  }, [])

  const accept = () => {
    if (pending?.kind === 'confirm') pending.resolve(true)
    if (pending?.kind === 'prompt') pending.resolve(value)
    setPending(null)
  }

  const cancel = () => {
    if (pending?.kind === 'confirm') pending.resolve(false)
    if (pending?.kind === 'prompt') pending.resolve(null)
    setPending(null)
  }

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && cancel()}>
      <DialogContent className="max-w-sm top-[20%] sm:top-[50%]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{pending?.kind === 'prompt' ? 'إدخال' : 'تأكيد'}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{pending?.message}</DialogDescription>
        </DialogHeader>
        {pending?.kind === 'prompt' && (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                accept()
              }
            }}
          />
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={cancel}>
            إلغاء
          </Button>
          <Button onClick={accept}>موافق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
