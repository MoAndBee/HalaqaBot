import { useState, useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'
import { Button } from './ui/button'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (userId: number) => void
}

export function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search users
  const searchResults = useQuery(api.queries.searchUsers, { query: debouncedQuery })

  // Focus input on open
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[50vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">إضافة مستخدم</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Input
            ref={inputRef}
            type="text"
            placeholder="ابحث بالاسم أو المعرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px]">
          {debouncedQuery.trim() === '' ? (
            <div className="text-center text-muted-foreground py-8">
              ابدأ الكتابة للبحث عن مستخدمين
            </div>
          ) : !searchResults ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا يوجد نتائج
            </div>
          ) : (
            searchResults.map((user: any) => (
              <Button
                key={user.userId}
                onClick={() => onAdd(user.userId)}
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-3"
              >
                <div className="text-right">
                  <div className="font-medium">
                    {user.realName || user.telegramName}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {user.telegramName}
                    {user.username && ` • @${user.username}`}
                  </div>
                </div>
                <div className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  إضافة
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
