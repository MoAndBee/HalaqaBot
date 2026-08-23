import React, { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import type { Id } from '@halakabot/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useSelectedChannel, useTelegramAuthContext } from '~/contexts/TelegramAuthContext'

interface ImportPostModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Adds a halaqa the bot never recorded — a post published before the bot was
 * made an admin of the channel, which therefore never reached it.
 *
 * The lookup runs on the bot (only it can talk to Telegram), so the request is
 * queued and its progress is followed on the import record.
 */
export function ImportPostModal({ isOpen, onClose }: ImportPostModalProps) {
  const { chatId, channelId } = useSelectedChannel()
  const { user } = useTelegramAuthContext()
  const requestPostImport = useMutation(api.mutations.requestPostImport)

  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importId, setImportId] = useState<Id<'postImports'> | null>(null)
  const [doneMessage, setDoneMessage] = useState('')
  const [isSlow, setIsSlow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setLink('')
      setError('')
      setIsSubmitting(false)
      setImportId(null)
      setDoneMessage('')
      setIsSlow(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Follow the queued import; the bot may take a few seconds to resolve it.
  const importRecord = useQuery(
    api.queries.getPostImport,
    importId ? { importId } : 'skip',
  )

  // The lookup runs on the bot, so a stopped bot would otherwise spin forever.
  useEffect(() => {
    if (!importId) {
      setIsSlow(false)
      return
    }
    const timer = setTimeout(() => setIsSlow(true), 60_000)
    return () => clearTimeout(timer)
  }, [importId])

  useEffect(() => {
    if (!importRecord) return
    if (importRecord.status === 'completed') {
      setIsSubmitting(false)
      setImportId(null)
      setDoneMessage('تمت إضافة الحلقة إلى القائمة.')
    } else if (importRecord.status === 'failed') {
      setIsSubmitting(false)
      setImportId(null)
      setError(importRecord.error || 'تعذر استيراد المنشور.')
    }
  }, [importRecord])

  const handleSubmit = async () => {
    const trimmed = link.trim()
    if (!trimmed) {
      setError('الرجاء إدخال رابط المنشور')
      return
    }

    setIsSubmitting(true)
    setError('')
    setDoneMessage('')

    try {
      const result = await requestPostImport({
        chatId,
        channelId,
        link: trimmed,
        requestedBy: user?.id,
      })

      if (result.importId) {
        setImportId(result.importId)
      } else {
        // Already registered — nothing for the bot to look up.
        setIsSubmitting(false)
        setDoneMessage('هذه الحلقة موجودة في القائمة بالفعل.')
      }
    } catch (err: any) {
      setIsSubmitting(false)
      setError(err?.data ?? 'تعذر إرسال الطلب. حاولي مرة أخرى.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSubmitting) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Closing mid-search is safe: the lookup continues on the bot, and the halaqa
  // appears in the list on its own once it is found.
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md top-4 left-[50%] translate-x-[-50%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] max-h-[80vh] overflow-y-auto p-4 sm:p-6"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>إضافة حلقة قديمة</DialogTitle>
          <DialogDescription>
            للحلقات التي نُشرت قبل إضافة البوت مشرفًا في القناة. انسخي رابط منشور
            الحلقة من تيليجرام والصقيه هنا.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="postLink" className="text-sm font-medium">
            رابط المنشور
          </label>
          <Input
            id="postLink"
            ref={inputRef}
            type="url"
            dir="ltr"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://t.me/c/1234567890/456"
            disabled={isSubmitting}
          />
          {isSubmitting && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ البحث عن المنشور في تيليجرام...
            </p>
          )}
          {isSlow && (
            <p className="text-sm text-muted-foreground">
              البحث يستغرق وقتًا أطول من المعتاد. يمكنك إغلاق النافذة، وستظهر
              الحلقة في القائمة عند العثور عليها.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {doneMessage && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {doneMessage}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {doneMessage ? 'إغلاق' : 'إلغاء'}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !link.trim()}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
