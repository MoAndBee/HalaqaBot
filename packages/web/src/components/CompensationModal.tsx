import React, { useState, useEffect, useRef } from 'react'

interface CompensationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (dates: number[]) => void
  currentDates?: number[] | null
  userName: string
}

export function CompensationModal({ isOpen, onClose, onSave, currentDates, userName }: CompensationModalProps) {
  const [selectedDates, setSelectedDates] = useState<number[]>(currentDates || [])
  const [newDateInput, setNewDateInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update dates when currentDates changes
  useEffect(() => {
    setSelectedDates(currentDates || [])
  }, [currentDates])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleAddDate = () => {
    if (!newDateInput) return

    // Convert YYYY-MM-DD to timestamp (start of day in UTC)
    const date = new Date(newDateInput + 'T00:00:00Z')
    const timestamp = date.getTime()

    // Check if date already exists
    if (!selectedDates.includes(timestamp)) {
      setSelectedDates([...selectedDates, timestamp].sort((a, b) => a - b))
    }

    // Clear input
    setNewDateInput('')
    inputRef.current?.focus()
  }

  const handleRemoveDate = (timestamp: number) => {
    setSelectedDates(selectedDates.filter(d => d !== timestamp))
  }

  const handleSave = async () => {
    if (selectedDates.length === 0) {
      alert('يرجى تحديد تاريخ واحد على الأقل')
      return
    }

    setIsSaving(true)
    try {
      await onSave(selectedDates)
      onClose()
    } catch (error) {
      console.error('Error saving compensation dates:', error)
      alert('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddDate()
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">تحديد تواريخ التعويض</h3>
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

        <div className="p-4 space-y-4">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            التعويض عن: <span className="font-medium text-gray-900 dark:text-white">{userName}</span>
          </div>

          {/* Date input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="date"
              value={newDateInput}
              onChange={(e) => setNewDateInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="flex-1 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-white px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 focus:border-blue-500 focus:outline-none transition-colors"
            />
            <button
              onClick={handleAddDate}
              disabled={!newDateInput || isSaving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إضافة
            </button>
          </div>

          {/* Selected dates list */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
              التواريخ المحددة ({selectedDates.length}):
            </div>
            {selectedDates.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-slate-500 text-center py-4 bg-gray-100 dark:bg-slate-900 rounded-lg">
                لم يتم تحديد أي تواريخ بعد
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedDates.map((timestamp) => (
                  <div
                    key={timestamp}
                    className="flex items-center justify-between bg-gray-100 dark:bg-slate-900 px-3 py-2 rounded-lg group"
                  >
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatDate(timestamp)}
                    </span>
                    <button
                      onClick={() => handleRemoveDate(timestamp)}
                      disabled={isSaving}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                      title="حذف"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            disabled={isSaving || selectedDates.length === 0}
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
