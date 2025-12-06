import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type SessionType = 'تلاوة' | 'تسميع' | 'تطبيق' | 'اختبار' | 'دعم'

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
    <div className="inline-flex" dir="rtl">
      <Button
        onClick={handleComplete}
        disabled={isCompleteDisabled}
        className="rounded-l-none bg-green-600 hover:bg-green-700 text-white"
        size="sm"
      >
        {buttonText}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled}
            className="rounded-r-none border-r border-green-700 bg-green-600 hover:bg-green-700 text-white px-2"
            size="sm"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SESSION_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleSelectType(type)}
              className="cursor-pointer"
            >
              {type}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
