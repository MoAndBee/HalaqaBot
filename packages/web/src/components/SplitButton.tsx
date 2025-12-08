import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SessionType = 'تلاوة' | 'تسميع' | 'تطبيق' | 'اختبار' | 'دعم' | 'تعويض'

const SESSION_TYPES: SessionType[] = ['تلاوة', 'تسميع', 'تطبيق', 'اختبار', 'دعم']

interface SplitButtonProps {
  onComplete: (sessionType: SessionType) => void
  disabled?: boolean
  defaultSessionType?: SessionType | null
}

export function SplitButton({ onComplete, disabled = false, defaultSessionType = null }: SplitButtonProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(defaultSessionType)

  useEffect(() => {
    setSelectedType(defaultSessionType)
  }, [defaultSessionType])

  const handleComplete = () => {
    if (!selectedType) {
      alert('الرجاء اختيار نوع الدور')
      return
    }
    onComplete(selectedType)
    setSelectedType(null)
  }

  const handleSelectType = (type: SessionType) => {
    setSelectedType(type)
  }

  const buttonText = selectedType ? `إتمام (${selectedType})` : 'إتمام (اختر)'
  const isCompleteDisabled = disabled || !selectedType

  return (
    <div className="flex flex-1 min-w-0" dir="rtl">
      <Button
        onClick={handleComplete}
        disabled={isCompleteDisabled}
        className="flex-1 h-12 text-base font-semibold rounded-l-none bg-green-600 hover:bg-green-700 text-white"
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
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled}
            className="h-12 rounded-r-none border-r border-green-700 bg-green-600 hover:bg-green-700 text-white px-3"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SESSION_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleSelectType(type)}
              className="cursor-pointer text-base py-2"
            >
              {type}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
