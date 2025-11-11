import { Link } from 'wouter'
import type { ReactNode } from 'react'
import { IconLink } from './IconLink'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col min-h-0">
      <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between py-4 px-8 box-border">
        <div className="flex items-center gap-4">
          <div>
            <Link href="/">
              <a className="block leading-tight">
                <div className="font-black text-2xl text-white">Halakabot</div>
                <div className="text-slate-500">Halaqa Management</div>
              </a>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <IconLink
            href="https://github.com/MoAndBee/halakabot"
            label="Source"
            icon="/github-mark-white.png"
          />
        </div>
      </div>

      <div className="grow min-h-0 h-full flex flex-col">
        {children}
      </div>
    </div>
  )
}
