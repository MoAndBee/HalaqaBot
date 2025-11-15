import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="space-y-2 p-2" dir="rtl">
      <div className="text-gray-600 dark:text-gray-400">
        {children || <p>الصفحة التي تبحث عنها غير موجودة.</p>}
      </div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="bg-emerald-500 text-white px-2 py-1 rounded-sm font-black text-sm"
        >
          العودة
        </button>
        <Link
          to="/"
          className="bg-cyan-600 text-white px-2 py-1 rounded-sm font-black text-sm"
        >
          البداية
        </Link>
      </p>
    </div>
  )
}
