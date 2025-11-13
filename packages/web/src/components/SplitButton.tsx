import { useState, useRef, useEffect } from 'react'

export type SessionType = 'تلاوة' | 'تسميع'

interface SplitButtonProps {
  onComplete: (sessionType: SessionType) => void
  disabled?: boolean
}

export function SplitButton({ onComplete, disabled = false }: SplitButtonProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
          px-6 py-3 rounded-r-xl font-semibold text-white text-lg
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
          px-3 border-r border-green-700 rounded-l-xl
          transition-colors duration-200
          ${
            disabled
              ? 'bg-slate-600 cursor-not-allowed opacity-50'
              : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
          }
        `}
      >
        <svg
          className={`w-5 h-5 text-white transition-transform duration-200 ${
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
        <div className="absolute left-0 top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
          <button
            onClick={() => handleSelectType('تلاوة')}
            className="w-full px-5 py-3 text-right text-white text-base hover:bg-slate-700 transition-colors"
          >
            تلاوة
          </button>
          <button
            onClick={() => handleSelectType('تسميع')}
            className="w-full px-5 py-3 text-right text-white text-base hover:bg-slate-700 transition-colors"
          >
            تسميع
          </button>
        </div>
      )}
    </div>
  )
}
