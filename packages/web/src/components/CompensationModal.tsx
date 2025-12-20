import React, { useState, useEffect, useRef } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import 'react-day-picker/dist/style.css'

interface CompensationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (dates: number[]) => void
  currentDates?: number[] | null
  userName: string
}

export function CompensationModal({ isOpen, onClose, onSave, currentDates, userName }: CompensationModalProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>(
    (currentDates || []).map(timestamp => {
      const date = new Date(timestamp)
      date.setHours(0, 0, 0, 0)
      return date
    })
  )
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Update dates when currentDates or userName changes (to reset between users)
  useEffect(() => {
    setSelectedDates((currentDates || []).map(timestamp => {
      const date = new Date(timestamp)
      date.setHours(0, 0, 0, 0)
      return date
    }))
  }, [currentDates, userName])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleDaySelect = (dates: Date[] | undefined) => {
    if (!dates) {
      setSelectedDates([])
      return
    }

    // Normalize all dates to start of day
    const normalizedDates = dates.map(date => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      return d
    }).sort((a, b) => a.getTime() - b.getTime())

    setSelectedDates(normalizedDates)
  }

  const handleRemoveDate = (date: Date) => {
    setSelectedDates(selectedDates.filter(d => d.getTime() !== date.getTime()))
  }

  const handleSave = async () => {
    if (selectedDates.length === 0) {
      alert('يرجى تحديد تاريخ واحد على الأقل')
      return
    }

    setIsSaving(true)
    try {
      // Convert dates to timestamps
      const timestamps = selectedDates.map(date => {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
      await onSave(timestamps)
      onClose()
    } catch (error) {
      console.error('Error saving compensation dates:', error)
      alert('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (date: Date) => {
    return format(date, 'EEEE، d MMMM yyyy', { locale: ar })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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

        <div className="p-4 overflow-y-auto">
          <div className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            الاسم: <span className="font-medium text-gray-900 dark:text-white">{userName}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Calendar */}
            <div className="flex justify-center">
              <div className="rdp-custom">
                <style>{`
                  .rdp-custom {
                    --rdp-cell-size: 40px;
                    --rdp-accent-color: #3b82f6;
                    --rdp-background-color: #dbeafe;
                  }
                  .rdp-custom .rdp {
                    margin: 0;
                  }
                  .rdp-custom .rdp-months {
                    direction: ltr;
                  }
                  .rdp-custom .rdp-caption {
                    direction: rtl;
                  }
                  .rdp-custom .rdp-day_selected {
                    background-color: var(--rdp-accent-color) !important;
                    color: white !important;
                    font-weight: 600;
                  }
                  .rdp-custom .rdp-day_selected:hover {
                    background-color: #2563eb !important;
                  }
                  .dark .rdp-custom {
                    --rdp-accent-color: white;
                    --rdp-background-color: #1e3a8a;
                  }
                  .dark .rdp-custom .rdp-month,
                  .dark .rdp-custom .rdp-caption,
                  .dark .rdp-custom .rdp-head_cell,
                  .dark .rdp-custom .rdp-day {
                    color: #e2e8f0;
                  }
                  .dark .rdp-custom .rdp-day_selected {
                    background-color: white !important;
                    color: #1e293b !important;
                    font-weight: 700;
                    border: 2px solid #3b82f6;
                  }
                  .dark .rdp-custom .rdp-day_selected:hover {
                    background-color: #f1f5f9 !important;
                    border-color: #60a5fa;
                  }
                  .dark .rdp-custom .rdp-day:not(.rdp-day_selected):hover {
                    background-color: #334155;
                  }
                `}</style>
                <DayPicker
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleDaySelect}
                  locale={ar}
                  disabled={{ after: new Date() }}
                />
              </div>
            </div>

            {/* Selected dates list */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
                التواريخ المحددة ({selectedDates.length}):
              </div>
              {selectedDates.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-slate-500 text-center py-8 bg-gray-100 dark:bg-slate-900 rounded-lg">
                  اضغط على التواريخ في التقويم لتحديدها
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedDates.map((date) => (
                    <div
                      key={date.getTime()}
                      className="flex items-center justify-between bg-gray-100 dark:bg-slate-900 px-3 py-2 rounded-lg group"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatDate(date)}
                      </span>
                      <button
                        onClick={() => handleRemoveDate(date)}
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
