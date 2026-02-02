import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SessionType = 'تلاوة' | 'تسميع' | 'تطبيق' | 'اختبار' | 'دعم' | 'مراجعة' | 'تعويض'

const SESSION_TYPES: SessionType[] = ['تلاوة', 'تسميع', 'تطبيق', 'اختبار', 'دعم', 'مراجعة']

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
    // Don't reset selectedType here - let useEffect update it when defaultSessionType changes
    // This prevents the button from being disabled during the async operation
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
          <DropdownMenuItem
            onClick={() => handleSelectType('تعويض')}
            className="cursor-pointer text-base py-2"
          >
            تعويض
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
