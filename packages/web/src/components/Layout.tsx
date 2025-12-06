import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground" dir="rtl">
      <div className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  )
}
