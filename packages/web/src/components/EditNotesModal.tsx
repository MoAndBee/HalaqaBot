import React, { useState, useEffect, useRef } from 'react'

interface EditNotesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (notes: string) => void
  currentNotes?: string | null
  userName: string
}

export function EditNotesModal({ isOpen, onClose, onSave, currentNotes, userName }: EditNotesModalProps) {
  const [notes, setNotes] = useState(currentNotes || '')
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update notes when currentNotes changes
  useEffect(() => {
    setNotes(currentNotes || '')
  }, [currentNotes])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus()
        // Move cursor to end
        const length = textareaRef.current?.value.length || 0
        textareaRef.current?.setSelectionRange(length, length)
      }, 100)
    }
  }, [isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(notes)
      onClose()
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  if (!isOpen) return null

  const charCount = notes.length
  const maxChars = 500

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">إضافة ملاحظات</h3>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            disabled={isSaving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            ملاحظات عن: <span className="font-medium text-gray-900 dark:text-white">{userName}</span>
          </div>

          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب ملاحظاتك هنا..."
            maxLength={maxChars}
            disabled={isSaving}
            className="w-full bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-white px-4 py-3 rounded-lg border border-gray-300 dark:border-slate-700 focus:border-blue-500 focus:outline-none transition-colors resize-none h-40"
          />

          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-slate-500">
            <span>{charCount} / {maxChars}</span>
            <span className="text-gray-400 dark:text-slate-600">Ctrl/Cmd + Enter للحفظ</span>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                جاري الحفظ...
              </>
            ) : (
              'حفظ'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
