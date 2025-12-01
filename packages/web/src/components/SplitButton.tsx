import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

export type SessionType = 'تلاوة' | 'تسميع' | 'تطبيق' | 'اختبار' | 'دعم'

interface SplitButtonProps {
  onComplete: (sessionType: SessionType) => void
  disabled?: boolean
  defaultSessionType?: SessionType | null
}

export function SplitButton({ onComplete, disabled = false, defaultSessionType = null }: SplitButtonProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(defaultSessionType)

  // Update selectedType when defaultSessionType changes (e.g., when user changes)
  useEffect(() => {
    setSelectedType(defaultSessionType)
  }, [defaultSessionType])

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
  }

  const buttonText = selectedType ? `إتمام (${selectedType})` : 'إتمام (اختر)'
  const isCompleteDisabled = disabled || !selectedType

  return (
    <div className="inline-flex rounded-md shadow-sm" dir="rtl">
      {/* Main button */}
      <Button
        onClick={handleComplete}
        disabled={isCompleteDisabled}
        variant="default"
        className="rounded-r-md rounded-l-none"
      >
        {buttonText}
      </Button>

      {/* Dropdown button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled}
            variant="default"
            className="rounded-l-md rounded-r-none border-l px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleSelectType('تلاوة')}>
            تلاوة
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('تسميع')}>
            تسميع
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('تطبيق')}>
            تطبيق
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('اختبار')}>
            اختبار
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSelectType('دعم')}>
            دعم
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
