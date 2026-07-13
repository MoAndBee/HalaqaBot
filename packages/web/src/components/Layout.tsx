import type { ReactNode } from 'react'
import { Moon, Sun, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './ThemeProvider'
import { useTelegramAuthContext } from '../contexts/TelegramAuthContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme()
  const { channels, clearSelectedChannel } = useTelegramAuthContext()
  const canSwitchChannel = (channels?.length ?? 0) > 1

  return (
    <div className="h-screen flex flex-col bg-background text-foreground" dir="rtl">
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        {canSwitchChannel && (
          <Button
            variant="outline"
            size="icon"
            onClick={clearSelectedChannel}
            aria-label="تبديل القناة"
          >
            <Repeat className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
