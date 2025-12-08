import { useState, useRef, useEffect } from 'react'

export type SessionType = 'تلاوة' | 'تسميع' | 'تطبيق' | 'اختبار' | 'دعم' | 'تعويض'

interface SplitButtonProps {
  onComplete: (sessionType: SessionType) => void
  disabled?: boolean
  defaultSessionType?: SessionType | null
}

export function SplitButton({ onComplete, disabled = false, defaultSessionType = null }: SplitButtonProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(defaultSessionType)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Update selectedType when defaultSessionType changes (e.g., when user changes)
  useEffect(() => {
    setSelectedType(defaultSessionType)
  }, [defaultSessionType])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleComplete = () => {
    if (!selectedType) {
      alert('الرجاء اختيار نوع الدور')
      return
    }
    onComplete(selectedType)
    // Reset after completion
    setSelectedType(null)
  }

  const handleSelectType = (type: SessionType) => {
    setSelectedType(type)
    setIsDropdownOpen(false)
  }

  const buttonText = selectedType ? `إتمام (${selectedType})` : 'إتمام (اختر)'
  const isCompleteDisabled = disabled || !selectedType

  return (
    <div className="relative inline-flex" ref={dropdownRef} dir="rtl">
      {/* Main button */}
      <button
        onClick={handleComplete}
        disabled={isCompleteDisabled}
        className={`
          px-3 py-2 sm:px-4 sm:py-2 rounded-r-lg font-medium text-white text-sm sm:text-base
          transition-colors duration-200
          ${
            isCompleteDisabled
              ? 'bg-slate-600 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
          }
        `}
      >
        {buttonText}
      </button>

      {/* Dropdown button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={disabled}
        className={`
          px-1.5 sm:px-2 border-r border-green-700 rounded-l-lg
          transition-colors duration-200
          ${
            disabled
              ? 'bg-slate-600 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
          }
        `}
      >
        <svg
          className={`w-4 h-4 text-white transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div className="fixed sm:absolute left-auto right-2 sm:left-0 sm:right-auto top-auto sm:top-full mt-1 w-32 sm:w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          <button
            onClick={() => handleSelectType('تلاوة')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors rounded-t-lg"
          >
            تلاوة
          </button>
          <button
            onClick={() => handleSelectType('تسميع')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            تسميع
          </button>
          <button
            onClick={() => handleSelectType('تطبيق')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            تطبيق
          </button>
          <button
            onClick={() => handleSelectType('اختبار')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            اختبار
          </button>
          <button
            onClick={() => handleSelectType('دعم')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            دعم
          </button>
          <button
            onClick={() => handleSelectType('تعويض')}
            className="w-full px-4 py-2 text-right text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors rounded-b-lg"
          >
            تعويض
          </button>
        </div>
      )}
    </div>
  )
}
