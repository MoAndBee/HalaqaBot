interface UnauthorizedScreenProps {
  user: {
    id: number
    firstName: string
    username?: string
  } | null
}

export function UnauthorizedScreen({ user }: UnauthorizedScreenProps) {
  const handleClose = () => {
    window.Telegram?.WebApp.close()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h1>
          <p className="text-gray-600 mb-6">
            عذراً، لا يمكنك الوصول إلى لوحة التحكم
          </p>
        </div>

        {user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">المستخدم:</p>
            <p className="font-semibold text-gray-900">{user.firstName}</p>
            {user.username && (
              <p className="text-sm text-gray-500">@{user.username}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">معرف: {user.id}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 للحصول على صلاحية الوصول، يجب أن تكون مشرفاً في القناة
          </p>
        </div>

        <button
          onClick={handleClose}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors w-full font-medium"
        >
          إغلاق
        </button>
      </div>
    </div>
  )
}
