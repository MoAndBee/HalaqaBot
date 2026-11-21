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
import { registerConfirmHost } from '@/lib/utils'

interface PendingConfirm {
  message: string
  resolve: (confirmed: boolean) => void
}

/**
 * In-app confirmation dialog, used by tgConfirm when Telegram's native popup
 * can't be shown (for example when Telegram still considers an earlier popup
 * open, or the client doesn't support popups). Mount once near the app root.
 */
export function ConfirmHost() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)

  React.useEffect(() => {
    return registerConfirmHost((message) =>
      new Promise<boolean>((resolve) => {
        setPending((previous) => {
          // A newer request replaces an unanswered one; treat that as "cancel".
          previous?.resolve(false)
          return { message, resolve }
        })
      })
    )
  }, [])

  const answer = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && answer(false)}>
      <DialogContent className="max-w-sm top-[20%] sm:top-[50%]" dir="rtl">
        <DialogHeader>
          <DialogTitle>تأكيد</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{pending?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => answer(false)}>
            إلغاء
          </Button>
          <Button onClick={() => answer(true)}>موافق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
