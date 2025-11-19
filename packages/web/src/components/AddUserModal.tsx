import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'
import { Loader } from './Loader'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (userId: number) => void
}

export function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search users
  const searchResults = useQuery(api.queries.searchUsers, { query: debouncedQuery })

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus input on open
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[50vh]"
        dir="rtl"
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">إضافة مستخدم</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="ابحث بالاسم أو المعرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 text-white px-4 py-3 rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[200px]">
          {debouncedQuery.trim() === '' ? (
            <div className="text-center text-slate-500 py-8">
              ابدأ الكتابة للبحث عن مستخدمين
            </div>
          ) : !searchResults ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              لا يوجد نتائج
            </div>
          ) : (
            searchResults.map((user) => (
              <button
                key={user.userId}
                onClick={() => onAdd(user.userId)}
                className="w-full text-right p-3 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="text-white font-medium">
                    {user.realName || user.telegramName}
                  </div>
                  <div className="text-slate-400 text-sm">
                    {user.telegramName}
                    {user.username && ` • @${user.username}`}
                  </div>
                </div>
                <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                  إضافة
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
