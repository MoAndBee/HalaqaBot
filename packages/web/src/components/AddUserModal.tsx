import { useState, useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Search, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader } from './Loader'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (userId: number) => void
}

export function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const searchResults = useQuery(api.queries.searchUsers, { query: debouncedQuery })

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md h-[50vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="ابحث بالاسم أو المعرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1 min-h-[200px]">
            {debouncedQuery.trim() === '' ? (
              <div className="text-center text-muted-foreground py-8">
                ابدأ الكتابة للبحث عن مستخدمين
              </div>
            ) : !searchResults ? (
              <div className="flex justify-center py-8">
                <Loader />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                لا يوجد نتائج
              </div>
            ) : (
              searchResults.map((user: { userId: number; telegramName: string; realName?: string | null; username?: string | null }) => (
                <Button
                  key={user.userId}
                  variant="ghost"
                  className="w-full justify-between h-auto p-3 group"
                  onClick={() => onAdd(user.userId)}
                >
                  <div className="flex-1 text-right">
                    <div className="font-medium">
                      {user.realName || user.telegramName}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {user.telegramName}
                      {user.username && ` • @${user.username}`}
                    </div>
                  </div>
                  <UserPlus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
