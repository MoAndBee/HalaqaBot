import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col min-h-0 pt-4">
      <div className="grow min-h-0 h-full flex flex-col">
        {children}
      </div>
    </div>
  )
}
